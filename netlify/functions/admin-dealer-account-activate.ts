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
import { getRequiredEmail, getRequiredString } from './_lib/validation';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminAuth, getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { normalizeUserProfile } from '../../utils/accessControl';

interface DealerAccountActivationBody {
  dealerId?: string;
  email?: string;
  password?: string;
}

const isAuthErrorCode = (error: unknown, code: string) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === code;

const isUserNotFoundError = (error: unknown) =>
  isAuthErrorCode(error, 'auth/user-not-found') ||
  ((error as Error)?.message ?? '').includes('There is no user record');

const assertDealerCanActivateAccount = (dealerData: Record<string, unknown>) => {
  const isDeleted = dealerData.isDeleted === true || dealerData.status === 'deleted';
  const isRejected = dealerData.status === 'rejected';
  const isApproved = dealerData.approved === true || dealerData.status === 'approved';

  if (isDeleted || isRejected || !isApproved) {
    throw new Error('Only approved dealer accounts can be activated.');
  }
};

const assertNotPlatformAdmin = (
  profileData: Record<string, unknown>,
  uid: string,
  email: string | null,
) => {
  const normalized = normalizeUserProfile({ uid, email }, profileData);
  if (normalized.adminRoleIds.length > 0 || normalized.accountType === 'admin') {
    throw new Error('Platform admin accounts cannot be linked to a dealer login.');
  }
};

const createOrUpdateLinkedAuthUser = async (options: {
  linkedUid: string | null;
  dealerName: string | null;
  email: string;
  password: string;
}) => {
  const adminAuth = getAdminAuth();
  const displayName = options.dealerName ?? undefined;

  if (options.linkedUid) {
    try {
      await adminAuth.getUser(options.linkedUid);
      const updated = await adminAuth.updateUser(options.linkedUid, {
        email: options.email,
        password: options.password,
        displayName,
        disabled: false,
      });
      return { mode: 'updated' as const, userRecord: updated };
    } catch (error) {
      if (!isUserNotFoundError(error)) {
        throw error;
      }

      const recreated = await adminAuth.createUser({
        uid: options.linkedUid,
        email: options.email,
        password: options.password,
        displayName,
        disabled: false,
      });
      return { mode: 'recreated' as const, userRecord: recreated };
    }
  }

  const created = await adminAuth.createUser({
    email: options.email,
    password: options.password,
    displayName,
    disabled: false,
  });
  return { mode: 'created' as const, userRecord: created };
};

