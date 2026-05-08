import type { Firestore } from 'firebase-admin/firestore';
import type {
  BlogPost,
  ChargingStation,
  Dealer,
  Listing,
  Model,
  PlacementEntityType,
  PlacementZone,
  PromotionalCampaign,
  PublicPlacementResolvedEntity,
  PublicPlacementResolvedItem,
  PublicPlacementZoneResult,
  SponsorshipProduct,
} from '../../../types';
import { getLocalizedBlogPost } from '../../../utils/localizedBlogPost';
import { normalizeAppLocale } from '../../../utils/localizedRouting';
import {
  serializePlacementZone,
  serializePromotionalCampaign,
  serializeSponsorshipProduct,
} from './placements';

const TARGET_COLLECTIONS: Partial<Record<PlacementEntityType, string>> = {
  dealer: 'dealers',
  listing: 'listings',
  model: 'models',
  charging_station: 'charging_stations',
  blog_post: 'blogPosts',
};

const MAX_QUERY_BATCH = 10;

const chunk = <T>(items: T[], size: number) => {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
};

const cleanString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const compact = (values: Array<string | null | undefined>) =>
  values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

const matchesLocaleTargets = (targets: string[] | undefined, locale: string) =>
  !targets?.length || targets.includes(locale);

const toTimestampMillis = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return null;
    }
  }

  return null;
};

const isCampaignCurrentlyActive = (campaign: PromotionalCampaign, now: number) => {
  if (campaign.status === 'draft' || campaign.status === 'paused' || campaign.status === 'archived') {
    return false;
  }

  const startsAt = toTimestampMillis(campaign.startAt);
  const endsAt = toTimestampMillis(campaign.endAt);

  if (startsAt !== null && startsAt > now) {
    return false;
  }

  if (endsAt !== null && endsAt < now) {
    return false;
  }

  return true;
};

const getEntityDestinationUrl = (
  entityType: PlacementEntityType,
  entityId: string,
  data: Record<string, unknown>,
) => {
  if (entityType === 'dealer') {
    return `/dealers/${entityId}`;
  }

  if (entityType === 'model') {
    return `/models/${entityId}`;
  }

  if (entityType === 'listing') {
    return `/listings/${entityId}`;
  }

  if (entityType === 'blog_post') {
    const slug = cleanString(data.slug);
    return slug ? `/blog/${slug}` : null;
  }

  if (entityType === 'charging_station') {
    const latitude = typeof data.latitude === 'number' ? data.latitude : null;
    const longitude = typeof data.longitude === 'number' ? data.longitude : null;
    const query = new URLSearchParams();
    const stationSearch = cleanString(data.operator) ?? cleanString(data.address);

    if (latitude !== null && longitude !== null) {
      query.set('lat', latitude.toFixed(5));
      query.set('lng', longitude.toFixed(5));
      query.set('z', '15');
    }

    if (stationSearch) {
      query.set('q', stationSearch);
    }

    const search = query.toString();
    return search.length > 0
      ? `/albania-charging-stations?${search}`
      : '/albania-charging-stations';
  }

  return null;
};

const formatListingPrice = (listing: Listing, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: listing.priceCurrency || 'EUR',
      maximumFractionDigits: 0,
    }).format(listing.price);
  } catch {
    return `${listing.price.toLocaleString()} ${listing.priceCurrency}`;
  }
};

