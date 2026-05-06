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
import { resolveInviteStatus, serializeAccessInvite } from './_lib/invites';
import { normalizeUserProfile } from '../../utils/accessControl';

interface AccessInviteAcceptBody {
  code?: string;
}

const normalizeEmail = (value: string | null | undefined) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

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
    const body = event.body ? (JSON.parse(event.body) as AccessInviteAcceptBody) : {};
    const inviteId = getRequiredString(body.code, 'code', 128);
    const signedInEmail = normalizeEmail(profile.email);
    if (!signedInEmail) {
      return badRequest('The signed-in account does not have a usable email address.');
    }

    const firestore = getAdminFirestore();
    const inviteRef = firestore.collection('accessInvites').doc(inviteId);
    const inviteSnapshot = await inviteRef.get();
    if (!inviteSnapshot.exists) {
      return badRequest('Invite not found.');
    }

    const inviteData = (inviteSnapshot.data() ?? {}) as Record<string, unknown>;
    const resolvedStatus = resolveInviteStatus(inviteData);
    if (resolvedStatus !== 'pending') {
      return badRequest(`This invite is no longer pending. Current status: ${resolvedStatus}.`);
    }

    const inviteEmail = normalizeEmail(typeof inviteData.email === 'string' ? inviteData.email : null);
    if (!inviteEmail || signedInEmail !== inviteEmail) {
      return badRequest('Sign in with the invited email address before accepting this invite.');
    }

    const targetUserRef = firestore.collection('users').doc(profile.uid);
    const targetUserSnapshot = await targetUserRef.get();
    const latestProfile = normalizeUserProfile(
      { uid: profile.uid, email: profile.email },
      (targetUserSnapshot.data() ?? {}) as Record<string, unknown>,
    );

    if (inviteData.type === 'platform_admin') {
      if (
        latestProfile.accountType === 'dealer' ||
        latestProfile.accountType === 'dealer_staff' ||
        latestProfile.role === 'dealer' ||
        latestProfile.role === 'pending'
      ) {
        return badRequest('Dealer-linked accounts cannot accept platform admin invites.');
      }
      if ((latestProfile.adminRoleIds?.length ?? 0) > 0) {
        return badRequest('This account already has platform admin access.');
      }

      const adminRoleIds = Array.isArray(inviteData.adminRoleIds) ? inviteData.adminRoleIds : [];
      const isMasterAdmin = adminRoleIds.includes('master_admin');

      await targetUserRef.set(
        {
          uid: profile.uid,
          email: profile.email ?? null,
          role: 'admin',
          accountType: 'admin',
          accountStatus: 'active',
          status: 'active',
          adminRoleIds,
          directPermissions:
            inviteData.directPermissions && typeof inviteData.directPermissions === 'object'
              ? inviteData.directPermissions
              : {},
          isMasterAdmin,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: profile.uid,
        },
        { merge: true },
      );

      await writeAdminAuditLog({
        actor: buildAuditActor(latestProfile),
        action: 'admin_access.updated',
        entityType: 'user',
        entityId: profile.uid,
        target: {
          uid: profile.uid,
          email: profile.email,
        },
        summary: `Accepted platform admin access for ${profile.email ?? profile.uid}.`,
        before: {
          role: latestProfile.role,
          accountType: latestProfile.accountType ?? null,
          adminRoleIds: latestProfile.adminRoleIds ?? [],
        },
        after: {
          role: 'admin',
          accountType: 'admin',
          adminRoleIds,
          isMasterAdmin,
        },
        metadata: {
          source: 'invite_accept',
          inviteId,
        },
      });
    } else if (inviteData.type === 'dealer_staff') {
      const dealerId = typeof inviteData.dealerId === 'string' ? inviteData.dealerId : null;
      if (!dealerId) {
        return badRequest('Dealer staff invite is missing a dealer reference.');
      }

      const dealerSnapshot = await firestore.collection('dealers').doc(dealerId).get();
      if (!dealerSnapshot.exists || !isDealerActive((dealerSnapshot.data() ?? {}) as Record<string, unknown>)) {
        return badRequest('The target dealer is no longer eligible for staff invites.');
      }

      if (
        (latestProfile.adminRoleIds?.length ?? 0) > 0 ||
        latestProfile.accountType === 'dealer' ||
        latestProfile.role === 'dealer' ||
        latestProfile.role === 'pending' ||
        (latestProfile.accountType === 'dealer_staff' && latestProfile.dealerId !== dealerId)
      ) {
        return badRequest('This account cannot accept the selected dealer staff invite.');
      }

      if (latestProfile.accountType === 'dealer_staff' && latestProfile.dealerId === dealerId) {
        return badRequest('This account is already linked to the selected dealer.');
      }

      await targetUserRef.set(
        {
          uid: profile.uid,
          email: profile.email ?? null,
          role: 'dealer',
          accountType: 'dealer_staff',
          accountStatus: 'approved',
          status: 'approved',
          dealerId,
          dealerStaffRole: typeof inviteData.dealerStaffRole === 'string' ? inviteData.dealerStaffRole : 'manager',
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: profile.uid,
        },
        { merge: true },
      );

      await writeAdminAuditLog({
        actor: buildAuditActor(latestProfile),
        action: 'dealer_staff.updated',
        entityType: 'user',
        entityId: profile.uid,
        target: {
          uid: profile.uid,
          email: profile.email,
        },
        summary: `Accepted dealer staff access for ${profile.email ?? profile.uid}.`,
        before: {
          role: latestProfile.role,
          accountType: latestProfile.accountType ?? null,
          dealerId: latestProfile.dealerId ?? null,
          dealerStaffRole: latestProfile.dealerStaffRole ?? null,
        },
        after: {
          role: 'dealer',
          accountType: 'dealer_staff',
          dealerId,
          dealerStaffRole: typeof inviteData.dealerStaffRole === 'string' ? inviteData.dealerStaffRole : 'manager',
        },
        metadata: {
          source: 'invite_accept',
          inviteId,
        },
      });
    } else {
      return badRequest('Unsupported invite type.');
    }

    await inviteRef.set(
      {
        status: 'accepted',
        acceptedBy: profile.uid,
        acceptedAt: FieldValue.serverTimestamp(),
        updatedBy: profile.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const savedInviteSnapshot = await inviteRef.get();
    const savedInviteData = (savedInviteSnapshot.data() ?? {}) as Record<string, unknown>;

    await writeAdminAuditLog({
      actor: buildAuditActor(latestProfile),
      action: 'invite.accepted',
      entityType: 'invite',
      entityId: inviteId,
      target: {
        uid: profile.uid,
        email: profile.email,
      },
      summary: `Accepted invite ${inviteId}.`,
      before: {
        status: resolvedStatus,
      },
      after: {
        status: 'accepted',
      },
      metadata: {
        inviteType: inviteData.type,
      },
    });

    return json(200, {
      ok: true,
      invite: serializeAccessInvite(inviteId, savedInviteData, event),
      nextPath: inviteData.type === 'platform_admin' ? '/admin' : '/dealer/dashboard',
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Invite acceptance is not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('Invite not found') ||
      message.includes('Current status') ||
      message.includes('email address') ||
      message.includes('cannot accept') ||
      message.includes('already has platform admin access') ||
      message.includes('already linked to the selected dealer') ||
      message.includes('no longer eligible') ||
      message.includes('missing a dealer reference') ||
      message.includes('Unsupported invite type')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
