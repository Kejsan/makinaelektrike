import type { DocumentData } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
} from './_lib/http';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import {
  isAnnouncementPubliclyVisible,
  serializePublicAnnouncement,
  sortPublicAnnouncements,
} from './_lib/publicAnnouncements';

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const now = Date.now();
    const locale = event.queryStringParameters?.locale ?? null;
    const pagePath = event.queryStringParameters?.pagePath ?? '/';
    const segment = event.queryStringParameters?.segment ?? 'all';
    const snapshot = await getAdminFirestore()
      .collection('publicAnnouncements')
      .where('status', 'in', ['active', 'scheduled'])
      .get();

    const announcements = sortPublicAnnouncements(
      snapshot.docs
        .map(doc => serializePublicAnnouncement(doc.id, doc.data() as DocumentData))
        .filter(announcement =>
          isAnnouncementPubliclyVisible(announcement, {
            now,
            locale,
            pagePath,
            segment,
          }),
        ),
    ).slice(0, 20);

    return json(
      200,
      {
        ok: true,
        announcements,
        resolvedAt: new Date(now).toISOString(),
      },
      {
        'Cache-Control': 'public, max-age=60, s-maxage=180, stale-while-revalidate=300',
      },
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Public announcements are not configured.');
    }

    return internalError(message);
  }
};
