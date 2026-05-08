
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'dealer' | 'user' | 'pending';
export type AccountType = 'admin' | 'dealer' | 'dealer_staff' | 'user' | 'pending';
export type DealerStaffRole = 'owner' | 'manager' | 'editor';
export type AccountStatus =
  | 'active'
  | 'pending'
  | 'approved'
  | 'suspended'
  | 'disabled'
  | 'archived'
  | 'rejected';
export type AdminRoleId =
  | 'master_admin'
  | 'platform_ops_admin'
  | 'dealer_ops_admin'
  | 'user_support_admin'
  | 'catalog_admin'
  | 'charging_admin'
  | 'content_admin'
  | 'analyst';
export type DealerPlanId = 'free' | 'paid';
export type DealerSubscriptionStatus = 'active' | 'paused' | 'expired' | 'cancelled';
export type AccessInviteType = 'platform_admin' | 'dealer_staff';
export type AccessInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type AuditAction =
  | 'admin_note.created'
  | 'invite.created'
  | 'invite.revoked'
  | 'invite.accepted'
  | 'dealer_plan.updated'
  | 'dealer.updated'
  | 'dealer_owner.updated'
  | 'dealer_account.updated'
  | 'dealer_status.updated'
  | 'dealer_staff.updated'
  | 'admin_access.updated'
  | 'user_status.updated'
  | 'listing.updated'
  | 'model.updated'
  | 'charging_station.updated'
  | 'placement_zone.updated'
  | 'sponsorship_product.updated'
  | 'sponsorship_order.updated'
  | 'promotional_campaign.updated'
  | 'blog_post.updated';
export type AuditEntityType =
  | 'invite'
  | 'dealer'
  | 'user'
  | 'listing'
  | 'model'
  | 'charging_station'
  | 'placement_zone'
  | 'sponsorship_product'
  | 'sponsorship_order'
  | 'promotional_campaign'
  | 'blog_post';
export type PlacementEntityType =
  | 'dealer'
  | 'listing'
  | 'model'
  | 'charging_station'
  | 'blog_post'
  | 'service'
  | 'custom';
export type PlacementZoneStatus = 'active' | 'inactive' | 'archived';
export type SponsorshipProductStatus = 'active' | 'inactive' | 'archived';
export type SponsorshipOrderStatus =
  | 'draft'
  | 'quoted'
  | 'reserved'
  | 'paid'
  | 'active'
  | 'expired'
  | 'cancelled';
export type SponsorshipPaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'partial'
  | 'refunded'
  | 'waived';
export type PromotionalCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'archived';
export type PromotionalCampaignPromotionType = 'house_promotion' | 'sponsored_promotion';
export type PlacementAnalyticsEventType = 'impression' | 'click';
export type PermissionKey =
  | 'users.read'
  | 'users.edit'
  | 'users.suspend'
  | 'users.reactivate'
  | 'dealers.read'
  | 'dealers.edit'
  | 'dealers.approve'
  | 'dealers.manage_staff'
  | 'dealer_plans.read'
  | 'dealer_plans.assign'
  | 'dealer_plans.override'
  | 'listings.read'
  | 'listings.moderate'
  | 'listings.reassign'
  | 'models.read'
  | 'models.publish'
  | 'models.merge'
  | 'stations.read'
  | 'stations.edit'
  | 'stations.merge'
  | 'blog.read'
  | 'blog.publish'
  | 'blog.schedule'
  | 'placements.read'
  | 'placements.create'
  | 'placements.edit'
  | 'placements.assign'
  | 'placements.publish'
  | 'placements.pause'
  | 'placements.override'
  | 'placements.analytics_read'
  | 'placements.billing_read'
  | 'enquiries.read'
  | 'admins.invite'
  | 'admins.assign_permissions'
  | 'audit.view'
  | 'reports.read'
  | 'reports.export';

export interface PermissionScope {
  type: 'global' | 'dealer' | 'locale' | 'entity';
  value?: string;
  entityType?: string;
}

export type PermissionOverrides = Partial<Record<PermissionKey, boolean>>;

export interface DealerPlanEntitlements {
  maxActiveListings: number | null;
  maxStaffAccounts: number;
  richProfileEnabled: boolean;
  richMediaEnabled: boolean;
  videoEnabled: boolean;
  advancedAnalyticsEnabled: boolean;
  promotionEligibility: boolean;
  campaignPurchaseEligibility: boolean;
  prioritySupport: boolean;
}

export interface DealerPlanDefinition {
  id: DealerPlanId;
  name: string;
  description: string;
  entitlements: DealerPlanEntitlements;
}

