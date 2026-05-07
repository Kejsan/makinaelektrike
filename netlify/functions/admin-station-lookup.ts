import type { UserRecord } from 'firebase-admin/auth';
import type { DocumentData } from 'firebase-admin/firestore';
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
import { getAdminAuth, getAdminFirestore } from './_lib/firebaseAdmin';
import {
  listAdminEntityNotes,
  listRecentAdminAuditLogsForEntity,
  serializeTimestamp,
} from './_lib/adminEntityDetails';
import { hasPermission, normalizeUserProfile } from '../../utils/accessControl';

interface AdminStationLookupBody {
  stationId?: string;
}

const isAuthUserNotFoundError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'auth/user-not-found';

const getAuthRecord = async (uid: string): Promise<UserRecord | null> => {
  try {
    return await getAdminAuth().getUser(uid);
  } catch (error) {
    if (isAuthUserNotFoundError(error)) {
      return null;
    }
    throw error;
  }
};

const buildActorProfile = async (uid: string | null) => {
  if (!uid) {
    return null;
  }

  const firestore = getAdminFirestore();
  const [profileSnapshot, authRecord] = await Promise.all([
    firestore.collection('users').doc(uid).get(),
    getAuthRecord(uid),
  ]);

  const profileData = (profileSnapshot.data() ?? {}) as Record<string, unknown>;
  const normalizedProfile = profileSnapshot.exists
    ? normalizeUserProfile(
        {
          uid,
          email:
            authRecord?.email ??
            (typeof profileData.email === 'string' ? profileData.email : null),
        },
        profileData,
      )
    : null;

  return {
    uid,
    email:
      normalizedProfile?.email ??
      authRecord?.email ??
      (typeof profileData.email === 'string' ? profileData.email : null),
    displayName:
      normalizedProfile?.displayName ??
      authRecord?.displayName ??
      (typeof profileData.displayName === 'string' ? profileData.displayName : null),
    role: normalizedProfile?.role ?? 'user',
    accountType: normalizedProfile?.accountType ?? null,
    accountStatus: normalizedProfile?.accountStatus ?? null,
    adminRoleIds: normalizedProfile?.adminRoleIds ?? [],
    isMasterAdmin: normalizedProfile?.isMasterAdmin ?? false,
    authDisabled: authRecord?.disabled ?? false,
    emailVerified: authRecord?.emailVerified ?? false,
    createdAt: authRecord?.metadata.creationTime ?? null,
    lastSignInAt: authRecord?.metadata.lastSignInTime ?? null,
  };
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const canReadStations =
      hasPermission(profile, 'stations.read') ||
      hasPermission(profile, 'stations.edit') ||
      hasPermission(profile, 'stations.merge');

    if (!canReadStations) {
      throw new Error('Missing required permission: stations.read.');
    }

    const body = event.body ? (JSON.parse(event.body) as AdminStationLookupBody) : {};
    const stationId = getRequiredString(body.stationId, 'stationId', 128);
    const firestore = getAdminFirestore();
    const stationSnapshot = await firestore.collection('charging_stations').doc(stationId).get();

    if (!stationSnapshot.exists) {
      return json(404, { error: 'Charging station not found.' });
    }

    const stationData = (stationSnapshot.data() ?? {}) as DocumentData;
    const createdByUid = typeof stationData.createdBy === 'string' ? stationData.createdBy : null;
    const updatedByUid = typeof stationData.updatedBy === 'string' ? stationData.updatedBy : null;

    const [createdBy, updatedBy, adminNotes, recentAuditLogs] = await Promise.all([
      buildActorProfile(createdByUid),
      buildActorProfile(updatedByUid),
      listAdminEntityNotes({ entityType: 'charging_station', entityId: stationId, limit: 12 }),
      listRecentAdminAuditLogsForEntity({
        entityType: 'charging_station',
        entityId: stationId,
        limit: 10,
      }),
    ]);

    return json(200, {
      ok: true,
      station: {
        station: {
          id: stationId,
          address: typeof stationData.address === 'string' ? stationData.address : null,
          plugTypes: typeof stationData.plugTypes === 'string' ? stationData.plugTypes : null,
          chargingSpeedKw:
            typeof stationData.chargingSpeedKw === 'number' ? stationData.chargingSpeedKw : null,
          operator: typeof stationData.operator === 'string' ? stationData.operator : null,
          pricingDetails:
            typeof stationData.pricingDetails === 'string' ? stationData.pricingDetails : null,
          googleMapsLink:
            typeof stationData.googleMapsLink === 'string' ? stationData.googleMapsLink : null,
          latitude: typeof stationData.latitude === 'number' ? stationData.latitude : null,
          longitude: typeof stationData.longitude === 'number' ? stationData.longitude : null,
          isActive: stationData.isActive !== false,
          createdAt: serializeTimestamp(stationData.createdAt),
          updatedAt: serializeTimestamp(stationData.updatedAt),
          createdByUid,
          updatedByUid,
        },
        createdBy,
        updatedBy,
        adminNotes,
        recentAuditLogs,
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
      return serviceUnavailable('Server-side charging-station control lookups are not configured.');
    }
    if (message.includes('required')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
