import { FieldValue } from 'firebase-admin/firestore';
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
import { getOptionalString, getRequiredString } from './_lib/validation';
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { requireDealerAccess } from './_lib/dealerAccess';
import { findPlacementSlotConflicts } from './_lib/placementOrders';
import {
  parsePlacementEntityTypes,
  parseStringList,
  serializePlacementZone,
  serializePromotionalCampaign,
  serializeSponsorshipOrder,
  serializeSponsorshipProduct,
} from './_lib/placements';
import { getDealerPlanEntitlements } from '../../utils/accessControl';
import type { PlacementEntityType } from '../../types';

interface DealerPlacementRequestBody {
  dealerId?: string;
  values?: Record<string, unknown>;
}

type DealerRequestEntityType = Extract<PlacementEntityType, 'dealer' | 'listing' | 'model'>;

const SUPPORTED_ENTITY_TYPES = new Set<DealerRequestEntityType>(['dealer', 'listing', 'model']);

const parseIsoDate = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid datetime string.`);
  }

  return parsed;
};

const parseDealerRequestEntityType = (value: unknown): DealerRequestEntityType => {
  const entityType = parsePlacementEntityTypes([value])[0];
  if (!entityType || !SUPPORTED_ENTITY_TYPES.has(entityType as DealerRequestEntityType)) {
    throw new Error('sponsoredEntityType must be one of: dealer, listing, model.');
  }

  return entityType as DealerRequestEntityType;
};

const validateOwnedPromotionTarget = async (
  firestore: FirebaseFirestore.Firestore,
  dealerId: string,
  entityType: DealerRequestEntityType,
  entityId: string,
) => {
  if (entityType === 'dealer') {
    if (entityId !== dealerId) {
      throw new Error('Dealer promotion requests must target your own dealer profile.');
    }
    return;
  }

  if (entityType === 'listing') {
    const listingSnapshot = await firestore.collection('listings').doc(entityId).get();
    if (!listingSnapshot.exists) {
      throw new Error('The selected listing was not found.');
    }

    const listingData = listingSnapshot.data() ?? {};
    if (listingData.dealerId !== dealerId) {
      throw new Error('The selected listing does not belong to this dealer account.');
    }
    if (listingData.status === 'deleted') {
      throw new Error('Deleted listings cannot be promoted.');
    }
    return;
  }

  const linkSnapshot = await firestore.collection('dealerModels').doc(`${dealerId}_${entityId}`).get();
  if (!linkSnapshot.exists) {
    throw new Error('The selected model is not linked to this dealer account.');
  }

  const modelSnapshot = await firestore.collection('models').doc(entityId).get();
  if (!modelSnapshot.exists) {
    throw new Error('The selected model was not found.');
  }
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = event.body ? (JSON.parse(event.body) as DealerPlacementRequestBody) : {};
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const values = body.values;

    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return badRequest('values is required.');
    }

    const dealerAccess = await requireDealerAccess(profile, dealerId, { requireTeamManagement: true });
    const firestore = getAdminFirestore();
    const dealerPlanId =
      dealerAccess.dealerData.planId === 'paid' || dealerAccess.dealerData.planId === 'free'
        ? dealerAccess.dealerData.planId
        : 'free';
    const entitlements = getDealerPlanEntitlements(dealerPlanId);

    if (!entitlements?.promotionEligibility || !entitlements.campaignPurchaseEligibility) {
      return forbidden('Your current dealer plan is not eligible for paid promotion requests.');
    }
    if (dealerAccess.dealerData.isDeleted === true || dealerAccess.dealerData.status === 'rejected') {
      return forbidden('This dealer account cannot submit promotion requests.');
    }

    const name = getRequiredString(values.name, 'name', 160);
    const sponsorshipProductId = getRequiredString(values.sponsorshipProductId, 'sponsorshipProductId', 128);
    const sponsoredEntityType = parseDealerRequestEntityType(values.sponsoredEntityType);
    const sponsoredEntityId = getRequiredString(values.sponsoredEntityId, 'sponsoredEntityId', 128);
    const zoneIds = parseStringList(values.zoneIds, 128);
    const startAt = parseIsoDate(values.startAt, 'startAt');
    const endAt = parseIsoDate(values.endAt, 'endAt');
    const notes = getOptionalString(values.notes, { field: 'notes', maxLength: 4000 }) ?? null;

    if (!zoneIds.length) {
      return badRequest('zoneIds must contain at least one placement zone.');
    }
    if (endAt.getTime() < startAt.getTime()) {
      return badRequest('endAt must be greater than or equal to startAt.');
    }

    await validateOwnedPromotionTarget(firestore, dealerId, sponsoredEntityType, sponsoredEntityId);

    const [productSnapshot, zoneSnapshots, orderSnapshot, campaignSnapshot] = await Promise.all([
      firestore.collection('sponsorshipProducts').doc(sponsorshipProductId).get(),
      Promise.all(zoneIds.map(zoneId => firestore.collection('placementZones').doc(zoneId).get())),
      firestore.collection('sponsorshipOrders').get(),
      firestore.collection('promotionalCampaigns').get(),
    ]);

    if (!productSnapshot.exists) {
      return badRequest('Referenced sponsorshipProductId was not found.');
    }

    const missingZone = zoneSnapshots.find(snapshot => !snapshot.exists);
    if (missingZone) {
      return badRequest(`Referenced placement zone ${missingZone.id} was not found.`);
    }

    const product = serializeSponsorshipProduct(productSnapshot.id, (productSnapshot.data() ?? {}) as DocumentData);
    const zones = zoneSnapshots.map(snapshot =>
      serializePlacementZone(snapshot.id, (snapshot.data() ?? {}) as DocumentData),
    );
    const existingOrders = orderSnapshot.docs.map(doc =>
      serializeSponsorshipOrder(doc.id, doc.data() as DocumentData),
    );
    const existingCampaigns = campaignSnapshot.docs.map(doc =>
      serializePromotionalCampaign(doc.id, doc.data() as DocumentData),
    );

    if (product.status !== 'active') {
      return badRequest('The selected sponsorship product is not currently active.');
    }
    if (!product.eligiblePlanIds.includes(dealerPlanId)) {
      return forbidden('Your dealer plan is not eligible for the selected sponsorship product.');
    }
    if (!product.eligibleEntityTypes.includes(sponsoredEntityType)) {
      return badRequest('The selected sponsorship product does not support that entity type.');
    }

    zones.forEach(zone => {
      if (zone.status !== 'active') {
        throw new Error(`Zone ${zone.name} is not currently active.`);
      }
      if (!zone.allowSponsoredPromotions) {
        throw new Error(`Zone ${zone.name} does not allow sponsored promotions.`);
      }
      if (!zone.allowedEntityTypes.includes(sponsoredEntityType)) {
        throw new Error(`Zone ${zone.name} does not allow ${sponsoredEntityType} promotions.`);
      }
    });

    const conflicts = findPlacementSlotConflicts({
      zones,
      orders: existingOrders,
      campaigns: existingCampaigns,
      zoneIds,
      startAt,
      endAt,
    });

    if (conflicts.length > 0) {
      const labels = conflicts.map(conflict => conflict.zone.name).join(', ');
      return badRequest(`The selected schedule is already sold out for: ${labels}.`);
    }

    const docRef = firestore.collection('sponsorshipOrders').doc();
    await docRef.set({
      name,
      dealerId,
      sponsorshipProductId,
      campaignId: null,
      zoneIds,
      sponsoredEntityType,
      sponsoredEntityId,
      status: 'draft',
      paymentStatus: 'unpaid',
      priceAmount: null,
      currency: 'EUR',
      priceLabel: product.priceLabel ?? null,
      invoiceReference: null,
      startAt,
      endAt,
      paidAt: null,
      dealerPlanId,
      notes,
      internalNotes: null,
      createdBy: profile.uid,
      updatedBy: profile.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const savedSnapshot = await docRef.get();
    const savedOrder = serializeSponsorshipOrder(docRef.id, (savedSnapshot.data() ?? {}) as DocumentData);

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'sponsorship_order.updated',
      entityType: 'sponsorship_order',
      entityId: docRef.id,
      summary: `Dealer submitted sponsorship request ${savedOrder.name}.`,
      after: savedOrder as unknown as Record<string, unknown>,
      metadata: {
        dealerId,
        requestOrigin: 'dealer_dashboard',
        sponsorshipProductId,
      },
    });

    return json(200, {
      ok: true,
      order: savedOrder,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (
      message.startsWith('Authenticated admin profile was not found') ||
      message.startsWith('You do not have dealer access')
    ) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side dealer promotion requests are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('not found') ||
      message.includes('does not allow') ||
      message.includes('must be') ||
      message.includes('sold out') ||
      message.includes('cannot be promoted') ||
      message.includes('does not belong')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
