import type { DocumentData } from 'firebase-admin/firestore';
import type {
  DealerPlanId,
  PlacementEntityType,
  PlacementZone,
  PlacementZoneStatus,
  PromotionalCampaign,
  PromotionalCampaignPromotionType,
  PromotionalCampaignStatus,
  SponsorshipOrder,
  SponsorshipOrderStatus,
  SponsorshipPaymentStatus,
  SponsorshipProduct,
  SponsorshipProductStatus,
} from '../../../types';
import {
  PLACEMENT_ENTITY_TYPES,
  PLACEMENT_ZONE_STATUSES,
  PROMOTIONAL_CAMPAIGN_PROMOTION_TYPES,
  PROMOTIONAL_CAMPAIGN_STATUSES,
  SPONSORSHIP_ORDER_STATUSES,
  SPONSORSHIP_PAYMENT_STATUSES,
  SPONSORSHIP_PRODUCT_STATUSES,
} from '../../../utils/placements';

const DEALER_PLAN_IDS: readonly DealerPlanId[] = ['free', 'paid'];

export const serializeTimestamp = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
};

export const parseStringList = (value: unknown, maxLength = 64) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0 && entry.length <= maxLength),
    ),
  );
};

export const parsePlacementEntityTypes = (value: unknown) =>
  parseStringList(value, 64).filter((entry): entry is PlacementEntityType =>
    (PLACEMENT_ENTITY_TYPES as readonly string[]).includes(entry),
  );

export const parseDealerPlanIds = (value: unknown) =>
  parseStringList(value, 32).filter((entry): entry is DealerPlanId =>
    (DEALER_PLAN_IDS as readonly string[]).includes(entry),
  );

export const parsePlacementZoneStatus = (value: unknown): PlacementZoneStatus =>
  (PLACEMENT_ZONE_STATUSES as readonly string[]).includes(String(value))
    ? (value as PlacementZoneStatus)
    : 'inactive';

export const parseSponsorshipProductStatus = (value: unknown): SponsorshipProductStatus =>
  (SPONSORSHIP_PRODUCT_STATUSES as readonly string[]).includes(String(value))
    ? (value as SponsorshipProductStatus)
    : 'inactive';

export const parseSponsorshipOrderStatus = (value: unknown): SponsorshipOrderStatus =>
  (SPONSORSHIP_ORDER_STATUSES as readonly string[]).includes(String(value))
    ? (value as SponsorshipOrderStatus)
    : 'draft';

export const parseSponsorshipPaymentStatus = (value: unknown): SponsorshipPaymentStatus =>
  (SPONSORSHIP_PAYMENT_STATUSES as readonly string[]).includes(String(value))
    ? (value as SponsorshipPaymentStatus)
    : 'unpaid';

export const parsePromotionalCampaignStatus = (value: unknown): PromotionalCampaignStatus =>
  (PROMOTIONAL_CAMPAIGN_STATUSES as readonly string[]).includes(String(value))
    ? (value as PromotionalCampaignStatus)
    : 'draft';

export const parsePromotionalCampaignPromotionType = (
  value: unknown,
): PromotionalCampaignPromotionType =>
  (PROMOTIONAL_CAMPAIGN_PROMOTION_TYPES as readonly string[]).includes(String(value))
    ? (value as PromotionalCampaignPromotionType)
    : 'house_promotion';

export const serializePlacementZone = (id: string, data: DocumentData): PlacementZone => ({
  id,
  key: typeof data.key === 'string' ? data.key : '',
  name: typeof data.name === 'string' ? data.name : '',
  description: typeof data.description === 'string' ? data.description : null,
  pageKey: typeof data.pageKey === 'string' ? data.pageKey : '',
  slotKey: typeof data.slotKey === 'string' ? data.slotKey : '',
  allowedEntityTypes: parsePlacementEntityTypes(data.allowedEntityTypes),
  allowHousePromotions: data.allowHousePromotions === true,
  allowSponsoredPromotions: data.allowSponsoredPromotions === true,
  maxAssignments: typeof data.maxAssignments === 'number' ? data.maxAssignments : 1,
  localeTargets: parseStringList(data.localeTargets, 32),
  status: parsePlacementZoneStatus(data.status),
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : null,
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
  createdAt: serializeTimestamp(data.createdAt) as unknown as PlacementZone['createdAt'],
  updatedAt: serializeTimestamp(data.updatedAt) as unknown as PlacementZone['updatedAt'],
});

