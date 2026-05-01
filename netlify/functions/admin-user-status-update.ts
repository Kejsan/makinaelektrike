import { FieldValue } from 'firebase-admin/firestore';
import type { UserRecord } from 'firebase-admin/auth';
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
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminAuth, getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import type { AccountStatus } from '../../types';
import { normalizeUserProfile } from '../../utils/accessControl';

interface UserStatusUpdateBody {
  uid?: string;
  accountStatus?: AccountStatus;
}

const USER_OPERATION_STATUSES = ['active', 'suspended'] as const satisfies readonly AccountStatus[];

const isAuthUserNotFoundError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'auth/user-not-found';

const getAuthUserIfExists = async (uid: string): Promise<UserRecord | null> => {
  try {
    return await getAdminAuth().getUser(uid);
  } catch (error) {
    if (isAuthUserNotFoundError(error)) {
      return null;
    }
    throw error;
  }
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const body = event.body ? (JSON.parse(event.body) as UserStatusUpdateBody) : {};
    const targetStatus = getEnumValue(body.accountStatus, USER_OPERATION_STATUSES, 'accountStatus');
    const requiredPermission = targetStatus === 'suspended' ? 'users.suspend' : 'users.reactivate';
    const { profile } = await requireAdminPermission(event, requiredPermission);
    const uid = getRequiredString(body.uid, 'uid', 128);
    const firestore = getAdminFirestore();
    const userRef = firestore.collection('users').doc(uid);
    const [userSnapshot, authRecord] = await Promise.all([userRef.get(), getAuthUserIfExists(uid)]);

    if (!userSnapshot.exists && !authRecord) {
      return json(404, { error: 'User account not found.' });
    }

    if (uid === profile.uid) {
      return badRequest('You cannot change your own account status through this endpoint.');
    }

    const normalizedProfile = normalizeUserProfile(
      { uid, email: authRecord?.email ?? (typeof userSnapshot.data()?.email === 'string' ? userSnapshot.data()!.email as string : null) },
      (userSnapshot.data() ?? {}) as Record<string, unknown>,
    );

    const isDealerAccount =
      normalizedProfile.accountType === 'dealer' ||
      normalizedProfile.accountType === 'dealer_staff' ||
      normalizedProfile.role === 'dealer' ||
      normalizedProfile.role === 'pending';
    if (isDealerAccount) {
      return badRequest('Dealer and pending accounts must be managed through dealer operations.');
    }

    const isAdminAccount = (normalizedProfile.adminRoleIds?.length ?? 0) > 0 || normalizedProfile.accountType === 'admin';
    if (isAdminAccount && !profile.isMasterAdmin) {
      return forbidden('Only a master admin can change another platform admin account status.');
    }

    if (normalizedProfile.isMasterAdmin && !profile.isMasterAdmin) {
      return forbidden('Only a master admin can change another master admin account status.');
    }

    const previousAccountStatus = normalizedProfile.accountStatus ?? 'active';
    const previousAuthDisabled = authRecord?.disabled ?? false;

    await userRef.set(
      {
        uid,
        email: authRecord?.email ?? normalizedProfile.email ?? null,
        role: normalizedProfile.role ?? 'user',
        accountType: normalizedProfile.accountType ?? (isAdminAccount ? 'admin' : 'user'),
        accountStatus: targetStatus,
        status: targetStatus,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: profile.uid,
      },
      { merge: true },
    );

    if (authRecord) {
      await getAdminAuth().updateUser(uid, {
        disabled: targetStatus === 'suspended',
      });
    }

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'user_status.updated',
      entityType: 'user',
      entityId: uid,
      target: {
        uid,
        email: authRecord?.email ?? normalizedProfile.email ?? null,
      },
      summary: `Changed user account status from ${previousAccountStatus} to ${targetStatus}.`,
      before: {
        accountStatus: previousAccountStatus,
        authDisabled: previousAuthDisabled,
      },
      after: {
        accountStatus: targetStatus,
        authDisabled: targetStatus === 'suspended',
      },
      metadata: {
        wasPlatformAdmin: isAdminAccount,
        hadDealerRelationship: isDealerAccount,
      },
    });

    return json(200, {
      ok: true,
      uid,
      accountStatus: targetStatus,
      authDisabled: targetStatus === 'suspended',
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (
      message.startsWith('Missing required permission') ||
      message.startsWith('Only a master admin')
    ) {
      return forbidden(message);
    }
    if (message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side user status updates are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be one of') ||
      message.includes('must be managed through dealer operations') ||
      message.includes('cannot change your own')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
