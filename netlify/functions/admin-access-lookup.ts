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
import { normalizeUserProfile } from '../../utils/accessControl';

interface AccessLookupBody {
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
    const email = rawQuery.trim().toLowerCase();
    try {
      return await adminAuth.getUserByEmail(email);
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

const getFirestoreUserByQuery = async (rawQuery: string): Promise<DocumentSnapshot | null> => {
  const firestore = getAdminFirestore();

  if (rawQuery.includes('@')) {
    const candidates = Array.from(new Set([rawQuery.trim(), rawQuery.trim().toLowerCase()]));
    for (const email of candidates) {
      const querySnapshot = await firestore
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0] ?? null;
      }
    }
    return null;
  }

  const snapshot = await firestore.collection('users').doc(rawQuery.trim()).get();
  return snapshot.exists ? snapshot : null;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    await requireAdminPermission(event, 'admins.assign_permissions');
    const body = event.body ? (JSON.parse(event.body) as AccessLookupBody) : {};
    const rawQuery = getRequiredString(body.query, 'query', 254);
    const authRecord = await getAuthRecordByQuery(rawQuery);
    const firestoreDoc = authRecord
      ? await getAdminFirestore().collection('users').doc(authRecord.uid).get()
      : await getFirestoreUserByQuery(rawQuery);

    if (!authRecord && !firestoreDoc) {
      return json(404, { error: 'User account not found.' });
    }

    const uid = authRecord?.uid ?? firestoreDoc!.id;
    const email =
      authRecord?.email ??
      (typeof firestoreDoc?.data()?.email === 'string' ? (firestoreDoc.data()!.email as string) : null);
    const profile = normalizeUserProfile(
      { uid, email },
      (firestoreDoc?.data() ?? {}) as Record<string, unknown>,
    );

    return json(200, {
      ok: true,
      user: {
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName ?? authRecord?.displayName ?? null,
        role: profile.role,
        accountType: profile.accountType ?? null,
        accountStatus: profile.accountStatus ?? null,
        adminRoleIds: profile.adminRoleIds ?? [],
        directPermissions: profile.directPermissions ?? {},
        isMasterAdmin: profile.isMasterAdmin ?? false,
        dealerPlanId: profile.dealerPlanId ?? null,
        dealerSubscriptionStatus: profile.dealerSubscriptionStatus ?? null,
      },
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
      return serviceUnavailable('Server-side admin lookups are not configured.');
    }
    if (message.includes('required')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