const formatBlogDate = (value: string, locale: string) => {
  try {
    return new Date(value).toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const isDealerPublic = (dealer: Dealer) => {
  const status = dealer.status ?? (dealer.approved === false ? 'pending' : 'approved');
  return dealer.isDeleted !== true && dealer.isActive !== false && status === 'approved';
};

const isListingPublic = (listing: Listing) =>
  listing.status === 'approved' || listing.status === 'active';

const isModelPublic = (model: Model) => model.isActive !== false;

const isBlogPostPublic = (post: BlogPost) =>
  post.published === true || post.status === 'published';

const isChargingStationPublic = (station: ChargingStation) => station.isActive !== false;

const toResolvedEntity = (
  entityType: PlacementEntityType,
  entityId: string,
  locale: string,
  data: Record<string, unknown>,
): PublicPlacementResolvedEntity | null => {
  if (entityType === 'dealer') {
    const dealer = { id: entityId, ...(data as unknown as Partial<Dealer>) } as Dealer;
    if (!isDealerPublic(dealer)) {
      return null;
    }

    return {
      entityType,
      entityId,
      title: dealer.name,
      subtitle: cleanString(dealer.city) ?? cleanString(dealer.location),
      description: dealer.brands?.length ? dealer.brands.slice(0, 4).join(', ') : cleanString(dealer.description),
      imageUrl: cleanString(dealer.logo_url) ?? cleanString(dealer.image_url) ?? dealer.imageGallery?.[0] ?? null,
      destinationUrl: getEntityDestinationUrl(entityType, entityId, data),
      meta: compact([
        cleanString(dealer.city),
        dealer.brands?.length ? `${dealer.brands.length} brands` : null,
      ]),
    };
  }

  if (entityType === 'model') {
    const model = { id: entityId, ...(data as unknown as Partial<Model>) } as Model;
    if (!isModelPublic(model)) {
      return null;
    }

    return {
      entityType,
      entityId,
      title: compact([cleanString(model.brand), cleanString(model.model_name)]).join(' '),
      subtitle: cleanString(model.body_type),
      description: compact([
        typeof model.range_wltp === 'number' ? `${model.range_wltp} km WLTP` : null,
        typeof model.battery_capacity === 'number' ? `${model.battery_capacity} kWh battery` : null,
      ]).join(' • ') || cleanString(model.notes),
      imageUrl: cleanString(model.image_url) ?? model.imageGallery?.[0] ?? null,
      destinationUrl: getEntityDestinationUrl(entityType, entityId, data),
      meta: compact([
        cleanString(model.brand),
        typeof model.range_wltp === 'number' ? `${model.range_wltp} km` : null,
      ]),
    };
  }

  if (entityType === 'listing') {
    const listing = { id: entityId, ...(data as unknown as Partial<Listing>) } as Listing;
    if (!isListingPublic(listing)) {
      return null;
    }

    return {
      entityType,
      entityId,
      title: compact([cleanString(listing.make), cleanString(listing.model)]).join(' '),
      subtitle: cleanString(listing.location?.city),
      description:
        cleanString(listing.title) ??
        compact([
          typeof listing.year === 'number' ? `${listing.year}` : null,
          cleanString(listing.fuelType),
        ]).join(' • '),
      imageUrl: listing.images?.[0] ?? listing.imageGallery?.[0] ?? cleanString((data as Record<string, unknown>).image_url) ?? null,
      destinationUrl: getEntityDestinationUrl(entityType, entityId, data),
      meta: compact([
        formatListingPrice(listing, locale),
        typeof listing.year === 'number' ? `${listing.year}` : null,
        cleanString(listing.location?.city),
      ]),
    };
  }

  if (entityType === 'blog_post') {
    const localizedPost = getLocalizedBlogPost(
      { id: entityId, ...(data as unknown as Partial<BlogPost>) } as BlogPost,
      locale,
    );
    if (!isBlogPostPublic(localizedPost)) {
      return null;
    }

    return {
      entityType,
      entityId,
      title: localizedPost.title,
      subtitle: localizedPost.author,
      description: localizedPost.excerpt,
      imageUrl: cleanString(localizedPost.imageUrl),
      destinationUrl: getEntityDestinationUrl(entityType, entityId, localizedPost as unknown as Record<string, unknown>),
      meta: compact([
        formatBlogDate(localizedPost.date, locale),
        cleanString(localizedPost.readTime),
      ]),
    };
  }

  if (entityType === 'charging_station') {
    const station = {
      id: entityId,
      ...(data as unknown as Partial<ChargingStation>),
    } as ChargingStation;
    if (!isChargingStationPublic(station)) {
      return null;
    }

    return {
      entityType,
      entityId,
      title: cleanString(station.operator) ?? cleanString(station.address) ?? 'Charging station',
      subtitle: cleanString(station.address),
      description: compact([
        cleanString(station.plugTypes),
        typeof station.chargingSpeedKw === 'number' ? `${station.chargingSpeedKw} kW` : null,
        cleanString(station.pricingDetails),
      ]).join(' • '),
      imageUrl: null,
      destinationUrl: getEntityDestinationUrl(entityType, entityId, data),
      meta: compact([
        typeof station.chargingSpeedKw === 'number' ? `${station.chargingSpeedKw} kW` : null,
        cleanString(station.plugTypes),
      ]),
    };
  }

  return null;
};

const resolveEntitySummary = async (
  firestore: Firestore,
  entityType: PlacementEntityType,
  entityId: string,
  locale: string,
) => {
  const collectionName = TARGET_COLLECTIONS[entityType];
  if (!collectionName) {
    return null;
  }

  const snapshot = await firestore.collection(collectionName).doc(entityId).get();
  if (!snapshot.exists) {
    return null;
  }

  return toResolvedEntity(entityType, entityId, locale, snapshot.data() ?? {});
};

const buildResolvedItem = (
  zone: PlacementZone,
  campaign: PromotionalCampaign,
  locale: string,
  entity: PublicPlacementResolvedEntity | null,
  product: SponsorshipProduct | null,
): PublicPlacementResolvedItem | null => {
  const fallbackEntityType = campaign.sponsoredEntityType ?? 'custom';
  const destinationUrl =
    cleanString(campaign.destinationUrl) ??
    cleanString(entity?.destinationUrl) ??
    null;
  const headline =
    cleanString(campaign.headline) ??
    cleanString(entity?.title) ??
    cleanString(campaign.name);
  const supportingText =
    cleanString(campaign.supportingText) ??
    cleanString(entity?.description) ??
    cleanString(campaign.description);
  const imageUrl = cleanString(campaign.imageUrl) ?? cleanString(entity?.imageUrl);

  if (!headline || !destinationUrl) {
    return null;
  }

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    zoneId: zone.id,
    zoneKey: zone.key,
    zoneName: zone.name,
    promotionType: campaign.promotionType,
    entityType: entity?.entityType ?? fallbackEntityType,
    entityId: campaign.sponsoredEntityId ?? entity?.entityId ?? null,
    headline,
    supportingText,
    imageUrl,
    destinationUrl,
    ctaLabel: cleanString(campaign.ctaLabel),
    priority: campaign.priority,
    sponsorshipProductName: product?.name ?? null,
    sponsorshipProductCode: product?.code ?? null,
    entity,
  };
};

const sortCampaigns = (left: PromotionalCampaign, right: PromotionalCampaign) => {
  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }

  const leftUpdated = toTimestampMillis(left.updatedAt) ?? toTimestampMillis(left.createdAt) ?? 0;
  const rightUpdated = toTimestampMillis(right.updatedAt) ?? toTimestampMillis(right.createdAt) ?? 0;
  return rightUpdated - leftUpdated;
};

