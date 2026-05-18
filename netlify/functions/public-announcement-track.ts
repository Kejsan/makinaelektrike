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
import {
  PUBLIC_ANNOUNCEMENT_EVENT_TYPES,
} from './_lib/publicAnnouncements';
import type { PublicAnnouncementAnalyticsEventType } from '../../types';

interface AnnouncementTrackBody {
  announcementId?: unknown;
  eventType?: unknown;
  pagePath?: unknown;
  locale?: unknown;
  displayMode?: unknown;
}

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

const eventFieldByType: Record<PublicAnnouncementAnalyticsEventType, string> = {
  impression: 'impressions',
  click: 'clicks',
  dismiss: 'dismissals',
  feed_open: 'feedOpens',
  modal_view: 'modalViews',
  banner_view: 'bannerViews',
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const body = parseJsonBody<AnnouncementTrackBody>(event);
    const announcementId = cleanString(body.announcementId, 'announcementId', 160);
    const eventType = body.eventType;

    if (!(PUBLIC_ANNOUNCEMENT_EVENT_TYPES as readonly unknown[]).includes(eventType)) {
      return badRequest('eventType is invalid.');
    }

    const firestore = getAdminFirestore();
    const announcementSnapshot = await firestore.collection('publicAnnouncements').doc(announcementId).get();
    if (!announcementSnapshot.exists) {
      return json(202, { ok: true, ignored: true });
    }

    const typedEvent = eventType as PublicAnnouncementAnalyticsEventType;
    const incrementField = eventFieldByType[typedEvent];
    const dailyKey = new Date().toISOString().slice(0, 10);
    const analyticsRef = firestore.collection('publicAnnouncementAnalytics').doc(announcementId);
    const dailyRef = analyticsRef.collection('daily').doc(dailyKey);
    const pagePath = typeof body.pagePath === 'string' ? body.pagePath.slice(0, 300) : null;
    const locale = typeof body.locale === 'string' ? body.locale.slice(0, 16) : null;
    const displayMode = typeof body.displayMode === 'string' ? body.displayMode.slice(0, 32) : null;
    const lastField = typedEvent === 'click'
      ? 'lastClickAt'
      : typedEvent === 'impression'
        ? 'lastImpressionAt'
        : 'lastEventAt';

    await Promise.all([
      analyticsRef.set(
        {
          announcementId,
          [incrementField]: FieldValue.increment(1),
          [lastField]: FieldValue.serverTimestamp(),
          lastPagePath: pagePath,
          lastLocale: locale,
          lastDisplayMode: displayMode,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
      dailyRef.set(
        {
          announcementId,
          dateKey: dailyKey,
          [incrementField]: FieldValue.increment(1),
          [lastField]: FieldValue.serverTimestamp(),
          lastPagePath: pagePath,
          lastLocale: locale,
          lastDisplayMode: displayMode,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
    ]);

    return json(202, { ok: true }, { 'Cache-Control': 'no-store' });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('required') || message.includes('invalid')) {
      return badRequest(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Public announcement tracking is not configured.');
    }
    return internalError(message);
  }
};
