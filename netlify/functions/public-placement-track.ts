import { FieldValue } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  internalError,
  json,
  methodNotAllowed,
  parseJsonBody,
  serviceUnavailable,
} from './_lib/http';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import type { PlacementAnalyticsEventType, PromotionalCampaign } from '../../types';

interface PlacementTrackBody {
  campaignId?: string;
  zoneKey?: string;
  eventType?: PlacementAnalyticsEventType;
  pagePath?: string;
  locale?: string;
}

const isEventType = (value: unknown): value is PlacementAnalyticsEventType =>
  value === 'impression' || value === 'click';

const cleanString = (value: unknown, field: string, maxLength = 256) => {
  if (typeof value !== 'string') {
    throw new Error(`${field} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new Error(`${field} is required.`);
  }

  return trimmed;
};

const isCampaignTrackable = (campaign: PromotionalCampaign, zoneKey: string) => {
  if (campaign.status !== 'active' && campaign.status !== 'scheduled') {
    return false;
  }

  return zoneKey.length > 0;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const body = parseJsonBody<PlacementTrackBody>(event);
    const campaignId = cleanString(body.campaignId, 'campaignId', 128);
    const zoneKey = cleanString(body.zoneKey, 'zoneKey', 160).toLowerCase();
    const eventType = body.eventType;

    if (!isEventType(eventType)) {
      return badRequest('eventType must be impression or click.');
    }

    const firestore = getAdminFirestore();
    const campaignSnapshot = await firestore.collection('promotionalCampaigns').doc(campaignId).get();
    if (!campaignSnapshot.exists) {
      return badRequest('Campaign not found.');
    }

    const campaign = { id: campaignSnapshot.id, ...(campaignSnapshot.data() ?? {}) } as PromotionalCampaign;
    if (!isCampaignTrackable(campaign, zoneKey)) {
      return json(202, { ok: true, ignored: true });
    }

    const zoneSnapshot = await firestore
      .collection('placementZones')
      .where('key', '==', zoneKey)
      .limit(1)
      .get();
    const zoneDoc = zoneSnapshot.docs[0] ?? null;
    if (!zoneDoc || !campaign.zoneIds.includes(zoneDoc.id)) {
      return badRequest('Campaign is not assigned to the specified placement zone.');
    }

    const analyticsRef = firestore.collection('placementCampaignAnalytics').doc(campaignId);
    const dailyKey = new Date().toISOString().slice(0, 10);
    const dailyRef = firestore
      .collection('placementCampaignAnalytics')
      .doc(campaignId)
      .collection('daily')
      .doc(dailyKey);
    const zoneRef = firestore
      .collection('placementCampaignAnalytics')
      .doc(campaignId)
      .collection('zones')
      .doc(zoneKey);

    const incrementField = eventType === 'impression' ? 'impressions' : 'clicks';
    const lastField = eventType === 'impression' ? 'lastImpressionAt' : 'lastClickAt';
    const pagePath = typeof body.pagePath === 'string' ? body.pagePath.slice(0, 300) : null;
    const locale = typeof body.locale === 'string' ? body.locale.slice(0, 16) : null;

    await Promise.all([
      analyticsRef.set(
        {
          [incrementField]: FieldValue.increment(1),
          [lastField]: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          campaignId,
        },
        { merge: true },
      ),
      dailyRef.set(
        {
          [incrementField]: FieldValue.increment(1),
          [lastField]: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          campaignId,
          dateKey: dailyKey,
        },
        { merge: true },
      ),
      zoneRef.set(
        {
          [incrementField]: FieldValue.increment(1),
          [lastField]: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          campaignId,
          zoneKey,
          lastPagePath: pagePath,
          lastLocale: locale,
        },
        { merge: true },
      ),
    ]);

    return json(
      202,
      {
        ok: true,
      },
      {
        'Cache-Control': 'no-store',
      },
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('required') || message.includes('not assigned') || message.includes('not found')) {
      return badRequest(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Public placement tracking is not configured.');
    }
    return internalError(message);
  }
};
