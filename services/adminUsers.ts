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

export interface AdminUserLookupDealerRelationship {
  id: string;
  name: string;
  status: string | null;
  isActive: boolean;
  isDeleted: boolean;
  planId: DealerPlanId | null;
  subscriptionStatus: DealerSubscriptionStatus | null;
}

export interface AdminUserLookupListingCounts {
  total: number;
  pending: number;
  approved: number;
  active: number;
  inactive: number;
  rejected: number;
  deleted: number;
}

export interface AdminUserLookupResult {
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
  authDisabled: boolean;
  emailVerified: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  relationships: {
    linkedDealers: AdminUserLookupDealerRelationship[];
    listingCounts: AdminUserLookupListingCounts;
    modelCount: number;
    favouriteCount: number;
    enquiryCount: number;
    hasDealerAccount: boolean;
    isPlatformAdmin: boolean;
  };
}

interface AdminUserLookupResponse {
  ok: true;
  user: AdminUserLookupResult;
}

interface AdminUserStatusUpdateResponse {
  ok: true;
  uid: string;
  accountStatus: AccountStatus;
  authDisabled: boolean;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const lookupAdminUser = async (query: string): Promise<AdminUserLookupResult> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<AdminUserLookupResponse, { query: string }>(
    'admin-user-lookup',
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

export const updateAdminUserStatus = async (
  uid: string,
  accountStatus: Extract<AccountStatus, 'active' | 'suspended'>,
): Promise<AdminUserStatusUpdateResponse> => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<
    AdminUserStatusUpdateResponse,
    { uid: string; accountStatus: Extract<AccountStatus, 'active' | 'suspended'> }
  >('admin-user-status-update', {
    method: 'POST',
    body: {
      uid,
      accountStatus,
    },
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
};
