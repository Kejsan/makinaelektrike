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
import { getRequiredString } from './_lib/validation';
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { requireDealerAccess } from './_lib/dealerAccess';
import { resolveInviteStatus, serializeAccessInvite } from './_lib/invites';

interface DealerStaffInviteRevokeBody {
  dealerId?: string;
  inviteId?: string;
}

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = event.body ? (JSON.parse(event.body) as DealerStaffInviteRevokeBody) : {};
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const inviteId = getRequiredString(body.inviteId, 'inviteId', 128);
    await requireDealerAccess(profile, dealerId, { requireTeamManagement: true });

    const inviteRef = getAdminFirestore().collection('accessInvites').doc(inviteId);
    const snapshot = await inviteRef.get();
    if (!snapshot.exists) {
      return badRequest('Invite was not found.');
    }

    const existingData = (snapshot.data() ?? {}) as Record<string, unknown>;
    if (existingData.type !== 'dealer_staff' || existingData.dealerId !== dealerId) {
      return badRequest('Invite does not belong to the selected dealer.');
    }

    const resolvedStatus = resolveInviteStatus(existingData);
    if (resolvedStatus !== 'pending') {
      return badRequest(`Only pending invites can be revoked. Current status: ${resolvedStatus}.`);
    }

    await inviteRef.set(
      {
        status: 'revoked',
        revokedBy: profile.uid,
        updatedBy: profile.uid,
        revokedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const savedSnapshot = await inviteRef.get();
    const savedData = (savedSnapshot.data() ?? {}) as Record<string, unknown>;

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'invite.revoked',
      entityType: 'invite',
      entityId: inviteId,
      target: {
        email: typeof existingData.email === 'string' ? existingData.email : null,
      },
      summary: `Revoked a dealer staff invite for ${typeof existingData.email === 'string' ? existingData.email : inviteId}.`,
      before: {
        status: resolvedStatus,
      },
      after: {
        status: 'revoked',
      },
      metadata: {
        inviteType: 'dealer_staff',
        dealerId,
      },
    });

    return json(200, {
      ok: true,
      invite: serializeAccessInvite(inviteId, savedData, event),
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
      return serviceUnavailable('Server-side dealer staff invites are not configured.');
    }
    if (message.includes('required') || message.includes('not found') || message.includes('Current status') || message.includes('selected dealer')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