export interface AdminAuditLog {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  actorUid: string;
  actorEmail?: string | null;
  actorAdminRoleIds?: AdminRoleId[];
  targetUid?: string | null;
  targetEmail?: string | null;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Timestamp | string | null;
}

export interface AdminEntityNote {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  body: string;
  createdByUid: string;
  createdByEmail?: string | null;
  createdAt?: Timestamp | string | null;
}

export interface AdminEntityListingSummary {
  id: string;
  title: string;
  status: string | null;
  dealerId: string | null;
  dealerName: string | null;
  ownerUid: string | null;
  price: string | null;
  createdAt?: Timestamp | string | null;
  updatedAt?: Timestamp | string | null;
}

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  role: UserRole;
}

export interface UserProfile extends AuthenticatedUser {
  displayName?: string | null;
  status?: AccountStatus;
  accountType?: AccountType;
  accountStatus?: AccountStatus;
  adminRoleIds?: AdminRoleId[];
  directPermissions?: PermissionOverrides;
  permissionScopes?: PermissionScope[];
  isMasterAdmin?: boolean;
  dealerId?: string | null;
  dealerStaffRole?: DealerStaffRole | null;
  dealerPlanId?: DealerPlanId | null;
  dealerSubscriptionStatus?: DealerSubscriptionStatus | null;
  [key: string]: unknown;
}

export type DealerStatus = 'pending' | 'approved' | 'rejected' | 'deleted';

