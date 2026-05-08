import { FieldValue } from 'firebase-admin/firestore';
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
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { findPlacementOrderConflicts } from './_lib/placementOrders';
import {
  parseDealerPlanIds,
  parsePlacementEntityTypes,
  parseSponsorshipOrderStatus,
  parseSponsorshipPaymentStatus,
  parseStringList,
  serializePlacementZone,
  serializePromotionalCampaign,
  serializeSponsorshipOrder,
  serializeSponsorshipProduct,
} from './_lib/placements';
import { getOptionalString, getRequiredString } from './_lib/validation';
import type {
  Dealer,
  PlacementEntityType,
  SponsorshipOrderStatus,
} from '../../types';
import { hasPermission } from '../../utils/accessControl';

interface PlacementOrderSaveBody {
  id?: string;
  values?: Record<string, unknown>;
}

const TARGET_COLLECTIONS: Partial<Record<PlacementEntityType, string>> = {
  dealer: 'dealers',
  listing: 'listings',
  model: 'models',
  charging_station: 'charging_stations',
  blog_post: 'blogPosts',
};

const requirePermission = (allowed: boolean, permission: string) => {
  if (!allowed) {
    throw new Error(`Missing required permission: ${permission}.`);
  }
};

const parseDecimal = (
  value: unknown,
  field: string,
  { min = 0, max = 1_000_000, required = false }: { min?: number; max?: number; required?: boolean } = {},
) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new Error(`${field} is required.`);
    }
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be a number between ${min} and ${max}.`);
  }

  return Number(parsed.toFixed(2));
};

const parseIsoDate = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be a valid datetime string.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid datetime string.`);
  }

  return parsed;
};

const requiresInventoryReservation = (status: SponsorshipOrderStatus) =>
  status === 'reserved' || status === 'paid' || status === 'active';

const ensureTargetExists = async (
  entityType: PlacementEntityType | null,
  entityId: string | null,
) => {
  if (!entityType || !entityId) {
    return;
  }

  const collectionName = TARGET_COLLECTIONS[entityType];
  if (!collectionName) {
    return;
  }

  const snapshot = await getAdminFirestore().collection(collectionName).doc(entityId).get();
  if (!snapshot.exists) {
    throw new Error(`Referenced ${entityType} target was not found.`);
  }
};

