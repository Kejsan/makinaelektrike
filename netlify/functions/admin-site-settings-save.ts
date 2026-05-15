import { FieldValue } from 'firebase-admin/firestore';
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
import { parseSiteSettingsPayload, serializeSiteSettings } from './_lib/siteSettings';

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'blog.publish');
    const payload = parseSiteSettingsPayload(event.body ? JSON.parse(event.body) : {});
    const firestore = getAdminFirestore();
    const settingsRef = firestore.collection('siteSettings').doc('public');

    await settingsRef.set(
      {
        socialLinks: payload.socialLinks,
        homeHeroImages: payload.homeHeroImages,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: profile.uid,
      },
      { merge: true },
    );

    const snapshot = await settingsRef.get();

    return json(200, {
      ok: true,
      settings: serializeSiteSettings(snapshot.data()),
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
      return serviceUnavailable('Server-side site settings are not configured.');
    }
    if (isFirestoreQuotaError(error)) {
      return quotaExceeded('Firestore quota is exhausted, so site settings cannot be saved right now.');
    }
    if (message.includes('must use a valid') || message.includes('must be a valid')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
