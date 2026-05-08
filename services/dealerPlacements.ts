import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type {
  DealerPlacementRequestFormValues,
  DealerPlanEntitlements,
  DealerPlanId,
  PlacementZone,
  PromotionalCampaign,
  SponsorshipOrder,
  SponsorshipProduct,
} from '../types';

interface DealerPlacementListResponse {
  ok: true;
  dealerId: string;
  dealerPlanId: DealerPlanId | null;
  entitlements: DealerPlanEntitlements | null;
  products: SponsorshipProduct[];
  zones: PlacementZone[];
  orders: SponsorshipOrder[];
  campaigns: PromotionalCampaign[];
}

interface DealerPlacementRequestCreateResponse {
  ok: true;
  order: SponsorshipOrder;
}

interface DealerPlacementOrderUpdateResponse {
  ok: true;
  order: SponsorshipOrder;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this dealer action.');
  }

  return currentUser.getIdToken();
};

export const listDealerPlacements = async (
  dealerId: string,
): Promise<{
  dealerPlanId: DealerPlanId | null;
  entitlements: DealerPlanEntitlements | null;
  products: SponsorshipProduct[];
  zones: PlacementZone[];
  orders: SponsorshipOrder[];
  campaigns: PromotionalCampaign[];
}> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<DealerPlacementListResponse>('dealer-placement-list', {
    method: 'GET',
    query: { dealerId },
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  return {
    dealerPlanId: response.dealerPlanId,
    entitlements: response.entitlements,
    products: response.products,
    zones: response.zones,
    orders: response.orders,
    campaigns: response.campaigns,
  };
};

export const createDealerPlacementRequest = async (payload: {
  dealerId: string;
  values: DealerPlacementRequestFormValues;
}): Promise<SponsorshipOrder> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<
    DealerPlacementRequestCreateResponse,
    { dealerId: string; values: DealerPlacementRequestFormValues }
  >('dealer-placement-request-create', {
    method: 'POST',
    body: payload,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  return response.order;
};

export const cancelDealerPlacementRequest = async (payload: {
  dealerId: string;
  orderId: string;
}): Promise<SponsorshipOrder> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<
    DealerPlacementOrderUpdateResponse,
    { dealerId: string; orderId: string; action: 'cancel' }
  >('dealer-placement-order-update', {
    method: 'POST',
    body: {
      ...payload,
      action: 'cancel',
    },
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  return response.order;
};
