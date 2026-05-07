import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type {
  AccountStatus,
  AccountType,
  AdminAuditLog,
  AdminEntityNote,
  AdminRoleId,
  UserRole,
} from '../types';

export interface AdminStationLookupActorProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  accountType: AccountType | null;
  accountStatus: AccountStatus | null;
  adminRoleIds: AdminRoleId[];
  isMasterAdmin: boolean;
  authDisabled: boolean;
  emailVerified: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

export interface AdminStationLookupResult {
  station: {
    id: string;
    address: string | null;
    plugTypes: string | null;
    chargingSpeedKw: number | null;
    operator: string | null;
    pricingDetails: string | null;
    googleMapsLink: string | null;
    latitude: number | null;
    longitude: number | null;
    isActive: boolean;
    createdAt: string | null;
    updatedAt: string | null;
    createdByUid: string | null;
    updatedByUid: string | null;
  };
  createdBy: AdminStationLookupActorProfile | null;
  updatedBy: AdminStationLookupActorProfile | null;
  adminNotes: AdminEntityNote[];
  recentAuditLogs: AdminAuditLog[];
}

interface AdminStationLookupResponse {
  ok: true;
  station: AdminStationLookupResult;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const lookupAdminStation = async (stationId: string): Promise<AdminStationLookupResult> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<AdminStationLookupResponse, { stationId: string }>(
    'admin-station-lookup',
    {
      method: 'POST',
      body: { stationId },
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  return response.station;
};
