import { FieldValue } from 'firebase-admin/firestore';
import type { UserRecord } from 'firebase-admin/auth';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
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
import { getAdminAuth, getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { normalizeUserProfile } from '../../utils/accessControl';
import type { AccountStatus } from '../../types';

interface AdminDealerOwnerUpdateBody {
  dealerId?: string;
  query?: string;
}

const isAuthUserNotFoundError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'auth/user-not-found';

const getAuthRecordByQuery = async (rawQuery: string): Promise<UserRecord | null> => {
  const adminAuth = getAdminAuth();

  if (rawQuery.includes('@')) {
    try {
      return await adminAuth.getUserByEmail(rawQuery.trim().toLowerCase());
    } catch (error) {
      if (isAuthUserNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  try {
    return await adminAuth.getUser(rawQuery.trim());
  } catch (error) {
    if (isAuthUserNotFoundError(error)) {
      return null;
    }
    throw error;
  }
};

const getFirestoreUserByUid = async (uid: string): Promise<DocumentSnapshot> =>
  getAdminFirestore().collection('users').doc(uid).get();

const getLegacyOwnedDealerIds = async (uid: string) => {
  const firestore = getAdminFirestore();
  const [ownedDealersSnapshot, legacyDealerSnapshot] = await Promise.all([
    firestore.collection('dealers').where('ownerUid', '==', uid).get(),
    firestore.collection('dealers').doc(uid).get(),
  ]);

  const ids = new Set<string>(ownedDealersSnapshot.docs.map(doc => doc.id));
  if (legacyDealerSnapshot.exists) {
    ids.add(legacyDealerSnapshot.id);
  }
  return Array.from(ids);
};

const resolveFallbackUserStatus = (currentStatus: AccountStatus | null | undefined): AccountStatus => {
  if (currentStatus === 'suspended' || currentStatus === 'disabled' || currentStatus === 'archived') {
    return currentStatus;
  }

  return 'active';
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'dealers.edit');
    const body = event.body ? (JSON.parse(event.body) as AdminDealerOwnerUpdateBody) : {};
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const rawQuery = getRequiredString(body.query, 'query', 254);
    const firestore = getAdminFirestore();

    const dealerRef = firestore.collection('dealers').doc(dealerId);
    const dealerSnapshot = await dealerRef.get();
    if (!dealerSnapshot.exists) {
      return json(404, { error: 'Dealer not found.' });
    }

    const previousDealerData = (dealerSnapshot.data() ?? {}) as Record<string, unknown>;
    const previousOwnerUid =
      typeof previousDealerData.ownerUid === 'string'
        ? previousDealerData.ownerUid
        : typeof previousDealerData.uid === 'string'
          ? previousDealerData.uid
          : null;

    const authRecord = await getAuthRecordByQuery(rawQuery);
    if (!authRecord) {
      return badRequest('The target owner must already have a registered account.');
    }

    const targetUid = authRecord.uid;
    const targetUserSnapshot = await getFirestoreUserByUid(targetUid);
    const targetRawProfile = (targetUserSnapshot.data() ?? {}) as Record<string, unknown>;
    const targetProfile = normalizeUserProfile(
      { uid: targetUid, email: authRecord.email ?? null },
      targetRawProfile,
    );

    if (targetProfile.adminRoleIds.length > 0 || targetProfile.accountType === 'admin') {
      return badRequest('Platform admin accounts cannot be assigned as dealer owners.');
    }

    if (
      targetProfile.accountType === 'dealer_staff' &&
      typeof targetProfile.dealerId === 'string' &&
      targetProfile.dealerId !== dealerId
    ) {
      return badRequest('This account is already attached as staff to another dealer.');
    }

    const targetOwnedDealerIds = (await getLegacyOwnedDealerIds(targetUid)).filter(id => id !== dealerId);
    if (targetOwnedDealerIds.length > 0) {
      return badRequest('This account already owns another dealer account.');
    }

    const dealerPlanId =
      typeof previousDealerData.planId === 'string' ? previousDealerData.planId : 'free';
    const dealerSubscriptionStatus =
      typeof previousDealerData.subscriptionStatus === 'string'
        ? previousDealerData.subscriptionStatus
        : 'active';

    await dealerRef.update({
      ownerUid: targetUid,
      uid: targetUid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: profile.uid,
    });

    await firestore
      .collection('users')
      .doc(targetUid)
      .set(
        {
          uid: targetUid,
          email: authRecord.email ?? null,
          role: 'dealer',
          accountType: 'dealer',
          accountStatus: 'approved',
          status: 'approved',
          dealerPlanId,
          dealerSubscriptionStatus,
          dealerId: FieldValue.delete(),
          dealerStaffRole: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: profile.uid,
        },
        { merge: true },
      );

    if (previousOwnerUid && previousOwnerUid !== targetUid) {
      const previousOwnerSnapshot = await firestore.collection('users').doc(previousOwnerUid).get();
      if (previousOwnerSnapshot.exists) {
        const previousOwnerProfile = normalizeUserProfile(
          {
            uid: previousOwnerUid,
            email:
              typeof previousOwnerSnapshot.data()?.email === 'string'
                ? (previousOwnerSnapshot.data()?.email as string)
                : null,
          },
          (previousOwnerSnapshot.data() ?? {}) as Record<string, unknown>,
        );

        const remainingOwnedDealerIds = (await getLegacyOwnedDealerIds(previousOwnerUid)).filter(id => id !== dealerId);
        const shouldDemotePreviousOwner =
          previousOwnerProfile.adminRoleIds.length === 0 &&
          previousOwnerProfile.accountType !== 'dealer_staff' &&
          remainingOwnedDealerIds.length === 0;

        if (shouldDemotePreviousOwner) {
          const fallbackStatus = resolveFallbackUserStatus(previousOwnerProfile.accountStatus ?? null);
          await firestore
            .collection('users')
            .doc(previousOwnerUid)
            .set(
              {
                role: 'user',
                accountType: 'user',
                accountStatus: fallbackStatus,
                status: fallbackStatus,
                dealerPlanId: FieldValue.delete(),
                dealerSubscriptionStatus: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: profile.uid,
              },
              { merge: true },
            );
        }
      }
    }

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'dealer_owner.updated',
      entityType: 'dealer',
      entityId: dealerId,
      target: {
        uid: targetUid,
        email: authRecord.email ?? null,
      },
      summary: `Reassigned dealer owner for dealer ${dealerId}.`,
      before: {
        ownerUid: previousOwnerUid,
      },
      after: {
        ownerUid: targetUid,
      },
      metadata: {
        query: rawQuery,
        previousOwnerUid,
        targetPreviousAccountType: targetProfile.accountType ?? null,
        targetPreviousRole: targetProfile.role,
      },
    });

    return json(200, {
      ok: true,
      dealerId,
      ownerUid: targetUid,
      ownerEmail: authRecord.email ?? null,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Missing required permission')) {
      return forbidden(message);
    }
    if (message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side dealer owner updates are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('already owns another dealer') ||
      message.includes('another dealer') ||
      message.includes('registered account') ||
      message.includes('Platform admin accounts cannot be assigned')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
