import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type {
  AccountStatus,
  AccountType,
  AdminRoleId,
  DealerPlanId,
  DealerSubscriptionStatus,
  PermissionOverrides,
  UserRole,
} from '../types';

export interface AdminAccessLookupResult {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  accountType: AccountType | null;
  accountStatus: AccountStatus | null;
  adminRoleIds: AdminRoleId[];
  directPermissions: PermissionOverrides;
  isMasterAdmin: boolean;
  dealerPlanId: DealerPlanId | null;
  dealerSubscriptionStatus: DealerSubscriptionStatus | null;
}

interface AdminAccessLookupResponse {
  ok: true;
  user: AdminAccessLookupResult;
}

export interface AdminAccessUpdatePayload {
  uid?: string;
  email?: string;
  adminRoleIds: AdminRoleId[];
  directPermissions?: PermissionOverrides;
  accountStatus?: AccountStatus;
}

export interface AdminAccessUpdateResponse {
  ok: true;
  uid: string;
  email: string | null;
  role: 'admin' | 'user';
  accountStatus: AccountStatus;
  adminRoleIds: AdminRoleId[];
  directPermissions: PermissionOverrides;
  isMasterAdmin: boolean;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const updateAdminAccess = async (
  payload: AdminAccessUpdatePayload,
): Promise<AdminAccessUpdateResponse> => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<AdminAccessUpdateResponse, AdminAccessUpdatePayload>(
    'admin-access-update',
    {
      method: 'POST',
      body: payload,
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );
};

export const lookupAdminAccess = async (query: string): Promise<AdminAccessLookupResult> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<AdminAccessLookupResponse, { query: string }>(
    'admin-access-lookup',
    {
      method: 'POST',
      body: { query },
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  return response.user;
};
