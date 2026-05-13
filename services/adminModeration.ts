import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type { ChargingStationFormValues, ListingStatus, ModelReviewStatus } from '../types';

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

const withAdminAuth = async <TResponse, TBody = unknown>(
  functionName: string,
  options: {
    method?: 'GET' | 'POST';
    body?: TBody;
    query?: Record<string, string | number | boolean | null | undefined>;
  } = {},
) => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<TResponse, TBody>(functionName, {
    method: options.method,
    body: options.body,
    query: options.query,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
};

export const updateAdminDealerStatus = async (
  dealerId: string,
  action: 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'delete',
) =>
  withAdminAuth<{
    ok: true;
    dealerId: string;
    action: 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'delete';
  }, { dealerId: string; action: 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'delete' }>(
    'admin-dealer-status-update',
    {
      method: 'POST',
      body: { dealerId, action },
    },
  );

export const updateAdminListing = async (payload: {
  listingId: string;
  status?: ListingStatus;
  dealerId?: string;
  rejectionReason?: string | null;
}) =>
  withAdminAuth<{
    ok: true;
    listingId: string;
    status: ListingStatus | null;
    dealerId: string | null;
  }, typeof payload>('admin-listing-update', {
    method: 'POST',
    body: payload,
  });

export const updateAdminModel = async (payload: {
  modelId: string;
  isActive?: boolean;
  isFeatured?: boolean;
  delete?: boolean;
  reviewStatus?: ModelReviewStatus;
  reviewNotes?: string | null;
}) =>
  withAdminAuth<{
    ok: true;
    modelId: string;
    isActive?: boolean | null;
    isFeatured?: boolean | null;
    reviewStatus?: ModelReviewStatus | null;
    deleted?: boolean;
  }, typeof payload>('admin-model-update', {
    method: 'POST',
    body: payload,
  });

export const updateAdminBlog = async (payload: {
  postId: string;
  status?: 'draft' | 'published';
  delete?: boolean;
}) =>
  withAdminAuth<{
    ok: true;
    postId: string;
    status?: 'draft' | 'published';
    deleted?: boolean;
  }, typeof payload>('admin-blog-update', {
    method: 'POST',
    body: payload,
  });

export const updateAdminStation = async (payload: {
  action: 'create' | 'update' | 'delete';
  stationId?: string;
  values?: ChargingStationFormValues;
}) =>
  withAdminAuth<{
    ok: true;
    stationId: string;
    deleted?: boolean;
  }, typeof payload>('admin-station-update', {
    method: 'POST',
    body: payload,
  });
