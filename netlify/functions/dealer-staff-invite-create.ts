import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';
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
import { getEnumValue, getRequiredEmail, getRequiredString } from './_lib/validation';
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { getDealerTeamCapacity, requireDealerAccess } from './_lib/dealerAccess';
import { buildAccessInviteCode, buildInviteExpiryDate, isInviteExpired, serializeAccessInvite } from './_lib/invites';
import type { DealerStaffRole } from '../../types';
import { normalizeUserProfile } from '../../utils/accessControl';

interface DealerStaffInviteCreateBody {
  dealerId?: string;
  email?: string;
  dealerStaffRole?: DealerStaffRole;
}

const INVITABLE_DEALER_STAFF_ROLES = ['manager', 'editor'] as const satisfies readonly DealerStaffRole[];

const findExistingUserByEmail = async (email: string): Promise<QueryDocumentSnapshot | null> => {
  const snapshot = await getAdminFirestore().collection('users').where('email', '==', email).limit(1).get();
  return snapshot.docs[0] ?? null;
};

const isDealerActive = (dealerData: Record<string, unknown>) =>
  dealerData.isDeleted !== true &&
  dealerData.isActive !== false &&
  (dealerData.status === 'approved' || dealerData.approved === true);

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = event.body ? (JSON.parse(event.body) as DealerStaffInviteCreateBody) : {};
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const email = getRequiredEmail(body.email, 'email');
    const dealerStaffRole =
      body.dealerStaffRole === undefined
        ? 'manager'
        : getEnumValue(body.dealerStaffRole, INVITABLE_DEALER_STAFF_ROLES, 'dealerStaffRole');

    const dealerAccess = await requireDealerAccess(profile, dealerId, { requireTeamManagement: true });
    if (!isDealerActive(dealerAccess.dealerData)) {
      return badRequest('Dealer staff invites are only available for approved active dealers.');
    }

    const existingUserDoc = await findExistingUserByEmail(email);
    if (existingUserDoc) {
      const existingProfile = normalizeUserProfile(
        { uid: existingUserDoc.id, email },
        existingUserDoc.data() as Record<string, unknown>,
      );

      if ((existingProfile.adminRoleIds?.length ?? 0) > 0) {
        return badRequest('Platform admin accounts cannot be attached as dealer staff.');
      }
      if (
        existingProfile.accountType === 'dealer' ||
        existingProfile.role === 'pending' ||
        (existingProfile.accountType === 'dealer_staff' && existingProfile.dealerId !== dealerId)
      ) {
        return badRequest('This email is already assigned to another dealer or dealer account.');
      }
      if (
        existingProfile.accountType === 'dealer_staff' &&
        existingProfile.dealerId === dealerId &&
        (existingProfile.accountStatus === 'active' || existingProfile.accountStatus === 'approved')
      ) {
        return badRequest('This user is already an active staff member for the selected dealer.');
      }
    }

    const firestore = getAdminFirestore();
    const existingInviteSnapshot = await firestore
      .collection('accessInvites')
      .where('type', '==', 'dealer_staff')
      .where('dealerId', '==', dealerId)
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .get();
    const hasPendingInvite = existingInviteSnapshot.docs.some(doc => !isInviteExpired(doc.data() as Record<string, unknown>));
    if (hasPendingInvite) {
      return badRequest('A pending dealer staff invite already exists for this email.');
    }

    const capacity = await getDealerTeamCapacity(dealerId, dealerAccess.dealerData);
    if (capacity.remainingSlots <= 0) {
      return badRequest('This dealer has reached its current team-account limit.');
    }

    const dealerName =
      typeof dealerAccess.dealerData.name === 'string'
        ? dealerAccess.dealerData.name
        : typeof dealerAccess.dealerData.companyName === 'string'
          ? dealerAccess.dealerData.companyName
          : dealerId;
    const inviteId = buildAccessInviteCode();
    const inviteRef = firestore.collection('accessInvites').doc(inviteId);
    await inviteRef.set({
      type: 'dealer_staff',
      status: 'pending',
      dealerId,
      dealerName,
      email,
      dealerStaffRole,
      createdBy: profile.uid,
      updatedBy: profile.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: buildInviteExpiryDate(7),
    });

    const savedSnapshot = await inviteRef.get();
    const savedData = (savedSnapshot.data() ?? {}) as Record<string, unknown>;

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'invite.created',
      entityType: 'invite',
      entityId: inviteId,
      target: {
        email,
      },
      summary: `Created a dealer staff invite for ${email} on ${dealerName}.`,
      before: null,
      after: {
        type: 'dealer_staff',
        dealerId,
        dealerName,
        email,
        dealerStaffRole,
        expiresAt: savedData.expiresAt ?? null,
      },
      metadata: {
        inviteType: 'dealer_staff',
        remainingSlotsAfterCreate: capacity.remainingSlots - 1,
      },
    });

    return json(200, {
      ok: true,
      invite: serializeAccessInvite(inviteId, savedData, event),
      capacity: {
        ...capacity,
        remainingSlots: Math.max(0, capacity.remainingSlots - 1),
      },
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (
      message.startsWith('Missing required permission') ||
      message.startsWith('Authenticated admin profile was not found') ||
      message.startsWith('You do not have dealer access')
    ) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side dealer staff invites are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be one of') ||
      message.includes('approved active dealers') ||
      message.includes('already assigned') ||
      message.includes('already an active staff member') ||
      message.includes('pending dealer staff invite') ||
      message.includes('team-account limit') ||
      message.includes('Platform admin accounts cannot')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
