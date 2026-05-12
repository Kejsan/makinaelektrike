import type { DocumentData } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  parseJsonBody,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { requireDealerAccess } from './_lib/dealerAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import {
  decodeBase64Image,
  getRequiredUploadString,
  parseImageContentType,
  parseMediaFileName,
  parseMediaVariant,
  sanitizePathSegment,
} from './_lib/mediaUpload';
import { uploadBufferToR2 } from './_lib/r2';
import { hasPermission } from '../../utils/accessControl';

interface ListingMediaUploadBody {
  dealerId?: unknown;
  listingId?: unknown;
  variant?: unknown;
  fileName?: unknown;
  contentType?: unknown;
  dataBase64?: unknown;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ensureListingUploadAccess = async (
  profile: Awaited<ReturnType<typeof requireAuthenticatedProfile>>['profile'],
  dealerId: string,
  listingId: string,
) => {
  if (hasPermission(profile, 'listings.moderate') || hasPermission(profile, 'listings.reassign')) {
    return;
  }

  await requireDealerAccess(profile, dealerId);

  if (listingId.startsWith('temp_')) {
    return;
  }

  const snapshot = await getAdminFirestore().collection('listings').doc(listingId).get();
  if (!snapshot.exists) {
    return;
  }

  const listingData = (snapshot.data() ?? {}) as DocumentData;
  if (typeof listingData.dealerId === 'string' && listingData.dealerId !== dealerId) {
    throw new Error('The selected listing does not belong to this dealer account.');
  }
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = parseJsonBody<ListingMediaUploadBody>(event);
    const dealerId = getRequiredUploadString(body.dealerId, 'dealerId', 128);
    const listingId = getRequiredUploadString(body.listingId, 'listingId', 128);
    const variant = parseMediaVariant(body.variant);
    const contentType = parseImageContentType(body.contentType);
    const fileName = parseMediaFileName(body.fileName, contentType, 'listing-image');
    const imageBody = decodeBase64Image(body.dataBase64, MAX_IMAGE_BYTES);

    await ensureListingUploadAccess(profile, dealerId, listingId);

    const key = `listings/${sanitizePathSegment(dealerId)}/${sanitizePathSegment(listingId)}/${variant}/${fileName}`;
    const url = await uploadBufferToR2({
      key,
      contentType,
      body: imageBody,
    });

    return json(200, {
      ok: true,
      url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error.';

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (
      message === 'Authenticated admin profile was not found.' ||
      message === 'You do not have dealer access for this record.' ||
      message === 'The selected listing does not belong to this dealer account.'
    ) {
      return forbidden(message);
    }
    if (message.startsWith('Missing R2 upload credentials')) {
      return serviceUnavailable('Listing media uploads are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('too long') ||
      message.includes('Unsupported image format') ||
      message.includes('too large') ||
      message.includes('empty') ||
      message.includes('variant must')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
