import type { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentData } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from './firebaseAdmin';
import type { FunctionEvent } from './http';
import type { PermissionKey, UserProfile } from '../../../types';
import { hasPermission, normalizeUserProfile } from '../../../utils/accessControl';

export interface AuthenticatedAdminContext {
  decodedToken: DecodedIdToken;
  profile: UserProfile;
}

const getAuthorizationHeader = (event: FunctionEvent) => {
  const headers = event.headers ?? {};
  return (
    headers.authorization ??
    headers.Authorization ??
    headers.AUTHORIZATION ??
    null
  );
};

const getBearerToken = (event: FunctionEvent) => {
  const header = getAuthorizationHeader(event);
  if (!header) {
    throw new Error('Missing authorization bearer token.');
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error('Authorization header must use Bearer token format.');
  }

  return match[1]!.trim();
};

const getUserProfileByUid = async (uid: string, email: string | null): Promise<UserProfile> => {
  const firestore = getAdminFirestore();
  const snapshot = await firestore.collection('users').doc(uid).get();
  if (!snapshot.exists) {
    throw new Error('Authenticated admin profile was not found.');
  }

  const rawProfile = (snapshot.data() ?? {}) as DocumentData;
  return normalizeUserProfile({ uid, email }, rawProfile);
};

export const requireAuthenticatedProfile = async (
  event: FunctionEvent,
): Promise<AuthenticatedAdminContext> => {
  const token = getBearerToken(event);
  const decodedToken = await getAdminAuth().verifyIdToken(token);
  const profile = await getUserProfileByUid(decodedToken.uid, decodedToken.email ?? null);

  return {
    decodedToken,
    profile,
  };
};

export const requireAdminPermission = async (
  event: FunctionEvent,
  permission: PermissionKey,
): Promise<AuthenticatedAdminContext> => {
  const context = await requireAuthenticatedProfile(event);
  const { profile } = context;

  if (!hasPermission(profile, permission)) {
    throw new Error(`Missing required permission: ${permission}.`);
  }

  return context;
};
