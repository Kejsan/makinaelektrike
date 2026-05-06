import { FieldValue } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { getEnumValue, getRequiredString } from './_lib/validation';
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { requireDealerAccess } from './_lib/dealerAccess';
import { normalizeUserProfile } from '../../utils/accessControl';

interface DealerStaffMemberUpdateBody {
  dealerId?: string;
  userUid?: string;
  action?: 'remove';
}

const DEALER_STAFF_MEMBER_ACTIONS = ['remove'] as const;

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = event.body ? (JSON.parse(event.body) as DealerStaffMemberUpdateBody) : {};
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const userUid = getRequiredString(body.userUid, 'userUid', 128);
    const action = getEnumValue(body.action, DEALER_STAFF_MEMBER_ACTIONS, 'action');
    await requireDealerAccess(profile, dealerId, { requireTeamManagement: true });

    if (action !== 'remove') {
      return badRequest('Unsupported dealer staff action.');
    }
    if (userUid === profile.uid) {
      return badRequest('Self-removal is not supported through this endpoint.');
    }

    const userRef = getAdminFirestore().collection('users').doc(userUid);
    const userSnapshot = await userRef.get();
    if (!userSnapshot.exists) {
      return badRequest('Dealer staff member was not found.');
    }

    const existingProfile = normalizeUserProfile(
      {
        uid: userUid,
        email: typeof userSnapshot.data()?.email === 'string' ? (userSnapshot.data()!.email as string) : null,
      },
      (userSnapshot.data() ?? {}) as Record<string, unknown>,
    );

    if (existingProfile.accountType !== 'dealer_staff' || existingProfile.dealerId !== dealerId) {
      return badRequest('This user is not an active staff member of the selected dealer.');
    }

    await userRef.set(
      {
        role: 'user',
        accountType: 'user',
        accountStatus: 'active',
        status: 'active',
        dealerId: FieldValue.delete(),
        dealerStaffRole: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: profile.uid,
      },
      { merge: true },
    );

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'dealer_staff.updated',
      entityType: 'user',
      entityId: userUid,
      target: {
        uid: userUid,
        email: existingProfile.email,
      },
      summary: `Removed dealer staff access for ${existingProfile.email ?? userUid}.`,
      before: {
        accountType: existingProfile.accountType,
        role: existingProfile.role,
        dealerId: existingProfile.dealerId ?? null,
        dealerStaffRole: existingProfile.dealerStaffRole ?? null,
      },
      after: {
        accountType: 'user',
        role: 'user',
        dealerId: null,
        dealerStaffRole: null,
      },
      metadata: {
        dealerId,
        action,
      },
    });

    return json(200, {
      ok: true,
      uid: userUid,
      removed: true,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Authenticated admin profile was not found') || message.startsWith('You do not have dealer access')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side dealer staff management is not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be one of') ||
      message.includes('Self-removal') ||
      message.includes('Dealer staff member was not found') ||
      message.includes('not an active staff member')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
