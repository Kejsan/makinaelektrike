import type { DocumentData } from 'firebase-admin/firestore';
import type {
  PlacementAnalyticsDailyBucket,
  PlacementAnalyticsZoneSummary,
  PlacementCampaignAnalyticsSummary,
} from '../../../types';
import { serializeTimestamp } from './placements';

export const buildPlacementAnalyticsDocId = (campaignId: string) => campaignId;

export const serializePlacementCampaignAnalytics = (
  campaignId: string,
  data: DocumentData,
): PlacementCampaignAnalyticsSummary => {
  const impressions = typeof data.impressions === 'number' ? data.impressions : 0;
  const clicks = typeof data.clicks === 'number' ? data.clicks : 0;

  return {
    campaignId,
    impressions,
    clicks,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    lastImpressionAt: serializeTimestamp(data.lastImpressionAt),
    lastClickAt: serializeTimestamp(data.lastClickAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
};

export const serializePlacementAnalyticsZoneSummary = (
  zoneKey: string,
  data: DocumentData,
): PlacementAnalyticsZoneSummary => {
  const impressions = typeof data.impressions === 'number' ? data.impressions : 0;
  const clicks = typeof data.clicks === 'number' ? data.clicks : 0;

  return {
    zoneKey,
    impressions,
    clicks,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    lastImpressionAt: serializeTimestamp(data.lastImpressionAt),
    lastClickAt: serializeTimestamp(data.lastClickAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
};

export const serializePlacementAnalyticsDailyBucket = (
  dateKey: string,
  data: DocumentData,
): PlacementAnalyticsDailyBucket => {
  const impressions = typeof data.impressions === 'number' ? data.impressions : 0;
  const clicks = typeof data.clicks === 'number' ? data.clicks : 0;

  return {
    dateKey,
    impressions,
    clicks,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
  };
};
