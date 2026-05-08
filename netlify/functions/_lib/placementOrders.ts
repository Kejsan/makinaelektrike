import type {
  PlacementZone,
  PlacementZoneAvailabilitySummary,
  PromotionalCampaign,
  SponsorshipOrder,
} from '../../../types';

const INVENTORY_RESERVING_ORDER_STATUSES = new Set(['reserved', 'paid', 'active']);
const INVENTORY_OCCUPYING_CAMPAIGN_STATUSES = new Set(['scheduled', 'active', 'paused']);

export const parsePlacementDate = (value: unknown) => {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const orderReservesInventory = (order: SponsorshipOrder) =>
  INVENTORY_RESERVING_ORDER_STATUSES.has(order.status);

export const placementIntervalsOverlap = (
  startA: Date | null,
  endA: Date | null,
  startB: Date | null,
  endB: Date | null,
) => {
  const normalizedStartA = startA?.getTime() ?? Number.NEGATIVE_INFINITY;
  const normalizedEndA = endA?.getTime() ?? Number.POSITIVE_INFINITY;
  const normalizedStartB = startB?.getTime() ?? Number.NEGATIVE_INFINITY;
  const normalizedEndB = endB?.getTime() ?? Number.POSITIVE_INFINITY;

  return normalizedStartA <= normalizedEndB && normalizedStartB <= normalizedEndA;
};

const buildCampaignOrderMap = (orders: SponsorshipOrder[]) =>
  orders.reduce<Map<string, SponsorshipOrder[]>>((acc, order) => {
    if (!order.campaignId) {
      return acc;
    }

    const current = acc.get(order.campaignId) ?? [];
    current.push(order);
    acc.set(order.campaignId, current);
    return acc;
  }, new Map<string, SponsorshipOrder[]>());

const getCampaignLinkedOrders = (
  campaign: PromotionalCampaign,
  campaignOrderMap: Map<string, SponsorshipOrder[]>,
) => campaignOrderMap.get(campaign.id) ?? [];

const campaignOccupiesInventoryDirectly = ({
  campaign,
  campaignOrderMap,
}: {
  campaign: PromotionalCampaign;
  campaignOrderMap: Map<string, SponsorshipOrder[]>;
}) => {
  if (!INVENTORY_OCCUPYING_CAMPAIGN_STATUSES.has(campaign.status)) {
    return false;
  }

  if (campaign.promotionType === 'house_promotion') {
    return true;
  }

  return !getCampaignLinkedOrders(campaign, campaignOrderMap).some(orderReservesInventory);
};

const collectZoneOccupancy = ({
  zone,
  orders,
  campaigns,
  rangeStart,
  rangeEnd,
  excludeOrderId,
  excludeCampaignId,
  excludeLinkedCampaignId,
}: {
  zone: PlacementZone;
  orders: SponsorshipOrder[];
  campaigns: PromotionalCampaign[];
  rangeStart: Date | null;
  rangeEnd: Date | null;
  excludeOrderId?: string | null;
  excludeCampaignId?: string | null;
  excludeLinkedCampaignId?: string | null;
}) => {
  const campaignOrderMap = buildCampaignOrderMap(orders);
  const blockingOrders = orders.filter(order => {
    if (
      order.id === excludeOrderId ||
      order.campaignId === excludeLinkedCampaignId ||
      !orderReservesInventory(order) ||
      !order.zoneIds.includes(zone.id)
    ) {
      return false;
    }

    return placementIntervalsOverlap(
      parsePlacementDate(order.startAt),
      parsePlacementDate(order.endAt),
      rangeStart,
      rangeEnd,
    );
  });

  const blockingCampaigns = campaigns.filter(campaign => {
    if (
      campaign.id === excludeCampaignId ||
      !campaign.zoneIds.includes(zone.id) ||
      !campaignOccupiesInventoryDirectly({ campaign, campaignOrderMap })
    ) {
      return false;
    }

    return placementIntervalsOverlap(
      parsePlacementDate(campaign.startAt),
      parsePlacementDate(campaign.endAt),
      rangeStart,
      rangeEnd,
    );
  });

  return {
    blockingOrders,
    blockingCampaigns,
  };
};

export const buildPlacementZoneAvailability = ({
  zones,
  orders,
  campaigns = [],
  now = new Date(),
}: {
  zones: PlacementZone[];
  orders: SponsorshipOrder[];
  campaigns?: PromotionalCampaign[];
  now?: Date;
}): PlacementZoneAvailabilitySummary[] =>
  zones.map(zone => {
    const {
      blockingOrders: occupyingOrders,
      blockingCampaigns,
    } = collectZoneOccupancy({
      zone,
      orders,
      campaigns,
      rangeStart: now,
      rangeEnd: now,
    });

    const nextReleaseAt = [
      ...occupyingOrders.map(order => parsePlacementDate(order.endAt)),
      ...blockingCampaigns.map(campaign => parsePlacementDate(campaign.endAt)),
    ]
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => left.getTime() - right.getTime())[0];

    const reservedAssignments = occupyingOrders.length + blockingCampaigns.length;
    return {
      zoneId: zone.id,
      zoneKey: zone.key,
      zoneName: zone.name,
      maxAssignments: zone.maxAssignments,
      reservedAssignments,
      availableAssignments: Math.max(zone.maxAssignments - reservedAssignments, 0),
      blockingOrderIds: occupyingOrders.map(order => order.id),
      blockingCampaignIds: blockingCampaigns.map(campaign => campaign.id),
      nextReleaseAt: nextReleaseAt ? nextReleaseAt.toISOString() : null,
    };
  });

export const findPlacementSlotConflicts = ({
  zones,
  orders,
  campaigns,
  zoneIds,
  startAt,
  endAt,
  excludeOrderId,
  excludeCampaignId,
  excludeLinkedCampaignId,
}: {
  zones: PlacementZone[];
  orders: SponsorshipOrder[];
  campaigns: PromotionalCampaign[];
  zoneIds: string[];
  startAt: Date | null;
  endAt: Date | null;
  excludeOrderId?: string | null;
  excludeCampaignId?: string | null;
  excludeLinkedCampaignId?: string | null;
}) => {
  const requestedZoneIds = Array.from(new Set(zoneIds));

  return zones
    .filter(zone => requestedZoneIds.includes(zone.id))
    .map(zone => {
      const { blockingOrders, blockingCampaigns } = collectZoneOccupancy({
        zone,
        orders,
        campaigns,
        rangeStart: startAt,
        rangeEnd: endAt,
        excludeOrderId,
        excludeCampaignId,
        excludeLinkedCampaignId,
      });

      return {
        zone,
        blockingOrders,
        blockingCampaigns,
      };
    })
    .filter(
      entry =>
        entry.blockingOrders.length + entry.blockingCampaigns.length >=
        entry.zone.maxAssignments,
    );
};

export const findPlacementOrderConflicts = (args: {
  zones: PlacementZone[];
  orders: SponsorshipOrder[];
  campaigns: PromotionalCampaign[];
  zoneIds: string[];
  startAt: Date | null;
  endAt: Date | null;
  excludeOrderId?: string | null;
  excludeLinkedCampaignId?: string | null;
}) =>
  findPlacementSlotConflicts({
    ...args,
    excludeOrderId: args.excludeOrderId,
    excludeLinkedCampaignId: args.excludeLinkedCampaignId,
  });
