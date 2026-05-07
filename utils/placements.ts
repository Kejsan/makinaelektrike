import type {
  PlacementEntityType,
  PlacementZoneStatus,
  PromotionalCampaignPromotionType,
  PromotionalCampaignStatus,
  SponsorshipProductStatus,
} from '../types';

export const PLACEMENT_ENTITY_TYPES = [
  'dealer',
  'listing',
  'model',
  'charging_station',
  'blog_post',
  'service',
  'custom',
] as const satisfies readonly PlacementEntityType[];

export const PLACEMENT_ZONE_STATUSES = [
  'active',
  'inactive',
  'archived',
] as const satisfies readonly PlacementZoneStatus[];

export const SPONSORSHIP_PRODUCT_STATUSES = [
  'active',
  'inactive',
  'archived',
] as const satisfies readonly SponsorshipProductStatus[];

export const PROMOTIONAL_CAMPAIGN_STATUSES = [
  'draft',
  'scheduled',
  'active',
  'paused',
  'archived',
] as const satisfies readonly PromotionalCampaignStatus[];

export const PROMOTIONAL_CAMPAIGN_PROMOTION_TYPES = [
  'house_promotion',
  'sponsored_promotion',
] as const satisfies readonly PromotionalCampaignPromotionType[];

export const formatPlacementEntityTypeLabel = (value: PlacementEntityType) =>
  value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
