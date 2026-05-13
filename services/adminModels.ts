import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type {
  AccountStatus,
  AccountType,
  AdminAuditLog,
  AdminEntityListingSummary,
  AdminEntityNote,
  AdminRoleId,
  DealerPlanId,
  DealerSubscriptionStatus,
  ModelReviewStatus,
  UserRole,
} from '../types';

export interface AdminModelLookupOwnerProfile {
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

export interface AdminModelLookupDealerProfile {
  id: string;
  name: string;
  status: string | null;
  isActive: boolean;
  isDeleted: boolean;
  planId: DealerPlanId | null;
  subscriptionStatus?: DealerSubscriptionStatus | null;
  ownerUid?: string | null;
}

export interface AdminModelLookupListingCounts {
  total: number;
  pending: number;
  approved: number;
  active: number;
  inactive: number;
  rejected: number;
  deleted: number;
}

export interface AdminModelLookupResult {
  model: {
    id: string;
    brand: string | null;
    modelName: string | null;
    source: string | null;
    ownerDealerId: string | null;
    ownerUid: string | null;
    isActive: boolean;
    isFeatured: boolean;
    reviewStatus: ModelReviewStatus;
    bodyType: string | null;
    rangeWltp: number | null;
    batteryCapacity: number | null;
    powerKw: number | null;
    seats: number | null;
    chargePort: string | null;
    imageCount: number;
    galleryCount: number;
    heroImageUrl: string | null;
    notes: string | null;
    reviewRequestedAt: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    reviewNotes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  ownerDealer: AdminModelLookupDealerProfile | null;
  owner: AdminModelLookupOwnerProfile | null;
  relationships: {
    dealerCount: number;
    activeDealerCount: number;
    listingCounts: AdminModelLookupListingCounts;
    recentDealers: AdminModelLookupDealerProfile[];
    recentListings: AdminEntityListingSummary[];
  };
  adminNotes: AdminEntityNote[];
  recentAuditLogs: AdminAuditLog[];
}

interface AdminModelLookupResponse {
  ok: true;
  model: AdminModelLookupResult;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const lookupAdminModel = async (modelId: string): Promise<AdminModelLookupResult> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<AdminModelLookupResponse, { modelId: string }>(
    'admin-model-lookup',
    {
      method: 'POST',
      body: { modelId },
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  return response.model;
};
