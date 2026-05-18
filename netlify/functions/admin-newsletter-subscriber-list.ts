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
import { serializeNewsletterSubscriber } from './_lib/newsletterSubscribers';

const parseLimit = (value: string | undefined) => {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    return 200;
  }
  return Math.min(Math.round(limit), 500);
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    await requireAdminPermission(event, 'announcements.read');
    const firestore = getAdminFirestore();
    const limit = parseLimit(event.queryStringParameters?.limit);
    const snapshot = await firestore
      .collection('newsletterSubscribers')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return json(200, {
      ok: true,
      subscribers: snapshot.docs.map(doc =>
        serializeNewsletterSubscriber(doc.id, doc.data() as DocumentData),
      ),
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
      return serviceUnavailable('Server-side newsletter subscriber management is not configured.');
    }
    if (isFirestoreQuotaError(error)) {
      return quotaExceeded('Firestore quota is exhausted, so newsletter subscribers are temporarily unavailable.');
    }

    return internalError(message);
  }
};
