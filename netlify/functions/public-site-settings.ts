import type { FunctionEvent } from './_lib/http';
import {
  internalError,
  json,
  methodNotAllowed,
  quotaExceeded,
  serviceUnavailable,
} from './_lib/http';
import { isFirestoreQuotaError } from './_lib/firebaseErrors';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { serializeSiteSettings } from './_lib/siteSettings';

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const snapshot = await getAdminFirestore()
      .collection('siteSettings')
      .doc('public')
      .get();

    return json(
      200,
      {
        ok: true,
        settings: serializeSiteSettings(snapshot.data()),
      },
      {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
      },
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Public site settings are not configured.');
    }
    if (isFirestoreQuotaError(error)) {
      return quotaExceeded('Firestore quota is exhausted, so public site settings are temporarily unavailable.');
    }

    return internalError(message);
  }
};
