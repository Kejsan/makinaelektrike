import type {
  DealerPlanId,
  PlacementEntityType,
  PlacementZoneStatus,
  SponsorshipOrderStatus,
  SponsorshipPaymentStatus,
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

export const SPONSORSHIP_ORDER_STATUSES = [
  'draft',
  'quoted',
  'reserved',
  'paid',
  'active',
  'expired',
  'cancelled',
] as const satisfies readonly SponsorshipOrderStatus[];

export const SPONSORSHIP_PAYMENT_STATUSES = [
  'unpaid',
  'pending',
  'paid',
  'partial',
  'refunded',
  'waived',
] as const satisfies readonly SponsorshipPaymentStatus[];

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

const toPlacementDateMillis = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      const parsed = (value as { toDate: () => Date }).toDate().getTime();
      return Number.isNaN(parsed) ? null : parsed;
    } catch {
      return null;
    }
  }

  return null;
};

export const isPromotionalCampaignPubliclyResolvable = (
  campaign:
    | {
        status?: PromotionalCampaignStatus;
        startAt?: unknown;
        endAt?: unknown;
      }
    | null
    | undefined,
) => {
  if (!campaign || campaign.status === 'draft' || campaign.status === 'paused' || campaign.status === 'archived') {
    return false;
  }

  const now = Date.now();
  const startsAt = toPlacementDateMillis(campaign.startAt);
  const endsAt = toPlacementDateMillis(campaign.endAt);

  if (startsAt !== null && startsAt > now) {
    return false;
  }

  if (endsAt !== null && endsAt < now) {
    return false;
  }

  return true;
};

export const PUBLIC_PLACEMENT_ZONE_KEYS = {
  homeDealerSpotlight: 'home.dealer_spotlight',
  homeModelSpotlight: 'home.model_spotlight',
  homeBlogSpotlight: 'home.blog_spotlight',
  dealersIndexSpotlight: 'dealers.index_spotlight',
  dealerDetailSpotlight: 'dealers.detail_spotlight',
  modelsIndexSpotlight: 'models.index_spotlight',
  modelDetailSpotlight: 'models.detail_spotlight',
  listingsIndexSpotlight: 'listings.index_spotlight',
  listingDetailSpotlight: 'listings.detail_spotlight',
  blogIndexSpotlight: 'blog.index_spotlight',
  blogPostSpotlight: 'blog.post_spotlight',
  chargingStationsIndexSpotlight: 'charging_stations.index_spotlight',
} as const;

export interface PlacementZoneSeedDefinition {
  key: string;
  name: string;
  description: string;
  pageKey: string;
  slotKey: string;
  allowedEntityTypes: PlacementEntityType[];
  allowHousePromotions: boolean;
  allowSponsoredPromotions: boolean;
  maxAssignments: number;
  localeTargets: string[];
  status: PlacementZoneStatus;
}

export interface SponsorshipProductSeedDefinition {
  code: string;
  name: string;
  description: string;
  eligiblePlanIds: DealerPlanId[];
  eligibleEntityTypes: PlacementEntityType[];
  defaultDurationDays: number;
  priceLabel: string;
  status: SponsorshipProductStatus;
}

