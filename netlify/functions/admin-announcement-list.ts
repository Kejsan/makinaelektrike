import type { DocumentData } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  quotaExceeded,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { isFirestoreQuotaError } from './_lib/firebaseErrors';
import {
  serializePublicAnnouncement,
  serializePublicAnnouncementAnalytics,
  sortPublicAnnouncements,
} from './_lib/publicAnnouncements';

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    await requireAdminPermission(event, 'announcements.read');
    const firestore = getAdminFirestore();
    const [announcementSnapshot, analyticsSnapshot] = await Promise.all([
      firestore.collection('publicAnnouncements').get(),
      firestore.collection('publicAnnouncementAnalytics').get(),
    ]);

    const analytics = analyticsSnapshot.docs.map(doc =>
      serializePublicAnnouncementAnalytics(doc.id, doc.data() as DocumentData),
    );

    return json(200, {
      ok: true,
      announcements: sortPublicAnnouncements(
        announcementSnapshot.docs.map(doc => serializePublicAnnouncement(doc.id, doc.data() as DocumentData)),
      ),
      analytics,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Missing required permission') || message.startsWith('Authenticated admin profile')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side announcement management is not configured.');
    }
    if (isFirestoreQuotaError(error)) {
      return quotaExceeded('Firestore quota is exhausted, so announcement data is temporarily unavailable.');
    }

    return internalError(message);
  }
};
