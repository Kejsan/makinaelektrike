import type { DocumentData } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { getRequiredString } from './_lib/validation';
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { requireDealerAccess } from './_lib/dealerAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import {
  serializePlacementZone,
  serializePromotionalCampaign,
  serializeSponsorshipOrder,
  serializeSponsorshipProduct,
} from './_lib/placements';
import { getDealerPlanEntitlements } from '../../utils/accessControl';

const getSortTime = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  if ('toDate' in (value as Record<string, unknown>) && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }

  return 0;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const dealerId = getRequiredString(event.queryStringParameters?.dealerId, 'dealerId', 128);
    const dealerAccess = await requireDealerAccess(profile, dealerId, { requireTeamManagement: true });
    const firestore = getAdminFirestore();
    const dealerPlanId =
      dealerAccess.dealerData.planId === 'paid' || dealerAccess.dealerData.planId === 'free'
        ? dealerAccess.dealerData.planId
        : 'free';
    const entitlements = getDealerPlanEntitlements(dealerPlanId);

    const [productSnapshot, zoneSnapshot, orderSnapshot] = await Promise.all([
      firestore.collection('sponsorshipProducts').where('status', '==', 'active').get(),
      firestore.collection('placementZones').where('status', '==', 'active').get(),
      firestore.collection('sponsorshipOrders').where('dealerId', '==', dealerId).get(),
    ]);

    const products = productSnapshot.docs
      .map(doc => serializeSponsorshipProduct(doc.id, doc.data() as DocumentData))
      .filter(product => product.eligiblePlanIds.includes(dealerPlanId))
      .filter(product =>
        product.eligibleEntityTypes.some(
          entityType => entityType === 'dealer' || entityType === 'listing' || entityType === 'model',
        ),
      );

    const zones = zoneSnapshot.docs
      .map(doc => serializePlacementZone(doc.id, doc.data() as DocumentData))
      .filter(zone => zone.allowSponsoredPromotions);

    const orders = orderSnapshot.docs
      .sort(
        (left, right) =>
          getSortTime((right.data() as DocumentData).createdAt) -
          getSortTime((left.data() as DocumentData).createdAt),
      )
      .map(doc => serializeSponsorshipOrder(doc.id, doc.data() as DocumentData));

    const campaignIds = Array.from(
      new Set(orders.map(order => order.campaignId).filter((value): value is string => Boolean(value))),
    );
    const campaigns = campaignIds.length
      ? (
          await Promise.all(
            campaignIds.map(async campaignId => {
              const snapshot = await firestore.collection('promotionalCampaigns').doc(campaignId).get();
              return snapshot.exists
                ? serializePromotionalCampaign(snapshot.id, (snapshot.data() ?? {}) as DocumentData)
                : null;
            }),
          )
        ).filter((campaign): campaign is NonNullable<typeof campaign> => Boolean(campaign))
      : [];

    return json(200, {
      ok: true,
      dealerId,
      dealerPlanId,
      entitlements,
      products,
      zones,
      orders,
      campaigns,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Authenticated admin profile was not found') || message.startsWith('You do not have dealer access')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side dealer placements are not configured.');
    }
    if (message.includes('required') || message.includes('Dealer record was not found')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
