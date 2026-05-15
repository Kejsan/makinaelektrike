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
import { requireAdminPermission } from './_lib/adminAccess';
import {
  decodeBase64Image,
  getRequiredUploadString,
  parseImageContentType,
  parseMediaFileName,
  parseMediaVariant,
  sanitizePathSegment,
} from './_lib/mediaUpload';
import { uploadBufferToR2 } from './_lib/r2';

interface SiteMediaUploadBody {
  slot?: unknown;
  variant?: unknown;
  fileName?: unknown;
  contentType?: unknown;
  dataBase64?: unknown;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const parseHeroSlot = (value: unknown) => {
  const slot = getRequiredUploadString(value, 'slot', 32);
  if (slot !== 'desktop' && slot !== 'mobile') {
    throw new Error('slot must be either desktop or mobile.');
  }

  return slot;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    await requireAdminPermission(event, 'blog.publish');
    const body = parseJsonBody<SiteMediaUploadBody>(event);
    const slot = parseHeroSlot(body.slot);
    const variant = parseMediaVariant(body.variant);
    const contentType = parseImageContentType(body.contentType);
    const fileName = parseMediaFileName(body.fileName, contentType, `homepage-hero-${slot}`);
    const imageBody = decodeBase64Image(body.dataBase64, MAX_IMAGE_BYTES);

    const key = `site/home/${variant}/${sanitizePathSegment(slot)}/${fileName}`;
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
      message.startsWith('Missing required permission') ||
      message.startsWith('Authenticated admin profile was not found')
    ) {
      return forbidden(message);
    }
    if (message.startsWith('Missing R2 upload credentials')) {
      return serviceUnavailable('Site media uploads are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('too long') ||
      message.includes('Unsupported image format') ||
      message.includes('too large') ||
      message.includes('empty') ||
      message.includes('variant must') ||
      message.includes('slot must')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
