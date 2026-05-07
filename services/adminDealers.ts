import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type {
  AccessInvite,
  AccountStatus,
  AccountType,
  AdminAuditLog,
  AdminEntityListingSummary,
  AdminEntityNote,
  AdminRoleId,
  DealerPlanId,
  DealerStaffRole,
  DealerSubscriptionStatus,
  UserRole,
} from '../types';

export interface AdminDealerLookupOwnerProfile {
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

export interface AdminDealerLookupListingCounts {
  total: number;
  pending: number;
  approved: number;
  active: number;
  inactive: number;
  rejected: number;
  deleted: number;
}

export interface AdminDealerLookupStaffMember {
  uid: string;
  email: string | null;
  displayName: string | null;
  accountStatus: string | null;
  dealerStaffRole: DealerStaffRole | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminDealerLookupResult {
  dealer: {
    id: string;
    name: string;
    status: string | null;
    isActive: boolean;
    isDeleted: boolean;
    planId: DealerPlanId | null;
    subscriptionStatus: DealerSubscriptionStatus | null;
    ownerUid: string | null;
    ownerEmail: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    city: string | null;
    address: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  owner: AdminDealerLookupOwnerProfile | null;
  relationships: {
    listingCounts: AdminDealerLookupListingCounts;
    recentListings: AdminEntityListingSummary[];
    modelCount: number;
    enquiryCount: number;
  };
  capacity: {
    maxTeamAccounts: number;
    ownerCount: number;
    activeStaffCount: number;
    pendingInviteCount: number;
    remainingSlots: number;
  };
  staffMembers: AdminDealerLookupStaffMember[];
  invites: AccessInvite[];
  adminNotes: AdminEntityNote[];
  recentAuditLogs: AdminAuditLog[];
}

interface AdminDealerLookupResponse {
  ok: true;
  dealer: AdminDealerLookupResult;
}

interface AdminDealerOwnerUpdateResponse {
  ok: true;
  dealerId: string;
  ownerUid: string;
  ownerEmail: string | null;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const lookupAdminDealer = async (dealerId: string): Promise<AdminDealerLookupResult> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<AdminDealerLookupResponse, { dealerId: string }>(
    'admin-dealer-lookup',
    {
      method: 'POST',
      body: { dealerId },
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  return response.dealer;
};

export const updateAdminDealerOwner = async (payload: {
  dealerId: string;
  query: string;
}): Promise<AdminDealerOwnerUpdateResponse> => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<AdminDealerOwnerUpdateResponse, { dealerId: string; query: string }>(
    'admin-dealer-owner-update',
    {
      method: 'POST',
      body: payload,
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );
};
