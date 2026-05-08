import type { FunctionEvent } from './_lib/http';
import {
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import {
  serializePlacementAnalyticsDailyBucket,
  serializePlacementAnalyticsZoneSummary,
  serializePlacementCampaignAnalytics,
} from './_lib/placementAnalytics';

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

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    await requireAdminPermission(event, 'placements.analytics_read');
    const firestore = getAdminFirestore();
    const [campaignSnapshot, dailySnapshot, zoneSnapshot] = await Promise.all([
      firestore.collection('placementCampaignAnalytics').get(),
      firestore.collectionGroup('daily').get(),
      firestore.collectionGroup('zones').get(),
    ]);

    const analytics = campaignSnapshot.docs
      .map(doc => serializePlacementCampaignAnalytics(doc.id, doc.data()))
      .sort((left, right) => right.impressions - left.impressions);
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

    dailySnapshot.docs.forEach(doc => {
      if (doc.ref.parent.parent?.parent?.id !== 'placementCampaignAnalytics') {
        return;
      }

      const entry = serializePlacementAnalyticsDailyBucket(doc.id, doc.data());
      const current = dailyMap.get(entry.dateKey) ?? { impressions: 0, clicks: 0 };
      current.impressions += entry.impressions;
      current.clicks += entry.clicks;
      dailyMap.set(entry.dateKey, current);
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

    const daily = Array.from(dailyMap.entries())
      .map(([dateKey, data]) => serializePlacementAnalyticsDailyBucket(dateKey, data))
      .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
      .slice(-14);
    const zones = Array.from(zoneMap.entries())
      .map(([zoneKey, data]) => serializePlacementAnalyticsZoneSummary(zoneKey, data))
      .sort((left, right) => right.impressions - left.impressions);

    return json(200, {
      ok: true,
      analytics,
      daily,
      zones,
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
      return serviceUnavailable('Server-side placement analytics are not configured.');
    }

    return internalError(message);
  }
};
