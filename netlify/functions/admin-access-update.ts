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
import { getOptionalString, getRequiredEmail, getEnumValue } from './_lib/validation';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminAuth, getAdminFirestore } from './_lib/firebaseAdmin';
import type { AccountStatus, AdminRoleId, PermissionOverrides } from '../../types';
import { normalizePermissionOverrides, normalizeUserProfile } from '../../utils/accessControl';

interface AdminAccessUpdateBody {
  uid?: string;
  email?: string;
  adminRoleIds?: AdminRoleId[];
  directPermissions?: PermissionOverrides;
  accountStatus?: AccountStatus;
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

const ADMIN_ACCOUNT_STATUSES = [
  'active',
  'suspended',
  'disabled',
  'archived',
] as const satisfies readonly AccountStatus[];

const parseAdminRoleIds = (value: unknown): AdminRoleId[] => {
  if (!Array.isArray(value)) {
    throw new Error('adminRoleIds must be an array.');
  }

  const normalized = Array.from(
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

  return normalized;
};

const parseDirectPermissions = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('directPermissions must be an object when provided.');
  }

  return normalizePermissionOverrides(value);
};

const resolveTargetAccount = async (body: AdminAccessUpdateBody) => {
  const firestore = getAdminFirestore();
  const auth = getAdminAuth();
  const uid = getOptionalString(body.uid, { field: 'uid', maxLength: 128 });
  const email = body.email !== undefined ? getRequiredEmail(body.email, 'email') : undefined;

  if (!uid && !email) {
    throw new Error('uid or email is required.');
  }

  let targetUid = uid;
  let targetEmail: string | null = email ?? null;
  let accountFound = false;

  if (uid) {
    try {
      const authRecord = await auth.getUser(uid);
      targetUid = authRecord.uid;
      targetEmail = authRecord.email ?? targetEmail;
      accountFound = true;
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (!message.includes('There is no user record')) {
        throw error;
      }
    }
  }

  if (!targetUid && email) {
    try {
      const authRecord = await auth.getUserByEmail(email);
      targetUid = authRecord.uid;
      targetEmail = authRecord.email ?? email;
      accountFound = true;
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (!message.includes('There is no user record')) {
        throw error;
      }
    }
  }

  if (!targetUid && email) {
    const querySnapshot = await firestore
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    const doc = querySnapshot.docs[0];
    if (doc) {
      targetUid = doc.id;
      targetEmail = email;
      accountFound = true;
    }
  }

  if (!targetUid) {
    throw new Error('Target user account was not found.');
  }

  const userRef = firestore.collection('users').doc(targetUid);
  const snapshot = await userRef.get();
  const existingData = (snapshot.data() ?? {}) as Record<string, unknown>;
  accountFound = accountFound || snapshot.exists;

  if (!accountFound) {
    throw new Error('Target user account was not found.');
  }

  if (!targetEmail && typeof existingData.email === 'string') {
    targetEmail = existingData.email;
  }

  return {
    targetUid,
    targetEmail,
    userRef,
    snapshot,
    existingData,
  };
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'admins.assign_permissions');
    const body = event.body ? (JSON.parse(event.body) as AdminAccessUpdateBody) : {};
    const adminRoleIds = parseAdminRoleIds(body.adminRoleIds);
    const directPermissions = parseDirectPermissions(body.directPermissions);
    const accountStatus =
      body.accountStatus !== undefined
        ? getEnumValue(body.accountStatus, ADMIN_ACCOUNT_STATUSES, 'accountStatus')
        : undefined;
    const { targetUid, targetEmail, userRef, existingData } = await resolveTargetAccount(body);

    if (targetUid === profile.uid) {
      return badRequest('Self access changes are not supported through this endpoint yet.');
    }

    const existingProfile = normalizeUserProfile(
      { uid: targetUid, email: targetEmail ?? null },
      existingData,
    );

    if (
      existingProfile.accountType === 'dealer' ||
      existingProfile.accountType === 'dealer_staff' ||
      existingProfile.role === 'dealer' ||
      existingProfile.role === 'pending'
    ) {
      return badRequest('Dealer or pending accounts cannot be promoted to platform admin through this endpoint.');
    }

    if (adminRoleIds.includes('master_admin') && !profile.isMasterAdmin) {
      return forbidden('Only a master admin can grant the master_admin role.');
    }

    if (
      (existingProfile.isMasterAdmin || existingProfile.adminRoleIds?.includes('master_admin')) &&
      !profile.isMasterAdmin
    ) {
      return forbidden('Only a master admin can modify another master admin.');
    }

    if (directPermissions !== undefined && !profile.isMasterAdmin) {
      return forbidden('Only a master admin can set direct permission overrides.');
    }

    const nextAccountStatus = accountStatus ?? existingProfile.accountStatus ?? 'active';
    const nextDirectPermissions =
      directPermissions ?? (adminRoleIds.length > 0 ? existingProfile.directPermissions ?? {} : {});
    const isMasterAdmin = adminRoleIds.includes('master_admin');

    await userRef.set(
      {
        uid: targetUid,
        email: targetEmail ?? null,
        role: adminRoleIds.length > 0 ? 'admin' : 'user',
        accountType: adminRoleIds.length > 0 ? 'admin' : 'user',
        accountStatus: nextAccountStatus,
        status: nextAccountStatus,
        adminRoleIds,
        directPermissions: nextDirectPermissions,
        isMasterAdmin,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: profile.uid,
      },
      { merge: true },
    );

    return json(200, {
      ok: true,
      uid: targetUid,
      email: targetEmail ?? null,
      role: adminRoleIds.length > 0 ? 'admin' : 'user',
      accountStatus: nextAccountStatus,
      adminRoleIds,
      directPermissions: nextDirectPermissions,
      isMasterAdmin,
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
      return serviceUnavailable('Server-side admin updates are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be one of') ||
      message.includes('must be an array') ||
      message.includes('must contain only supported roles') ||
      message.includes('cannot be promoted') ||
      message.includes('Target user account was not found') ||
      message.includes('Self access changes')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