const fetchZonesByKeys = async (firestore: Firestore, zoneKeys: string[]) => {
  const batches = chunk(zoneKeys, MAX_QUERY_BATCH);
  const snapshots = await Promise.all(
    batches.map(batch => firestore.collection('placementZones').where('key', 'in', batch).get()),
  );

  return snapshots.flatMap(snapshot =>
    snapshot.docs.map(doc => serializePlacementZone(doc.id, doc.data())),
  );
};

const fetchCampaignsForZoneIds = async (firestore: Firestore, zoneIds: string[]) => {
  const batches = chunk(zoneIds, MAX_QUERY_BATCH);
  const snapshots = await Promise.all(
    batches.map(batch =>
      firestore.collection('promotionalCampaigns').where('zoneIds', 'array-contains-any', batch).get(),
    ),
  );

  const campaignMap = new Map<string, PromotionalCampaign>();
  snapshots.forEach(snapshot => {
    snapshot.docs.forEach(doc => {
      campaignMap.set(doc.id, serializePromotionalCampaign(doc.id, doc.data()));
    });
  });

  return Array.from(campaignMap.values());
};

const fetchSponsorshipProducts = async (
  firestore: Firestore,
  campaigns: PromotionalCampaign[],
) => {
  const productIds = Array.from(
    new Set(
      campaigns
        .map(campaign => cleanString(campaign.sponsorshipProductId))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const entries = await Promise.all(
    productIds.map(async productId => {
      const snapshot = await firestore.collection('sponsorshipProducts').doc(productId).get();
      if (!snapshot.exists) {
        return null;
      }

      const product = serializeSponsorshipProduct(productId, snapshot.data() ?? {});
      return [productId, product] as const;
    }),
  );

  return new Map(entries.filter((entry): entry is readonly [string, SponsorshipProduct] => Boolean(entry)));
};

export const resolvePublicPlacementZones = async (
  firestore: Firestore,
  zoneKeys: string[],
  localeInput?: string | null,
): Promise<PublicPlacementZoneResult[]> => {
  const locale = normalizeAppLocale(localeInput);
  const normalizedKeys = Array.from(
    new Set(
      zoneKeys
        .map(key => key.trim().toLowerCase())
        .filter(key => key.length > 0),
    ),
  );

  if (!normalizedKeys.length) {
    return [];
  }

  const now = Date.now();
  const zones = (await fetchZonesByKeys(firestore, normalizedKeys))
    .filter(zone => zone.status === 'active')
    .filter(zone => matchesLocaleTargets(zone.localeTargets, locale))
    .sort(
      (left, right) => normalizedKeys.indexOf(left.key) - normalizedKeys.indexOf(right.key),
    );

  if (!zones.length) {
    return [];
  }

  const zoneIds = zones.map(zone => zone.id);
  const campaigns = (await fetchCampaignsForZoneIds(firestore, zoneIds))
    .filter(campaign => isCampaignCurrentlyActive(campaign, now))
    .filter(campaign => matchesLocaleTargets(campaign.localeTargets, locale))
    .sort(sortCampaigns);

  const productsById = await fetchSponsorshipProducts(firestore, campaigns);
  const entityCache = new Map<string, PublicPlacementResolvedEntity | null>();

  const zoneResults = await Promise.all(
    zones.map(async zone => {
      const zoneCampaigns = campaigns.filter(campaign => campaign.zoneIds.includes(zone.id));
      const items: PublicPlacementResolvedItem[] = [];

      for (const campaign of zoneCampaigns) {
        if (items.length >= zone.maxAssignments) {
          break;
        }

        const product =
          campaign.sponsorshipProductId ? productsById.get(campaign.sponsorshipProductId) ?? null : null;

        if (
          campaign.promotionType === 'sponsored_promotion' &&
          (!product || product.status !== 'active')
        ) {
          continue;
        }

        let entity: PublicPlacementResolvedEntity | null = null;
        if (campaign.sponsoredEntityType && campaign.sponsoredEntityId) {
          const cacheKey = `${campaign.sponsoredEntityType}:${campaign.sponsoredEntityId}:${locale}`;
          if (!entityCache.has(cacheKey)) {
            entityCache.set(
              cacheKey,
              await resolveEntitySummary(
                firestore,
                campaign.sponsoredEntityType,
                campaign.sponsoredEntityId,
                locale,
              ),
            );
          }
          entity = entityCache.get(cacheKey) ?? null;
        }

        const item = buildResolvedItem(zone, campaign, locale, entity, product);
        if (item) {
          items.push(item);
        }
      }

      return {
        zoneId: zone.id,
        zoneKey: zone.key,
        zoneName: zone.name,
        pageKey: zone.pageKey,
        slotKey: zone.slotKey,
        items,
      } satisfies PublicPlacementZoneResult;
    }),
  );

  return zoneResults;
};