interface FirestoreTimestamps {
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AccessInvite {
  id: string;
  type: AccessInviteType;
  status: AccessInviteStatus;
  email: string;
  inviteUrl?: string | null;
  dealerId?: string | null;
  dealerName?: string | null;
  adminRoleIds?: AdminRoleId[];
  directPermissions?: PermissionOverrides;
  dealerStaffRole?: DealerStaffRole | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  revokedBy?: string | null;
  acceptedBy?: string | null;
  createdAt?: Timestamp | string | null;
  updatedAt?: Timestamp | string | null;
  expiresAt?: Timestamp | string | null;
  acceptedAt?: Timestamp | string | null;
  revokedAt?: Timestamp | string | null;
}

export interface PlacementZone extends FirestoreTimestamps {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  pageKey: string;
  slotKey: string;
  allowedEntityTypes: PlacementEntityType[];
  allowHousePromotions: boolean;
  allowSponsoredPromotions: boolean;
  maxAssignments: number;
  localeTargets?: string[];
  status?: PlacementZoneStatus;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface PlacementZoneFormValues {
  key: string;
  name: string;
  description: string;
  pageKey: string;
  slotKey: string;
  allowedEntityTypes: PlacementEntityType[];
  allowHousePromotions: boolean;
  allowSponsoredPromotions: boolean;
  maxAssignments: number | '';
  localeTargets: string[];
  status: PlacementZoneStatus;
}

export interface SponsorshipProduct extends FirestoreTimestamps {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  eligiblePlanIds: DealerPlanId[];
  eligibleEntityTypes: PlacementEntityType[];
  defaultDurationDays?: number | null;
  priceLabel?: string | null;
  status?: SponsorshipProductStatus;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface SponsorshipProductFormValues {
  code: string;
  name: string;
  description: string;
  eligiblePlanIds: DealerPlanId[];
  eligibleEntityTypes: PlacementEntityType[];
  defaultDurationDays: number | '';
  priceLabel: string;
  status: SponsorshipProductStatus;
}

export interface SponsorshipOrder extends FirestoreTimestamps {
  id: string;
  name: string;
  dealerId: string;
  sponsorshipProductId: string;
  campaignId?: string | null;
  zoneIds: string[];
  sponsoredEntityType?: PlacementEntityType | null;
  sponsoredEntityId?: string | null;
  status: SponsorshipOrderStatus;
  paymentStatus: SponsorshipPaymentStatus;
  priceAmount?: number | null;
  currency?: string | null;
  priceLabel?: string | null;
  invoiceReference?: string | null;
  startAt?: Timestamp | string | null;
  endAt?: Timestamp | string | null;
  paidAt?: Timestamp | string | null;
  dealerPlanId?: DealerPlanId | null;
  notes?: string | null;
  internalNotes?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface SponsorshipOrderFormValues {
  name: string;
  dealerId: string;
  sponsorshipProductId: string;
  campaignId: string;
  zoneIds: string[];
  sponsoredEntityType: PlacementEntityType | '';
  sponsoredEntityId: string;
  status: SponsorshipOrderStatus;
  paymentStatus: SponsorshipPaymentStatus;
  priceAmount: number | '';
  currency: string;
  priceLabel: string;
  invoiceReference: string;
  startAt: string;
  endAt: string;
  paidAt: string;
  notes: string;
  internalNotes: string;
}

export interface DealerPlacementRequestFormValues {
  name: string;
  sponsorshipProductId: string;
  sponsoredEntityType: Extract<PlacementEntityType, 'dealer' | 'listing' | 'model'> | '';
  sponsoredEntityId: string;
  zoneIds: string[];
  startAt: string;
  endAt: string;
  notes: string;
}

export interface PromotionalCampaign extends FirestoreTimestamps {
  id: string;
  name: string;
  description?: string | null;
  status: PromotionalCampaignStatus;
  promotionType: PromotionalCampaignPromotionType;
  sponsoredEntityType?: PlacementEntityType | null;
  sponsoredEntityId?: string | null;
  sponsorshipProductId?: string | null;
  zoneIds: string[];
  headline?: string | null;
  supportingText?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  destinationUrl?: string | null;
  localeTargets?: string[];
  startAt?: Timestamp | string | null;
  endAt?: Timestamp | string | null;
  priority: number;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface PromotionalCampaignFormValues {
  name: string;
  description: string;
  status: PromotionalCampaignStatus;
  promotionType: PromotionalCampaignPromotionType;
  sponsoredEntityType: PlacementEntityType | '';
  sponsoredEntityId: string;
  sponsorshipProductId: string;
  zoneIds: string[];
  headline: string;
  supportingText: string;
  imageUrl: string;
  ctaLabel: string;
  destinationUrl: string;
  localeTargets: string[];
  startAt: string;
  endAt: string;
  priority: number | '';
}

export interface PublicPlacementResolvedEntity {
  entityType: PlacementEntityType;
  entityId: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  destinationUrl?: string | null;
  meta?: string[];
}

export interface PublicPlacementResolvedItem {
  campaignId: string;
  campaignName: string;
  zoneId: string;
  zoneKey: string;
  zoneName: string;
  promotionType: PromotionalCampaignPromotionType;
  entityType: PlacementEntityType;
  entityId?: string | null;
  headline: string;
  supportingText?: string | null;
  imageUrl?: string | null;
  destinationUrl?: string | null;
  ctaLabel?: string | null;
  priority: number;
  sponsorshipProductName?: string | null;
  sponsorshipProductCode?: string | null;
  entity?: PublicPlacementResolvedEntity | null;
}

export interface PublicPlacementZoneResult {
  zoneId: string;
  zoneKey: string;
  zoneName: string;
  pageKey: string;
  slotKey: string;
  items: PublicPlacementResolvedItem[];
}

export interface PublicPlacementResolveResponse {
  ok: true;
  zones: PublicPlacementZoneResult[];
  resolvedAt: string;
}

export interface PlacementCampaignAnalyticsSummary {
  campaignId: string;
  impressions: number;
  clicks: number;
  ctr: number;
  lastImpressionAt?: string | null;
  lastClickAt?: string | null;
  updatedAt?: string | null;
}

export interface PlacementAnalyticsZoneSummary {
  zoneKey: string;
  impressions: number;
  clicks: number;
  ctr: number;
  lastImpressionAt?: string | null;
  lastClickAt?: string | null;
  updatedAt?: string | null;
}

export interface PlacementAnalyticsDailyBucket {
  dateKey: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface PlacementAnalyticsFilters {
  days: number;
  zoneKey?: string | null;
}

export interface PlacementZoneAvailabilitySummary {
  zoneId: string;
  zoneKey: string;
  zoneName: string;
  maxAssignments: number;
  reservedAssignments: number;
  availableAssignments: number;
  blockingOrderIds: string[];
  blockingCampaignIds: string[];
  nextReleaseAt?: string | null;
}

interface DealerCore {
  name: string;
  description?: string;
  companyName?: string;
  contactName?: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  contact_phone?: string;
  contact_email?: string;
  website?: string;
  social_links?: { facebook?: string; instagram?: string; twitter?: string; youtube?: string; };
  brands: string[];
  languages: string[];
  notes?: string;
  typeOfCars: string;
  priceRange?: string;
  modelsAvailable: string[];
  image_url?: string;
  logo_url?: string | null;
  location?: string | null;
  isActive?: boolean;
  status?: DealerStatus;
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
  isFeatured?: boolean;
  imageGallery?: string[];
  planId?: DealerPlanId;
  subscriptionStatus?: DealerSubscriptionStatus;
}

export interface DealerDocument extends DealerCore, FirestoreTimestamps {
  ownerUid?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  approved?: boolean;
  approvedAt?: Timestamp | null;
  rejectedAt?: Timestamp | null;
  rejectionReason?: string | null;
}

export interface Dealer extends DealerDocument {
  id: string;
}

interface ModelCore {
  brand: string;
  model_name: string;
  source?: 'ai' | 'api' | 'manual';
  year_start?: number;
  body_type?: string;
  charge_port?: string;
  charge_power?: number; // in kW
  autocharge_supported?: boolean;
  battery_capacity?: number; // in kWh
  battery_useable_capacity?: number; // in kWh
  battery_type?: string;
  battery_voltage?: number;
  range_wltp?: number; // in km
  power_kw?: number; // in kW
  torque_nm?: number; // in Nm
  acceleration_0_100?: number; // in s
  acceleration_0_60?: number; // in s
  top_speed?: number; // in km/h
  drive_type?: string;
  seats?: number;
  charging_ac?: string;
  charging_dc?: string;
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  wheelbase_mm?: number;
  weight_kg?: number;
  cargo_volume_l?: number;
  notes?: string;
  image_url?: string;
  isFeatured?: boolean;
  imageGallery?: string[];
  isActive?: boolean;
}

export interface ModelOwnershipMetadata extends FirestoreTimestamps {
  ownerDealerId?: string | null;
  ownerUid?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface Model extends ModelCore, ModelOwnershipMetadata {
  id: string;
}

export interface DealerModel {
  dealer_id: string;
  model_id: string;
}

export interface FavouriteEntry extends FirestoreTimestamps {
  id: string;
  itemId: string;
  userId: string;
  role?: UserRole | null;
  collection?: string;
}

export interface BlogPostList {
  title?: string;
  ordered?: boolean;
  items: string[];
}

export interface BlogPostSection {
  id: string;
  heading: string;
  paragraphs: string[];
  list?: BlogPostList;
  highlight?: string;
}

export interface BlogPostFaq {
  question: string;
  answer: string;
}

export interface BlogPostCta {
  text: string;
  url: string;
}

interface BlogPostMetadata extends FirestoreTimestamps {
  ownerUid?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  published?: boolean;
  publishedAt?: Timestamp | null;
  status?: 'draft' | 'published';
}

export interface BlogPostTranslation {
  title: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  metaRobots?: string;
  sections: BlogPostSection[];
  faqs?: BlogPostFaq[];
}

export interface BlogPost extends BlogPostMetadata {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  imageUrl: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  metaRobots?: string;
  tags: string[];
  sections: BlogPostSection[];
  faqs?: BlogPostFaq[];
  cta?: BlogPostCta;
  translations?: {
    en?: BlogPostTranslation;
    it?: BlogPostTranslation;
  };
}

// Charging Stations
export interface ChargingStationDocument {
  address: string;
  plugTypes: string; // e.g., "CCS2, GB/T"
  chargingSpeedKw: number;
  operator: string | null;
  pricingDetails: string | null;
  googleMapsLink: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  isActive?: boolean;
}

export interface ChargingStation extends ChargingStationDocument {
  id: string;
}

export interface ChargingStationFormValues {
  address: string;
  plugTypes: string;
  chargingSpeedKw: number | '';
  operator: string;
  pricingDetails: string;
  googleMapsLink: string;
  latitude: number | '';
  longitude: number | '';
  isActive?: boolean;
}

export type StationSource = 'custom' | 'ocm';

export type ListingStatus = 'pending' | 'approved' | 'active' | 'inactive' | 'deleted' | 'rejected';

export interface ListingFinancialOptions {
  loanSupported?: boolean;
  loanTermMonths?: number;
  downPaymentMin?: number;
  monthlyPaymentEstimate?: number;
  leasingSupported?: boolean;
}

export interface ListingLocation {
  lat?: number;
  lng?: number;
  address?: string;
  city?: string;
}

export interface Listing extends FirestoreTimestamps {
  id: string;
  dealerId: string;
  status: ListingStatus;

  // Vehicle Details
  title: string;
  description: string;
  modelId?: string;
  make: string;
  model: string;
  year: number;
  bodyType: string;
  mileage: number;
  fuelType: string; // 'Electric', 'Hybrid', 'Plug-in Hybrid', etc.

  // EV Specifics
  batteryCapacity?: number; // kWh
  range?: number; // km (WLTP usually)

  // Pricing
  price: number;
  priceCurrency: string; // 'EUR', 'ALL'
  financialOptions?: ListingFinancialOptions;

  // Media
  images: string[];
  imageGallery?: string[];
  videoUrl?: string;

  // Location
  location?: ListingLocation;

  // Flags
  isFeatured?: boolean;
  isForRent?: boolean;
  isForSubscription?: boolean;

  // Admin/System
  approvedAt?: Timestamp | null;
  rejectedAt?: Timestamp | null;
  rejectionReason?: string;

  ownerUid?: string; // For security rules mostly
}

export interface Enquiry {
  id: string;
  listingId: string;
  dealerId: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  createdAt: any; // Firestore Timestamp
}