export const serializeSponsorshipProduct = (
  id: string,
  data: DocumentData,
): SponsorshipProduct => ({
  id,
  code: typeof data.code === 'string' ? data.code : '',
  name: typeof data.name === 'string' ? data.name : '',
  description: typeof data.description === 'string' ? data.description : null,
  eligiblePlanIds: parseDealerPlanIds(data.eligiblePlanIds),
  eligibleEntityTypes: parsePlacementEntityTypes(data.eligibleEntityTypes),
  defaultDurationDays:
    typeof data.defaultDurationDays === 'number' ? data.defaultDurationDays : null,
  priceLabel: typeof data.priceLabel === 'string' ? data.priceLabel : null,
  status: parseSponsorshipProductStatus(data.status),
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : null,
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
  createdAt: serializeTimestamp(data.createdAt) as unknown as SponsorshipProduct['createdAt'],
  updatedAt: serializeTimestamp(data.updatedAt) as unknown as SponsorshipProduct['updatedAt'],
});

export const serializeSponsorshipOrder = (
  id: string,
  data: DocumentData,
): SponsorshipOrder => ({
  id,
  name: typeof data.name === 'string' ? data.name : '',
  dealerId: typeof data.dealerId === 'string' ? data.dealerId : '',
  sponsorshipProductId:
    typeof data.sponsorshipProductId === 'string' ? data.sponsorshipProductId : '',
  campaignId: typeof data.campaignId === 'string' ? data.campaignId : null,
  zoneIds: parseStringList(data.zoneIds, 128),
  sponsoredEntityType: parsePlacementEntityTypes([data.sponsoredEntityType])[0] ?? null,
  sponsoredEntityId:
    typeof data.sponsoredEntityId === 'string' ? data.sponsoredEntityId : null,
  status: parseSponsorshipOrderStatus(data.status),
  paymentStatus: parseSponsorshipPaymentStatus(data.paymentStatus),
  priceAmount: typeof data.priceAmount === 'number' ? data.priceAmount : null,
  currency: typeof data.currency === 'string' ? data.currency : null,
  priceLabel: typeof data.priceLabel === 'string' ? data.priceLabel : null,
  invoiceReference: typeof data.invoiceReference === 'string' ? data.invoiceReference : null,
  startAt: serializeTimestamp(data.startAt),
  endAt: serializeTimestamp(data.endAt),
  paidAt: serializeTimestamp(data.paidAt),
  dealerPlanId: parseDealerPlanIds([data.dealerPlanId])[0] ?? null,
  notes: typeof data.notes === 'string' ? data.notes : null,
  internalNotes: typeof data.internalNotes === 'string' ? data.internalNotes : null,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : null,
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
  createdAt: serializeTimestamp(data.createdAt) as unknown as SponsorshipOrder['createdAt'],
  updatedAt: serializeTimestamp(data.updatedAt) as unknown as SponsorshipOrder['updatedAt'],
});

export const serializePromotionalCampaign = (
  id: string,
  data: DocumentData,
): PromotionalCampaign => ({
  id,
  name: typeof data.name === 'string' ? data.name : '',
  description: typeof data.description === 'string' ? data.description : null,
  status: parsePromotionalCampaignStatus(data.status),
  promotionType: parsePromotionalCampaignPromotionType(data.promotionType),
  sponsoredEntityType: parsePlacementEntityTypes([data.sponsoredEntityType])[0] ?? null,
  sponsoredEntityId:
    typeof data.sponsoredEntityId === 'string' ? data.sponsoredEntityId : null,
  sponsorshipProductId:
    typeof data.sponsorshipProductId === 'string' ? data.sponsorshipProductId : null,
  zoneIds: parseStringList(data.zoneIds, 128),
  headline: typeof data.headline === 'string' ? data.headline : null,
  supportingText: typeof data.supportingText === 'string' ? data.supportingText : null,
  imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
  ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : null,
  destinationUrl: typeof data.destinationUrl === 'string' ? data.destinationUrl : null,
  localeTargets: parseStringList(data.localeTargets, 32),
  startAt: serializeTimestamp(data.startAt),
  endAt: serializeTimestamp(data.endAt),
  priority: typeof data.priority === 'number' ? data.priority : 0,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : null,
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
  createdAt: serializeTimestamp(data.createdAt) as unknown as PromotionalCampaign['createdAt'],
  updatedAt: serializeTimestamp(data.updatedAt) as unknown as PromotionalCampaign['updatedAt'],
});
