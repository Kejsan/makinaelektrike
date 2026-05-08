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
import { uploadBufferToR2 } from './_lib/r2';

interface DealerMediaUploadBody {
  dealerId?: unknown;
  variant?: unknown;
  fileName?: unknown;
  contentType?: unknown;
  dataBase64?: unknown;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

const sanitizePathSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9./_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^[-/.]+|[-/.]+$/g, '');

const getRequiredString = (value: unknown, field: string, maxLength = 256) => {
  if (typeof value !== 'string') {
    throw new Error(`${field} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${field} is too long.`);
  }

  return trimmed;
};

const parseVariant = (value: unknown) => {
  const variant = getRequiredString(value, 'variant', 32);
  if (variant !== 'hero' && variant !== 'gallery') {
    throw new Error('variant must be either hero or gallery.');
  }

  return variant;
};

const parseContentType = (value: unknown) => {
  const contentType = getRequiredString(value, 'contentType', 120).toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error('Unsupported image format.');
  }

  return contentType;
};

const parseFileName = (value: unknown, contentType: string) => {
  const preferred = typeof value === 'string' && value.trim() ? value.trim() : 'dealer-image';
  const safeFileName = sanitizePathSegment(preferred);
  const baseName = safeFileName.replace(/\.[a-z0-9]+$/i, '') || 'dealer-image';

  const extension =
    contentType === 'image/png'
      ? 'png'
      : contentType === 'image/jpeg'
        ? 'jpg'
        : contentType === 'image/avif'
          ? 'avif'
          : contentType === 'image/gif'
            ? 'gif'
            : 'webp';

  return `${baseName}.${extension}`;
};

const decodeBase64Body = (value: unknown) => {
  const base64 = getRequiredString(value, 'dataBase64', 8_000_000);
  const body = Buffer.from(base64, 'base64');
  if (!body.length) {
    throw new Error('Image payload is empty.');
  }

  if (body.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Optimized image is too large. Please upload a smaller file.');
  }

  return body;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = parseJsonBody<DealerMediaUploadBody>(event);
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const variant = parseVariant(body.variant);
    const contentType = parseContentType(body.contentType);
    const fileName = parseFileName(body.fileName, contentType);
    const imageBody = decodeBase64Body(body.dataBase64);

    await requireDealerAccess(profile, dealerId);

    const key = `dealers/${sanitizePathSegment(dealerId)}/${variant}/${fileName}`;
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
      message === 'You do not have dealer access for this record.'
    ) {
      return forbidden(message);
    }
    if (message.startsWith('Missing R2 upload credentials')) {
      return serviceUnavailable('Dealer media uploads are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('too long') ||
      message.includes('Unsupported image format') ||
      message.includes('too large') ||
      message.includes('empty') ||
      message.includes('variant must') ||
      message.includes('Dealer record was not found')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