export const DEFAULT_PUBLIC_PLACEMENT_ZONES: readonly PlacementZoneSeedDefinition[] = [
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.homeDealerSpotlight,
    name: 'Home dealer spotlight',
    description: 'Featured dealer rail on the home page below the value proposition section.',
    pageKey: 'home',
    slotKey: 'dealer_spotlight',
    allowedEntityTypes: ['dealer', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.homeModelSpotlight,
    name: 'Home model spotlight',
    description: 'Featured model rail on the home page above the featured models section.',
    pageKey: 'home',
    slotKey: 'model_spotlight',
    allowedEntityTypes: ['model', 'listing', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.homeBlogSpotlight,
    name: 'Home blog spotlight',
    description: 'Featured editorial or platform campaign rail above the home blog section.',
    pageKey: 'home',
    slotKey: 'blog_spotlight',
    allowedEntityTypes: ['blog_post', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.dealersIndexSpotlight,
    name: 'Dealers index spotlight',
    description: 'Promotional rail shown near the top of the public dealers directory.',
    pageKey: 'dealers',
    slotKey: 'index_spotlight',
    allowedEntityTypes: ['dealer', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.dealerDetailSpotlight,
    name: 'Dealer detail spotlight',
    description: 'Promotional rail shown inside public dealer profile pages.',
    pageKey: 'dealers',
    slotKey: 'detail_spotlight',
    allowedEntityTypes: ['dealer', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.modelsIndexSpotlight,
    name: 'Models index spotlight',
    description: 'Promotional rail shown near the top of the public models directory.',
    pageKey: 'models',
    slotKey: 'index_spotlight',
    allowedEntityTypes: ['model', 'listing', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.modelDetailSpotlight,
    name: 'Model detail spotlight',
    description: 'Promotional rail shown inside public EV model profile pages.',
    pageKey: 'models',
    slotKey: 'detail_spotlight',
    allowedEntityTypes: ['model', 'listing', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.listingsIndexSpotlight,
    name: 'Listings index spotlight',
    description: 'Promotional rail shown above the public listings grid.',
    pageKey: 'listings',
    slotKey: 'index_spotlight',
    allowedEntityTypes: ['listing', 'dealer', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.listingDetailSpotlight,
    name: 'Listing detail spotlight',
    description: 'Promotional rail shown inside public listing detail pages.',
    pageKey: 'listings',
    slotKey: 'detail_spotlight',
    allowedEntityTypes: ['listing', 'dealer', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.blogIndexSpotlight,
    name: 'Blog index spotlight',
    description: 'Promotional rail shown above the public blog archive.',
    pageKey: 'blog',
    slotKey: 'index_spotlight',
    allowedEntityTypes: ['blog_post', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.blogPostSpotlight,
    name: 'Blog post spotlight',
    description: 'Promotional rail shown inside public blog article pages.',
    pageKey: 'blog',
    slotKey: 'post_spotlight',
    allowedEntityTypes: ['blog_post', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
  {
    key: PUBLIC_PLACEMENT_ZONE_KEYS.chargingStationsIndexSpotlight,
    name: 'Charging stations spotlight',
    description: 'Promotional rail shown above the Albania charging stations directory.',
    pageKey: 'charging_stations',
    slotKey: 'index_spotlight',
    allowedEntityTypes: ['charging_station', 'service', 'custom'],
    allowHousePromotions: true,
    allowSponsoredPromotions: true,
    maxAssignments: 3,
    localeTargets: [],
    status: 'active',
  },
] as const;

export const DEFAULT_SPONSORSHIP_PRODUCTS: readonly SponsorshipProductSeedDefinition[] = [
  {
    code: 'featured_dealer_spotlight',
    name: 'Featured dealer spotlight',
    description: 'Paid dealer placement inventory for featured dealer visibility across public index pages.',
    eligiblePlanIds: ['paid'],
    eligibleEntityTypes: ['dealer'],
    defaultDurationDays: 30,
    priceLabel: 'Custom quote',
    status: 'active',
  },
  {
    code: 'featured_listing_spotlight',
    name: 'Featured listing spotlight',
    description: 'Paid listing promotion inventory for highlighted vehicle placements.',
    eligiblePlanIds: ['paid'],
    eligibleEntityTypes: ['listing'],
    defaultDurationDays: 30,
    priceLabel: 'Custom quote',
    status: 'active',
  },
  {
    code: 'featured_model_spotlight',
    name: 'Featured model spotlight',
    description: 'Paid model promotion inventory for EV model merchandising across the platform.',
    eligiblePlanIds: ['paid'],
    eligibleEntityTypes: ['model'],
    defaultDurationDays: 30,
    priceLabel: 'Custom quote',
    status: 'active',
  },
  {
    code: 'featured_charging_station_spotlight',
    name: 'Featured charging station spotlight',
    description: 'Paid charging station promotion inventory for network and location visibility.',
    eligiblePlanIds: ['paid'],
    eligibleEntityTypes: ['charging_station'],
    defaultDurationDays: 30,
    priceLabel: 'Custom quote',
    status: 'active',
  },
  {
    code: 'sponsored_editorial_spotlight',
    name: 'Sponsored editorial spotlight',
    description: 'Paid editorial and partner content promotion inventory for blog surfaces.',
    eligiblePlanIds: ['paid'],
    eligibleEntityTypes: ['blog_post'],
    defaultDurationDays: 14,
    priceLabel: 'Custom quote',
    status: 'active',
  },
  {
    code: 'featured_service_spotlight',
    name: 'Featured service spotlight',
    description: 'Paid service or custom promotion inventory for internal offers and partner campaigns.',
    eligiblePlanIds: ['paid'],
    eligibleEntityTypes: ['service', 'custom'],
    defaultDurationDays: 30,
    priceLabel: 'Custom quote',
    status: 'active',
  },
] as const;

export const formatPlacementEntityTypeLabel = (value: PlacementEntityType) =>
  value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
