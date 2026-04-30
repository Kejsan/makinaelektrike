import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type { DealerPlanId, DealerSubscriptionStatus } from '../types';

interface DealerPlanUpdatePayload {
  dealerId: string;
  planId: DealerPlanId;
  subscriptionStatus?: DealerSubscriptionStatus;
}

interface DealerPlanUpdateResponse {
  ok: true;
  dealerId: string;
  planId: DealerPlanId;
  subscriptionStatus: DealerSubscriptionStatus;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const updateDealerPlan = async (
  payload: DealerPlanUpdatePayload,
): Promise<DealerPlanUpdateResponse> => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<DealerPlanUpdateResponse, DealerPlanUpdatePayload>(
    'admin-dealer-plan-update',
    {
      method: 'POST',
      body: payload,
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );
};
