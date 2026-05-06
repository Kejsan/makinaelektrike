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
import { getRequiredEmail } from './_lib/validation';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { ACCESS_INVITE_TYPES, buildAccessInviteCode, buildInviteExpiryDate, isInviteExpired, serializeAccessInvite } from './_lib/invites';
import type { AdminRoleId } from '../../types';
import { normalizeUserProfile } from '../../utils/accessControl';

interface AdminInviteCreateBody {
  email?: string;
  adminRoleIds?: AdminRoleId[];
}

const ADMIN_ROLE_IDS = [
  'master_admin',
  'platform_ops_admin',
  'dealer_ops_admin',
  'user_support_admin',
  'catalog_admin',
  'charging_admin',
  'content_admin',
  'analyst',
] as const satisfies readonly AdminRoleId[];

const parseAdminRoleIds = (value: unknown): AdminRoleId[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('adminRoleIds is required.');
  }

  return Array.from(
    new Set(
      value.map(item => {
        if (typeof item !== 'string') {
          throw new Error('adminRoleIds entries must be strings.');
        }

        const trimmed = item.trim();
        if (!ADMIN_ROLE_IDS.includes(trimmed as AdminRoleId)) {
          throw new Error(`adminRoleIds must contain only supported roles: ${ADMIN_ROLE_IDS.join(', ')}.`);
        }

        return trimmed as AdminRoleId;
      }),
    ),
  );
};

const findExistingUserByEmail = async (email: string) => {
  const firestore = getAdminFirestore();
  const snapshot = await firestore.collection('users').where('email', '==', email).limit(1).get();
  return snapshot.docs[0] ?? null;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'admins.invite');
    const body = event.body ? (JSON.parse(event.body) as AdminInviteCreateBody) : {};
    const email = getRequiredEmail(body.email, 'email');
    const adminRoleIds = parseAdminRoleIds(body.adminRoleIds);

    if (adminRoleIds.includes('master_admin') && !profile.isMasterAdmin) {
      return forbidden('Only a master admin can invite another master admin.');
    }

    const existingUserDoc = await findExistingUserByEmail(email);
    if (existingUserDoc) {
      const existingProfile = normalizeUserProfile(
        { uid: existingUserDoc.id, email },
        existingUserDoc.data() as Record<string, unknown>,
      );

      if (
        existingProfile.accountType === 'dealer' ||
        existingProfile.accountType === 'dealer_staff' ||
        existingProfile.role === 'dealer' ||
        existingProfile.role === 'pending'
      ) {
        return badRequest('Dealer or pending accounts cannot be invited as platform admins.');
      }

      if ((existingProfile.adminRoleIds?.length ?? 0) > 0) {
        return badRequest('This account already has platform admin access.');
      }
    }

    const firestore = getAdminFirestore();
    const existingInviteSnapshot = await firestore
      .collection('accessInvites')
      .where('type', '==', ACCESS_INVITE_TYPES[0])
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .get();
    const hasPendingInvite = existingInviteSnapshot.docs.some(doc => !isInviteExpired(doc.data() as Record<string, unknown>));
    if (hasPendingInvite) {
      return badRequest('A pending platform admin invite already exists for this email.');
    }

    const inviteId = buildAccessInviteCode();
    const inviteRef = firestore.collection('accessInvites').doc(inviteId);
    await inviteRef.set({
      type: 'platform_admin',
      status: 'pending',
      email,
      adminRoleIds,
      directPermissions: {},
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
      summary: `Created a platform admin invite for ${email}.`,
      before: null,
      after: {
        type: 'platform_admin',
        email,
        adminRoleIds,
        expiresAt: savedData.expiresAt ?? null,
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
    if (message.startsWith('Missing required permission') || message.startsWith('Only a master admin')) {
      return forbidden(message);
    }
    if (message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side admin invites are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must contain only supported roles') ||
      message.includes('cannot be invited') ||
      message.includes('already has platform admin access') ||
      message.includes('pending platform admin invite')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