const buildUserProfileUpsert = (
  userRecord: UserRecord,
  profileUid: string,
  existingData: Record<string, unknown> | null,
) => ({
  uid: userRecord.uid,
  email: userRecord.email ?? null,
  role: 'dealer',
  accountType: 'dealer',
  accountStatus: 'approved',
  status: 'approved',
  ...(existingData?.dealerPlanId ? {} : { dealerPlanId: 'free' }),
  ...(existingData?.dealerSubscriptionStatus
    ? {}
    : { dealerSubscriptionStatus: 'active' }),
  ...(existingData ? {} : { createdAt: FieldValue.serverTimestamp() }),
  updatedAt: FieldValue.serverTimestamp(),
  updatedBy: profileUid,
});

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'dealers.edit');
    const body = event.body ? (JSON.parse(event.body) as DealerAccountActivationBody) : {};
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const email = getRequiredEmail(body.email, 'email');
    const password = getRequiredString(body.password, 'password', 256);

    if (password.length < 6) {
      return badRequest('Password must be at least 6 characters.');
    }

    const firestore = getAdminFirestore();
    const dealerRef = firestore.collection('dealers').doc(dealerId);
    const dealerSnapshot = await dealerRef.get();
    if (!dealerSnapshot.exists) {
      return json(404, { error: 'Dealer not found.' });
    }

    const previousDealerData = (dealerSnapshot.data() ?? {}) as Record<string, unknown>;
    assertDealerCanActivateAccount(previousDealerData);

    const previousLinkedUid =
      typeof previousDealerData.ownerUid === 'string'
        ? previousDealerData.ownerUid
        : typeof previousDealerData.uid === 'string'
          ? previousDealerData.uid
          : null;

    const userQuerySnapshot = await firestore
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    const existingUserDocByEmail = userQuerySnapshot.docs[0] ?? null;

    if (existingUserDocByEmail && existingUserDocByEmail.id !== previousLinkedUid) {
      assertNotPlatformAdmin(
        (existingUserDocByEmail.data() ?? {}) as Record<string, unknown>,
        existingUserDocByEmail.id,
        email,
      );
      return badRequest('This email is already registered.');
    }

    if (!previousLinkedUid) {
      try {
        const existingAuthUser = await getAdminAuth().getUserByEmail(email);
        return badRequest(
          existingAuthUser.uid === previousLinkedUid
            ? 'This email is already associated with the linked dealer account.'
            : 'This email is already registered.',
        );
      } catch (error) {
        if (!isUserNotFoundError(error)) {
          throw error;
        }
      }
    }

    if (previousLinkedUid) {
      const linkedUserSnapshot = await firestore.collection('users').doc(previousLinkedUid).get();
      if (linkedUserSnapshot.exists) {
        assertNotPlatformAdmin(
          (linkedUserSnapshot.data() ?? {}) as Record<string, unknown>,
          previousLinkedUid,
          typeof linkedUserSnapshot.data()?.email === 'string'
            ? (linkedUserSnapshot.data()?.email as string)
            : email,
        );
      }
    }

    const dealerName =
      typeof previousDealerData.name === 'string' ? previousDealerData.name : null;

    let activationResult:
      | { mode: 'created' | 'updated' | 'recreated'; userRecord: UserRecord };
    try {
      activationResult = await createOrUpdateLinkedAuthUser({
        linkedUid: previousLinkedUid,
        dealerName,
        email,
        password,
      });
    } catch (error) {
      if (isAuthErrorCode(error, 'auth/email-already-exists')) {
        return badRequest('This email is already registered.');
      }
      throw error;
    }

    const linkedUid = activationResult.userRecord.uid;
    const linkedUserRef = firestore.collection('users').doc(linkedUid);
    const linkedUserSnapshot = await linkedUserRef.get();
    const previousUserData = linkedUserSnapshot.exists
      ? ((linkedUserSnapshot.data() ?? {}) as Record<string, unknown>)
      : null;

    await dealerRef.update({
      ownerUid: linkedUid,
      uid: linkedUid,
      contact_email: email,
      email,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: profile.uid,
    });

    await linkedUserRef.set(
      buildUserProfileUpsert(activationResult.userRecord, profile.uid, previousUserData),
      { merge: true },
    );

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'dealer_account.updated',
      entityType: 'dealer',
      entityId: dealerId,
      target: {
        uid: linkedUid,
        email,
      },
      summary:
        activationResult.mode === 'created'
          ? `Created dealer login for dealer ${dealerId}.`
          : activationResult.mode === 'recreated'
            ? `Recreated missing auth login for dealer ${dealerId}.`
            : `Updated dealer login credentials for dealer ${dealerId}.`,
      before: {
        ownerUid: previousDealerData.ownerUid ?? previousDealerData.uid ?? null,
        contact_email: previousDealerData.contact_email ?? previousDealerData.email ?? null,
        linkedUserStatus: previousUserData?.status ?? null,
      },
      after: {
        ownerUid: linkedUid,
        contact_email: email,
        linkedUserStatus: 'approved',
      },
      metadata: {
        activationMode: activationResult.mode,
        previousLinkedUid,
      },
    });

    return json(200, {
      ok: true,
      dealerId,
      uid: linkedUid,
      email,
      mode: activationResult.mode,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (
      message.startsWith('Missing required permission') ||
      message.includes('Platform admin accounts cannot be linked')
    ) {
      return forbidden(message);
    }
    if (message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side dealer account activation is not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be a valid email') ||
      message.includes('Password must be at least 6 characters') ||
      message.includes('Only approved dealer accounts can be activated') ||
      message.includes('already registered')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
