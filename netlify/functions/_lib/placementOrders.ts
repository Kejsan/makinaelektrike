import type {
  PlacementZone,
  PlacementZoneAvailabilitySummary,
  SponsorshipOrder,
} from '../../../types';

const INVENTORY_RESERVING_ORDER_STATUSES = new Set(['reserved', 'paid', 'active']);

const parseDate = (value: unknown) => {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const orderReservesInventory = (order: SponsorshipOrder) =>
  INVENTORY_RESERVING_ORDER_STATUSES.has(order.status);

const intervalsOverlap = (
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

export const buildPlacementZoneAvailability = ({
  zones,
  orders,
  now = new Date(),
}: {
  zones: PlacementZone[];
  orders: SponsorshipOrder[];
  now?: Date;
}): PlacementZoneAvailabilitySummary[] =>
  zones.map(zone => {
    const occupyingOrders = orders.filter(order => {
      if (!orderReservesInventory(order) || !order.zoneIds.includes(zone.id)) {
        return false;
      }

      return intervalsOverlap(
        parseDate(order.startAt),
        parseDate(order.endAt),
        now,
        now,
      );
    });

    const nextReleaseAt = occupyingOrders
      .map(order => parseDate(order.endAt))
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => left.getTime() - right.getTime())[0];

    const reservedAssignments = occupyingOrders.length;
    return {
      zoneId: zone.id,
      zoneKey: zone.key,
      zoneName: zone.name,
      maxAssignments: zone.maxAssignments,
      reservedAssignments,
      availableAssignments: Math.max(zone.maxAssignments - reservedAssignments, 0),
      blockingOrderIds: occupyingOrders.map(order => order.id),
      nextReleaseAt: nextReleaseAt ? nextReleaseAt.toISOString() : null,
    };
  });

export const findPlacementOrderConflicts = ({
  zones,
  orders,
  zoneIds,
  startAt,
  endAt,
  excludeOrderId,
}: {
  zones: PlacementZone[];
  orders: SponsorshipOrder[];
  zoneIds: string[];
  startAt: Date | null;
  endAt: Date | null;
  excludeOrderId?: string | null;
}) => {
  const requestedZoneIds = Array.from(new Set(zoneIds));

  return zones
    .filter(zone => requestedZoneIds.includes(zone.id))
    .map(zone => {
      const blockingOrders = orders.filter(order => {
        if (
          order.id === excludeOrderId ||
          !orderReservesInventory(order) ||
          !order.zoneIds.includes(zone.id)
        ) {
          return false;
        }

        return intervalsOverlap(
          parseDate(order.startAt),
          parseDate(order.endAt),
          startAt,
          endAt,
        );
      });

      return {
        zone,
        blockingOrders,
      };
    })
    .filter(entry => entry.blockingOrders.length >= entry.zone.maxAssignments);
};
