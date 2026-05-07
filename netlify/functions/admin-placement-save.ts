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
import { getOptionalString, getRequiredString } from './_lib/validation';
import {
  parseDealerPlanIds,
  parsePlacementEntityTypes,
  parsePlacementZoneStatus,
  parsePromotionalCampaignPromotionType,
  parsePromotionalCampaignStatus,
  parseStringList,
  parseSponsorshipProductStatus,
  serializePlacementZone,
  serializePromotionalCampaign,
  serializeSponsorshipProduct,
} from './_lib/placements';
import type {
  AuditAction,
  AuditEntityType,
  PlacementEntityType,
  PlacementZoneStatus,
  PromotionalCampaignPromotionType,
  PromotionalCampaignStatus,
  SponsorshipProductStatus,
} from '../../types';
import { hasPermission } from '../../utils/accessControl';

interface PlacementSaveBody {
  kind?: 'zone' | 'product' | 'campaign';
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

const parseInteger = (
  value: unknown,
  field: string,
  { min = 0, max = 9999, required = true }: { min?: number; max?: number; required?: boolean } = {},
) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new Error(`${field} is required.`);
    }
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
};

const parseBoolean = (value: unknown, field: string) => {
  if (typeof value === 'boolean') {
    return value;
  }

  throw new Error(`${field} must be a boolean.`);
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

const parseKind = (value: unknown) => {
  if (value === 'zone' || value === 'product' || value === 'campaign') {
    return value;
  }

  throw new Error('kind must be one of: zone, product, campaign.');
};

const assertUniqueField = async (
  collectionName: string,
  field: string,
  value: string,
  currentId?: string,
) => {
  const snapshot = await getAdminFirestore().collection(collectionName).where(field, '==', value).limit(5).get();
  const conflict = snapshot.docs.find(doc => doc.id !== currentId);
  if (conflict) {
    throw new Error(`${field} must be unique.`);
  }
};

const ensureZoneIdsExist = async (zoneIds: string[]) => {
  if (!zoneIds.length) {
    return [];
  }

  const snapshots = await Promise.all(
    zoneIds.map(zoneId => getAdminFirestore().collection('placementZones').doc(zoneId).get()),
  );
  const missingZone = snapshots.find(snapshot => !snapshot.exists);
  if (missingZone) {
    throw new Error(`Referenced placement zone ${missingZone.id} was not found.`);
  }

  return snapshots;
};

const ensureProductExists = async (productId: string | null) => {
  if (!productId) {
    return null;
  }

  const snapshot = await getAdminFirestore().collection('sponsorshipProducts').doc(productId).get();
  if (!snapshot.exists) {
    throw new Error('Referenced sponsorshipProductId was not found.');
  }

  return snapshot;
};

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

const parseZoneValues = async (
  values: Record<string, unknown>,
  currentId?: string,
) => {
  const key = getRequiredString(values.key, 'key', 120).toLowerCase();
  const name = getRequiredString(values.name, 'name', 160);
  const description = getOptionalString(values.description, {
    field: 'description',
    maxLength: 1000,
  }) ?? null;
  const pageKey = getRequiredString(values.pageKey, 'pageKey', 120).toLowerCase();
  const slotKey = getRequiredString(values.slotKey, 'slotKey', 120).toLowerCase();
  const allowedEntityTypes = parsePlacementEntityTypes(values.allowedEntityTypes);
  const allowHousePromotions = parseBoolean(values.allowHousePromotions, 'allowHousePromotions');
  const allowSponsoredPromotions = parseBoolean(
    values.allowSponsoredPromotions,
    'allowSponsoredPromotions',
  );
  const maxAssignments = parseInteger(values.maxAssignments, 'maxAssignments', {
    min: 1,
    max: 24,
  });
  const localeTargets = parseStringList(values.localeTargets, 32);
  const status = parsePlacementZoneStatus(values.status);

  if (allowedEntityTypes.length === 0) {
    throw new Error('allowedEntityTypes must contain at least one supported entity type.');
  }
  if (!allowHousePromotions && !allowSponsoredPromotions) {
    throw new Error('At least one promotion source must be enabled for the zone.');
  }

  await assertUniqueField('placementZones', 'key', key, currentId);

  return {
    key,
    name,
    description,
    pageKey,
    slotKey,
    allowedEntityTypes,
    allowHousePromotions,
    allowSponsoredPromotions,
    maxAssignments: maxAssignments ?? 1,
    localeTargets,
    status,
  };
};

const parseProductValues = async (
  values: Record<string, unknown>,
  currentId?: string,
) => {
  const code = getRequiredString(values.code, 'code', 120).toLowerCase();
  const name = getRequiredString(values.name, 'name', 160);
  const description = getOptionalString(values.description, {
    field: 'description',
    maxLength: 1000,
  }) ?? null;
  const eligiblePlanIds = parseDealerPlanIds(values.eligiblePlanIds);
  const eligibleEntityTypes = parsePlacementEntityTypes(values.eligibleEntityTypes);
  const defaultDurationDays = parseInteger(values.defaultDurationDays, 'defaultDurationDays', {
    min: 1,
    max: 365,
    required: false,
  });
  const priceLabel = getOptionalString(values.priceLabel, {
    field: 'priceLabel',
    maxLength: 120,
  }) ?? null;
  const status = parseSponsorshipProductStatus(values.status);

  if (eligiblePlanIds.length === 0) {
    throw new Error('eligiblePlanIds must contain at least one supported dealer plan.');
  }
  if (eligibleEntityTypes.length === 0) {
    throw new Error('eligibleEntityTypes must contain at least one supported entity type.');
  }

  await assertUniqueField('sponsorshipProducts', 'code', code, currentId);

  return {
    code,
    name,
    description,
    eligiblePlanIds,
    eligibleEntityTypes,
    defaultDurationDays,
    priceLabel,
    status,
  };
};

const parseCampaignValues = async (values: Record<string, unknown>) => {
  const name = getRequiredString(values.name, 'name', 160);
  const description = getOptionalString(values.description, {
    field: 'description',
    maxLength: 1200,
  }) ?? null;
  const promotionType = parsePromotionalCampaignPromotionType(values.promotionType);
  const status = parsePromotionalCampaignStatus(values.status);
  const sponsoredEntityTypes = parsePlacementEntityTypes([values.sponsoredEntityType]);
  const sponsoredEntityType = sponsoredEntityTypes[0] ?? null;
  const sponsoredEntityId = getOptionalString(values.sponsoredEntityId, {
    field: 'sponsoredEntityId',
    maxLength: 128,
  }) ?? null;
  const sponsorshipProductId = getOptionalString(values.sponsorshipProductId, {
    field: 'sponsorshipProductId',
    maxLength: 128,
  }) ?? null;
  const zoneIds = parseStringList(values.zoneIds, 128);
  const headline = getOptionalString(values.headline, { field: 'headline', maxLength: 180 }) ?? null;
  const supportingText =
    getOptionalString(values.supportingText, {
      field: 'supportingText',
      maxLength: 1000,
    }) ?? null;
  const imageUrl = getOptionalString(values.imageUrl, { field: 'imageUrl', maxLength: 1000 }) ?? null;
  const ctaLabel = getOptionalString(values.ctaLabel, { field: 'ctaLabel', maxLength: 80 }) ?? null;
  const destinationUrl =
    getOptionalString(values.destinationUrl, { field: 'destinationUrl', maxLength: 1000 }) ?? null;
  const localeTargets = parseStringList(values.localeTargets, 32);
  const startAt = parseIsoDate(values.startAt, 'startAt');
  const endAt = parseIsoDate(values.endAt, 'endAt');
  const priority = parseInteger(values.priority, 'priority', { min: 0, max: 100, required: false }) ?? 0;

  if (promotionType === 'sponsored_promotion') {
    if (!sponsoredEntityType || !sponsoredEntityId) {
      throw new Error('Sponsored campaigns require both sponsoredEntityType and sponsoredEntityId.');
    }
    if (!sponsorshipProductId) {
      throw new Error('Sponsored campaigns require sponsorshipProductId.');
    }
  }

  if (promotionType === 'house_promotion' && !headline && !destinationUrl) {
    throw new Error('House campaigns require at least a headline or destinationUrl.');
  }

  if ((status === 'scheduled' || status === 'active' || status === 'paused') && zoneIds.length === 0) {
    throw new Error('Campaigns in scheduled, active, or paused status require at least one assigned zone.');
  }

  if (startAt && endAt && endAt.getTime() < startAt.getTime()) {
    throw new Error('endAt must be greater than or equal to startAt.');
  }

  const zoneSnapshots = await ensureZoneIdsExist(zoneIds);
  const productSnapshot = await ensureProductExists(sponsorshipProductId);
  await ensureTargetExists(sponsoredEntityType, sponsoredEntityId);

  if (productSnapshot && sponsoredEntityType) {
    const productData = productSnapshot.data() ?? {};
    const eligibleEntityTypes = parsePlacementEntityTypes(productData.eligibleEntityTypes);
    if (!eligibleEntityTypes.includes(sponsoredEntityType)) {
      throw new Error('sponsoredEntityType is not eligible for the selected sponsorship product.');
    }
  }

  zoneSnapshots.forEach(snapshot => {
    const zoneData = snapshot.data() ?? {};
    const allowHousePromotions = zoneData.allowHousePromotions === true;
    const allowSponsoredPromotions = zoneData.allowSponsoredPromotions === true;
    const allowedEntityTypes = parsePlacementEntityTypes(zoneData.allowedEntityTypes);

    if (promotionType === 'house_promotion' && !allowHousePromotions) {
      throw new Error(`Zone ${snapshot.id} does not allow house promotions.`);
    }

    if (promotionType === 'sponsored_promotion' && !allowSponsoredPromotions) {
      throw new Error(`Zone ${snapshot.id} does not allow sponsored promotions.`);
    }

    if (sponsoredEntityType && allowedEntityTypes.length > 0 && !allowedEntityTypes.includes(sponsoredEntityType)) {
      throw new Error(`Zone ${snapshot.id} does not allow ${sponsoredEntityType} placements.`);
    }
  });

  return {
    name,
    description,
    promotionType,
    status,
    sponsoredEntityType,
    sponsoredEntityId,
    sponsorshipProductId,
    zoneIds,
    headline,
    supportingText,
    imageUrl,
    ctaLabel,
    destinationUrl,
    localeTargets,
    startAt,
    endAt,
    priority,
  };
};

const buildAuditConfig = (kind: 'zone' | 'product' | 'campaign') => {
  if (kind === 'zone') {
    return {
      action: 'placement_zone.updated' as AuditAction,
      entityType: 'placement_zone' as AuditEntityType,
      collection: 'placementZones',
      serialize: serializePlacementZone,
      label: 'placement zone',
    };
  }

  if (kind === 'product') {
    return {
      action: 'sponsorship_product.updated' as AuditAction,
      entityType: 'sponsorship_product' as AuditEntityType,
      collection: 'sponsorshipProducts',
      serialize: serializeSponsorshipProduct,
      label: 'sponsorship product',
    };
  }

  return {
    action: 'promotional_campaign.updated' as AuditAction,
    entityType: 'promotional_campaign' as AuditEntityType,
    collection: 'promotionalCampaigns',
    serialize: serializePromotionalCampaign,
    label: 'promotional campaign',
  };
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = event.body ? (JSON.parse(event.body) as PlacementSaveBody) : {};
    const kind = parseKind(body.kind);
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
    const auditConfig = buildAuditConfig(kind);
    const collection = firestore.collection(auditConfig.collection);
    const docRef = entityId ? collection.doc(entityId) : collection.doc();
    const previousSnapshot = entityId ? await docRef.get() : null;

    if (entityId && !previousSnapshot?.exists) {
      return json(404, { error: `${auditConfig.label} not found.` });
    }

    let nextValues: Record<string, unknown>;

    if (kind === 'zone') {
      nextValues = await parseZoneValues(values, entityId ?? undefined);
    } else if (kind === 'product') {
      nextValues = await parseProductValues(values, entityId ?? undefined);
    } else {
      nextValues = await parseCampaignValues(values);
      const campaignStatus = nextValues.status as PromotionalCampaignStatus;
      const zoneIds = (nextValues.zoneIds as string[]) ?? [];
      if (zoneIds.length > 0) {
        requirePermission(hasPermission(profile, 'placements.assign'), 'placements.assign');
      }
      if (campaignStatus === 'active' || campaignStatus === 'scheduled') {
        requirePermission(hasPermission(profile, 'placements.publish'), 'placements.publish');
      }
      if (campaignStatus === 'paused') {
        requirePermission(hasPermission(profile, 'placements.pause'), 'placements.pause');
      }
    }

    const payload = {
      ...nextValues,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: profile.uid,
      ...(entityId ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: profile.uid }),
    };

    await docRef.set(payload, { merge: Boolean(entityId) });
    const savedSnapshot = await docRef.get();
    const savedRecord = auditConfig.serialize(docRef.id, (savedSnapshot.data() ?? {}) as Record<string, unknown>);

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: auditConfig.action,
      entityType: auditConfig.entityType,
      entityId: docRef.id,
      summary: `${entityId ? 'Updated' : 'Created'} ${auditConfig.label} ${
        typeof savedRecord.name === 'string' ? savedRecord.name : docRef.id
      }.`,
      before:
        previousSnapshot?.exists && previousSnapshot.data()
          ? (auditConfig.serialize(
              previousSnapshot.id,
              previousSnapshot.data() as Record<string, unknown>,
            ) as unknown as Record<string, unknown>)
          : null,
      after: savedRecord as unknown as Record<string, unknown>,
      metadata: {
        kind,
      },
    });

    return json(200, {
      ok: true,
      kind,
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
      return serviceUnavailable('Server-side placement management is not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be') ||
      message.includes('unique') ||
      message.includes('not found') ||
      message.includes('eligible') ||
      message.includes('enabled')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