const parseOrderValues = async (
  values: Record<string, unknown>,
  currentId?: string,
) => {
  const firestore = getAdminFirestore();
  const name = getRequiredString(values.name, 'name', 160);
  const dealerId = getRequiredString(values.dealerId, 'dealerId', 128);
  const sponsorshipProductId = getRequiredString(values.sponsorshipProductId, 'sponsorshipProductId', 128);
  const campaignId = getOptionalString(values.campaignId, { field: 'campaignId', maxLength: 128 }) ?? null;
  const zoneIds = parseStringList(values.zoneIds, 128);
  const sponsoredEntityType = parsePlacementEntityTypes([values.sponsoredEntityType])[0] ?? null;
  const sponsoredEntityId = getOptionalString(values.sponsoredEntityId, {
    field: 'sponsoredEntityId',
    maxLength: 128,
  }) ?? null;
  const status = parseSponsorshipOrderStatus(values.status);
  const paymentStatus = parseSponsorshipPaymentStatus(values.paymentStatus);
  const priceAmount = parseDecimal(values.priceAmount, 'priceAmount');
  const currency =
    getOptionalString(values.currency, { field: 'currency', maxLength: 12 })?.toUpperCase() ?? null;
  const priceLabel = getOptionalString(values.priceLabel, { field: 'priceLabel', maxLength: 120 }) ?? null;
  const invoiceReference = getOptionalString(values.invoiceReference, {
    field: 'invoiceReference',
    maxLength: 120,
  }) ?? null;
  const startAt = parseIsoDate(values.startAt, 'startAt');
  const endAt = parseIsoDate(values.endAt, 'endAt');
  const paidAt = parseIsoDate(values.paidAt, 'paidAt');
  const notes = getOptionalString(values.notes, { field: 'notes', maxLength: 4000 }) ?? null;
  const internalNotes =
    getOptionalString(values.internalNotes, { field: 'internalNotes', maxLength: 4000 }) ?? null;

  const [dealerSnapshot, productSnapshot, campaignSnapshot, orderSnapshot, zoneSnapshots] =
    await Promise.all([
      firestore.collection('dealers').doc(dealerId).get(),
      firestore.collection('sponsorshipProducts').doc(sponsorshipProductId).get(),
      campaignId ? firestore.collection('promotionalCampaigns').doc(campaignId).get() : Promise.resolve(null),
      firestore.collection('sponsorshipOrders').get(),
      Promise.all(zoneIds.map(zoneId => firestore.collection('placementZones').doc(zoneId).get())),
    ]);

  if (!dealerSnapshot.exists) {
    throw new Error('Referenced dealerId was not found.');
  }
  if (!productSnapshot.exists) {
    throw new Error('Referenced sponsorshipProductId was not found.');
  }
  if (campaignId && !campaignSnapshot?.exists) {
    throw new Error('Referenced campaignId was not found.');
  }

  const missingZone = zoneSnapshots.find(snapshot => !snapshot.exists);
  if (missingZone) {
    throw new Error(`Referenced placement zone ${missingZone.id} was not found.`);
  }

  const dealer = { id: dealerSnapshot.id, ...(dealerSnapshot.data() ?? {}) } as Dealer;
  const product = serializeSponsorshipProduct(productSnapshot.id, productSnapshot.data() ?? {});
  const campaign = campaignSnapshot?.exists
    ? serializePromotionalCampaign(campaignSnapshot.id, campaignSnapshot.data() ?? {})
    : null;
  const zones = zoneSnapshots.map(snapshot => serializePlacementZone(snapshot.id, snapshot.data() ?? {}));
  const existingOrders = orderSnapshot.docs.map(doc => serializeSponsorshipOrder(doc.id, doc.data() ?? {}));

  if (!zoneIds.length) {
    throw new Error('zoneIds must contain at least one placement zone.');
  }
  if (requiresInventoryReservation(status) && (!startAt || !endAt)) {
    throw new Error('Reserved, paid, and active orders require both startAt and endAt.');
  }
  if (startAt && endAt && endAt.getTime() < startAt.getTime()) {
    throw new Error('endAt must be greater than or equal to startAt.');
  }
  if (product.eligiblePlanIds.length > 0 && dealer.planId && !product.eligiblePlanIds.includes(dealer.planId)) {
    throw new Error('The dealer plan is not eligible for the selected sponsorship product.');
  }
  if (product.eligibleEntityTypes.length > 0 && sponsoredEntityType && !product.eligibleEntityTypes.includes(sponsoredEntityType)) {
    throw new Error('The selected sponsorship product does not support that sponsored entity type.');
  }
  if (campaign && campaign.zoneIds.length > 0) {
    const missingCampaignZone = campaign.zoneIds.find(zoneId => !zoneIds.includes(zoneId));
    if (missingCampaignZone) {
      throw new Error('Order zoneIds must include all linked campaign zone assignments.');
    }
  }
  if (campaign && campaign.sponsoredEntityType && sponsoredEntityType && campaign.sponsoredEntityType !== sponsoredEntityType) {
    throw new Error('The linked campaign sponsoredEntityType does not match the order.');
  }
  if (campaign && campaign.sponsoredEntityId && sponsoredEntityId && campaign.sponsoredEntityId !== sponsoredEntityId) {
    throw new Error('The linked campaign sponsoredEntityId does not match the order.');
  }

  await ensureTargetExists(sponsoredEntityType, sponsoredEntityId);

  zones.forEach(zone => {
    if (!zone.allowSponsoredPromotions) {
      throw new Error(`Zone ${zone.name} does not allow sponsored promotions.`);
    }
    if (sponsoredEntityType && zone.allowedEntityTypes.length > 0 && !zone.allowedEntityTypes.includes(sponsoredEntityType)) {
      throw new Error(`Zone ${zone.name} does not allow ${sponsoredEntityType} promotions.`);
    }
  });

  if (requiresInventoryReservation(status) && startAt && endAt) {
    const conflicts = findPlacementOrderConflicts({
      zones,
      orders: existingOrders,
      zoneIds,
      startAt,
      endAt,
      excludeOrderId: currentId,
    });

    if (conflicts.length > 0) {
      const labels = conflicts.map(conflict => conflict.zone.name).join(', ');
      throw new Error(`The selected schedule is already sold out for: ${labels}.`);
    }
  }

  return {
    name,
    dealerId,
    sponsorshipProductId,
    campaignId,
    zoneIds,
    sponsoredEntityType,
    sponsoredEntityId,
    status,
    paymentStatus,
    priceAmount,
    currency,
    priceLabel,
    invoiceReference,
    startAt,
    endAt,
    paidAt,
    dealerPlanId: dealer.planId ?? null,
    notes,
    internalNotes,
  };
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = event.body ? (JSON.parse(event.body) as PlacementOrderSaveBody) : {};
    const entityId = getOptionalString(body.id, { field: 'id', maxLength: 128 }) ?? null;
    const values = body.values;

    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return badRequest('values is required.');
    }

    requirePermission(
      hasPermission(profile, entityId ? 'placements.edit' : 'placements.create'),
      entityId ? 'placements.edit' : 'placements.create',
    );

    const firestore = getAdminFirestore();
    const collection = firestore.collection('sponsorshipOrders');
    const docRef = entityId ? collection.doc(entityId) : collection.doc();
    const previousSnapshot = entityId ? await docRef.get() : null;

    if (entityId && !previousSnapshot?.exists) {
      return json(404, { error: 'sponsorship order not found.' });
    }

    const nextValues = await parseOrderValues(values, entityId ?? undefined);
    if (nextValues.zoneIds.length > 0) {
      requirePermission(hasPermission(profile, 'placements.assign'), 'placements.assign');
    }
    if (
      nextValues.status === 'reserved' ||
      nextValues.status === 'paid' ||
      nextValues.status === 'active'
    ) {
      requirePermission(hasPermission(profile, 'placements.publish'), 'placements.publish');
    }

    const payload = {
      ...nextValues,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: profile.uid,
      ...(entityId ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: profile.uid }),
    };

    await docRef.set(payload, { merge: Boolean(entityId) });
    const savedSnapshot = await docRef.get();
    const savedRecord = serializeSponsorshipOrder(docRef.id, savedSnapshot.data() ?? {});

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'sponsorship_order.updated',
      entityType: 'sponsorship_order',
      entityId: docRef.id,
      summary: `${entityId ? 'Updated' : 'Created'} sponsorship order ${
        savedRecord.name || docRef.id
      }.`,
      before:
        previousSnapshot?.exists && previousSnapshot.data()
          ? (serializeSponsorshipOrder(previousSnapshot.id, previousSnapshot.data() ?? {}) as unknown as Record<string, unknown>)
          : null,
      after: savedRecord as unknown as Record<string, unknown>,
      metadata: {
        dealerId: savedRecord.dealerId,
        sponsorshipProductId: savedRecord.sponsorshipProductId,
      },
    });

    return json(200, {
      ok: true,
      entity: savedRecord,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Missing required permission')) {
      return forbidden(message);
    }
    if (message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side sponsorship order management is not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be') ||
      message.includes('not found') ||
      message.includes('eligible') ||
      message.includes('sold out') ||
      message.includes('allow sponsored')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
