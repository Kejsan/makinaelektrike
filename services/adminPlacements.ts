import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type {
  PlacementAnalyticsDailyBucket,
  PlacementAnalyticsFilters,
  PlacementCampaignAnalyticsSummary,
  PlacementAnalyticsZoneSummary,
  PlacementZone,
  PlacementZoneFormValues,
  PromotionalCampaign,
  PromotionalCampaignFormValues,
  SponsorshipProduct,
  SponsorshipProductFormValues,
} from '../types';

interface PlacementCatalogResponse {
  ok: true;
  zones: PlacementZone[];
  products: SponsorshipProduct[];
  campaigns: PromotionalCampaign[];
}

interface PlacementAnalyticsResponse {
  ok: true;
  analytics: PlacementCampaignAnalyticsSummary[];
  daily: PlacementAnalyticsDailyBucket[];
  filters: PlacementAnalyticsFilters;
  zones: PlacementAnalyticsZoneSummary[];
}

interface PlacementSaveResponse<T> {
  ok: true;
  kind: 'zone' | 'product' | 'campaign';
  entity: T;
}

interface PlacementBootstrapResponse {
  ok: true;
  zones: {
    created: number;
    updated: number;
    unchanged: number;
  };
  products: {
    created: number;
    updated: number;
    unchanged: number;
  };
}

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

export const listAdminPlacements = async () =>
  withAdminAuth<PlacementCatalogResponse>('admin-placement-list', {
    method: 'GET',
  });

export const listAdminPlacementAnalytics = async (options?: {
  days?: number;
  zoneKey?: string;
}) =>
  withAdminAuth<PlacementAnalyticsResponse>('admin-placement-analytics', {
    method: 'GET',
    query: {
      days: options?.days,
      zoneKey: options?.zoneKey,
    },
  });

export const savePlacementZone = async (payload: {
  id?: string;
  values: PlacementZoneFormValues;
}) =>
  withAdminAuth<PlacementSaveResponse<PlacementZone>, { kind: 'zone'; id?: string; values: PlacementZoneFormValues }>(
    'admin-placement-save',
    {
      method: 'POST',
      body: {
        kind: 'zone',
        id: payload.id,
        values: payload.values,
      },
    },
  );

export const saveSponsorshipProduct = async (payload: {
  id?: string;
  values: SponsorshipProductFormValues;
}) =>
  withAdminAuth<
    PlacementSaveResponse<SponsorshipProduct>,
    { kind: 'product'; id?: string; values: SponsorshipProductFormValues }
  >('admin-placement-save', {
    method: 'POST',
    body: {
      kind: 'product',
      id: payload.id,
      values: payload.values,
    },
  });

export const savePromotionalCampaign = async (payload: {
  id?: string;
  values: PromotionalCampaignFormValues;
}) =>
  withAdminAuth<
    PlacementSaveResponse<PromotionalCampaign>,
    { kind: 'campaign'; id?: string; values: PromotionalCampaignFormValues }
  >('admin-placement-save', {
    method: 'POST',
    body: {
      kind: 'campaign',
      id: payload.id,
      values: payload.values,
    },
  });

export const bootstrapAdminPlacements = async () =>
  withAdminAuth<PlacementBootstrapResponse>('admin-placement-bootstrap', {
    method: 'POST',
  });
