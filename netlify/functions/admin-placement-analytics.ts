import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  quotaExceeded,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { requireAdminPermission } from './_lib/adminAccess';
import { isFirestoreQuotaError } from './_lib/firebaseErrors';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import {
  serializePlacementAnalyticsDailyBucket,
  serializePlacementAnalyticsZoneSummary,
  serializePlacementCampaignAnalytics,
} from './_lib/placementAnalytics';
import { serializeTimestamp } from './_lib/placements';

const DEFAULT_RANGE_DAYS = 14;
const ALLOWED_RANGE_DAYS = new Set([7, 14, 30, 90]);

const pickLatestTimestamp = (
  current: string | null | undefined,
  candidate: string | null | undefined,
) => {
  if (!candidate) {
    return current ?? null;
  }
  if (!current || candidate > current) {
    return candidate;
  }
  return current;
};

const parseRangeDays = (raw: string | undefined) => {
  if (!raw) {
    return DEFAULT_RANGE_DAYS;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || !ALLOWED_RANGE_DAYS.has(parsed)) {
    throw new Error('days must be one of 7, 14, 30, or 90.');
  }

  return parsed;
};

const normalizeZoneKey = (raw: string | undefined) => {
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
};

const buildDateKeys = (days: number) => {
  const baseDate = new Date();
  const utcToday = new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
  ));
  const keys: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(utcToday);
    date.setUTCDate(utcToday.getUTCDate() - offset);
    keys.push(date.toISOString().slice(0, 10));
  }

  return keys;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    await requireAdminPermission(event, 'placements.analytics_read');
    const rangeDays = parseRangeDays(event.queryStringParameters?.days);
    const selectedZoneKey = normalizeZoneKey(event.queryStringParameters?.zoneKey);
    const dateKeys = buildDateKeys(rangeDays);
    const dateKeySet = new Set(dateKeys);
    const firstDateKey = dateKeys[0]!;
    const lastDateKey = dateKeys[dateKeys.length - 1]!;
    const firestore = getAdminFirestore();
    const [dailySnapshot, zoneSnapshot, dailyZoneSnapshot] = await Promise.all([
      firestore
        .collectionGroup('daily')
        .where('dateKey', '>=', firstDateKey)
        .where('dateKey', '<=', lastDateKey)
        .get(),
      firestore.collectionGroup('zones').get(),
      selectedZoneKey
        ? firestore
            .collectionGroup('dailyZones')
            .where('dateKey', '>=', firstDateKey)
            .where('dateKey', '<=', lastDateKey)
            .get()
        : Promise.resolve(null),
    ]);
    const campaignMap = new Map<
      string,
      {
        impressions: number;
        clicks: number;
        lastImpressionAt?: string | null;
        lastClickAt?: string | null;
        updatedAt?: string | null;
      }
    >();
    const dailyMap = new Map<string, { impressions: number; clicks: number }>();
    const zoneMap = new Map<
      string,
      {
        impressions: number;
        clicks: number;
        lastImpressionAt?: string | null;
        lastClickAt?: string | null;
        updatedAt?: string | null;
      }
    >();

    dateKeys.forEach(dateKey => {
      dailyMap.set(dateKey, { impressions: 0, clicks: 0 });
    });

    const accumulateCampaign = (
      campaignId: string,
      data: {
        impressions?: number;
        clicks?: number;
        lastImpressionAt?: string | null;
        lastClickAt?: string | null;
        updatedAt?: string | null;
      },
    ) => {
      const current = campaignMap.get(campaignId) ?? {
        impressions: 0,
        clicks: 0,
        lastImpressionAt: null,
        lastClickAt: null,
        updatedAt: null,
      };

      current.impressions += typeof data.impressions === 'number' ? data.impressions : 0;
      current.clicks += typeof data.clicks === 'number' ? data.clicks : 0;
      current.lastImpressionAt = pickLatestTimestamp(current.lastImpressionAt, data.lastImpressionAt);
      current.lastClickAt = pickLatestTimestamp(current.lastClickAt, data.lastClickAt);
      current.updatedAt = pickLatestTimestamp(current.updatedAt, data.updatedAt);
      campaignMap.set(campaignId, current);
    };

    dailySnapshot.docs.forEach(doc => {
      if (doc.ref.parent.parent?.parent?.id !== 'placementCampaignAnalytics') {
        return;
      }

      const data = doc.data();
      const dateKey = typeof data.dateKey === 'string' ? data.dateKey : doc.id;
      if (!dateKeySet.has(dateKey)) {
        return;
      }

      const campaignId = doc.ref.parent.parent?.id;
      if (!campaignId) {
        return;
      }

      const entry = serializePlacementAnalyticsDailyBucket(dateKey, data);
      const current = dailyMap.get(entry.dateKey) ?? { impressions: 0, clicks: 0 };
      current.impressions += entry.impressions;
      current.clicks += entry.clicks;
      dailyMap.set(entry.dateKey, current);
      if (!selectedZoneKey) {
        accumulateCampaign(campaignId, {
          impressions: entry.impressions,
          clicks: entry.clicks,
          lastImpressionAt: serializeTimestamp(data.lastImpressionAt),
          lastClickAt: serializeTimestamp(data.lastClickAt),
          updatedAt: serializeTimestamp(data.updatedAt),
        });
      }
    });

    zoneSnapshot.docs.forEach(doc => {
      if (doc.ref.parent.parent?.parent?.id !== 'placementCampaignAnalytics') {
        return;
      }

      const entry = serializePlacementAnalyticsZoneSummary(doc.id, doc.data());
      const current = zoneMap.get(entry.zoneKey) ?? {
        impressions: 0,
        clicks: 0,
        lastImpressionAt: null,
        lastClickAt: null,
        updatedAt: null,
      };

      current.impressions += entry.impressions;
      current.clicks += entry.clicks;
      current.lastImpressionAt = pickLatestTimestamp(current.lastImpressionAt, entry.lastImpressionAt);
      current.lastClickAt = pickLatestTimestamp(current.lastClickAt, entry.lastClickAt);
      current.updatedAt = pickLatestTimestamp(current.updatedAt, entry.updatedAt);
      zoneMap.set(entry.zoneKey, current);
    });

    if (selectedZoneKey && dailyZoneSnapshot) {
      dailyMap.clear();
      dateKeys.forEach(dateKey => {
        dailyMap.set(dateKey, { impressions: 0, clicks: 0 });
      });

      dailyZoneSnapshot.docs.forEach(doc => {
        if (doc.ref.parent.parent?.parent?.id !== 'placementCampaignAnalytics') {
          return;
        }

        const data = doc.data();
        const zoneKey = typeof data.zoneKey === 'string' ? data.zoneKey : null;
        const dateKey = typeof data.dateKey === 'string' ? data.dateKey : null;
        const campaignId = doc.ref.parent.parent?.id;
        if (!campaignId || zoneKey !== selectedZoneKey || !dateKey || !dateKeySet.has(dateKey)) {
          return;
        }

        const entry = serializePlacementAnalyticsDailyBucket(dateKey, data);
        const current = dailyMap.get(entry.dateKey) ?? { impressions: 0, clicks: 0 };
        current.impressions += entry.impressions;
        current.clicks += entry.clicks;
        dailyMap.set(entry.dateKey, current);

        accumulateCampaign(campaignId, {
          impressions: entry.impressions,
          clicks: entry.clicks,
          lastImpressionAt: serializeTimestamp(data.lastImpressionAt),
          lastClickAt: serializeTimestamp(data.lastClickAt),
          updatedAt: serializeTimestamp(data.updatedAt),
        });
      });
    }

    const analytics = Array.from(campaignMap.entries())
      .map(([campaignId, data]) => serializePlacementCampaignAnalytics(campaignId, data))
      .sort((left, right) => right.impressions - left.impressions);
    const daily = dateKeys.map(dateKey =>
      serializePlacementAnalyticsDailyBucket(dateKey, dailyMap.get(dateKey) ?? { impressions: 0, clicks: 0 }),
    );
    const zones = Array.from(zoneMap.entries())
      .map(([zoneKey, data]) => serializePlacementAnalyticsZoneSummary(zoneKey, data))
      .sort((left, right) => right.impressions - left.impressions);

    return json(200, {
      ok: true,
      analytics,
      daily,
      filters: {
        days: rangeDays,
        zoneKey: selectedZoneKey,
      },
      zones,
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('days must be')) {
      return badRequest(message);
    }
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
      return serviceUnavailable('Server-side placement analytics are not configured.');
    }
    if (isFirestoreQuotaError(error)) {
      return quotaExceeded('Firestore quota is exhausted, so placement analytics are temporarily unavailable.');
    }

    return internalError(message);
  }
};
