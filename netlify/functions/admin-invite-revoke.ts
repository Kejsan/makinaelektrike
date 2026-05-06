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
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { resolveInviteStatus, serializeAccessInvite } from './_lib/invites';

interface AdminInviteRevokeBody {
  inviteId?: string;
}

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'admins.invite');
    const body = event.body ? (JSON.parse(event.body) as AdminInviteRevokeBody) : {};
    const inviteId = getRequiredString(body.inviteId, 'inviteId', 128);
    const inviteRef = getAdminFirestore().collection('accessInvites').doc(inviteId);
    const snapshot = await inviteRef.get();

    if (!snapshot.exists) {
      return badRequest('Invite was not found.');
    }

    const existingData = (snapshot.data() ?? {}) as Record<string, unknown>;
    if (existingData.type !== 'platform_admin') {
      return badRequest('Invite type is not revocable through this endpoint.');
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
      summary: `Revoked a platform admin invite for ${typeof existingData.email === 'string' ? existingData.email : inviteId}.`,
      before: {
        status: resolvedStatus,
      },
      after: {
        status: 'revoked',
      },
      metadata: {
        inviteType: 'platform_admin',
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
    if (message.startsWith('Missing required permission') || message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side admin invites are not configured.');
    }
    if (message.includes('required') || message.includes('not found') || message.includes('revoked') || message.includes('Current status')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
