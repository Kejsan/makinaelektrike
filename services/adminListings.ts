import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type {
  AccountStatus,
  AccountType,
  AdminAuditLog,
  AdminEntityNote,
  AdminRoleId,
  DealerPlanId,
  DealerSubscriptionStatus,
  ListingModelProfileChangeReason,
  ListingModelProfileSnapshot,
  UserRole,
} from '../types';

export interface AdminListingLookupOwnerProfile {
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

export interface AdminListingLookupDealerProfile {
  id: string;
  name: string;
  status: string | null;
  isActive: boolean;
  isDeleted: boolean;
  planId: DealerPlanId | null;
  subscriptionStatus: DealerSubscriptionStatus | null;
  ownerUid: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface AdminListingLookupResult {
  listing: {
    id: string;
    title: string;
    status: string | null;
    dealerId: string | null;
    ownerUid: string | null;
    modelId: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    mileage: number | null;
    bodyType: string | null;
    fuelType: string | null;
    batteryCapacity: number | null;
    range: number | null;
    modelProfileChangeReason: ListingModelProfileChangeReason | null;
    modelProfileChangeNotes: string | null;
    modelProfileChangeFields: string[];
    modelProfileSnapshot: ListingModelProfileSnapshot | null;
    price: number | null;
    priceCurrency: string | null;
    locationAddress: string | null;
    locationCity: string | null;
    imageCount: number;
    galleryCount: number;
    primaryImageUrl: string | null;
    videoUrl: string | null;
    isFeatured: boolean;
    isForRent: boolean;
    isForSubscription: boolean;
    rejectionReason: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  dealer: AdminListingLookupDealerProfile | null;
  owner: AdminListingLookupOwnerProfile | null;
  model: {
    id: string;
    brand: string | null;
    modelName: string | null;
    isActive: boolean;
  } | null;
  relationships: {
    enquiryCount: number;
    newEnquiryCount: number;
    readEnquiryCount: number;
    repliedEnquiryCount: number;
    archivedEnquiryCount: number;
  };
  adminNotes: AdminEntityNote[];
  recentAuditLogs: AdminAuditLog[];
}

interface AdminListingLookupResponse {
  ok: true;
  listing: AdminListingLookupResult;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const lookupAdminListing = async (listingId: string): Promise<AdminListingLookupResult> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<AdminListingLookupResponse, { listingId: string }>(
    'admin-listing-lookup',
    {
      method: 'POST',
      body: { listingId },
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  return response.listing;
};
