const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

export const sanitizePathSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9./_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^[-/.]+|[-/.]+$/g, '');

export const getRequiredUploadString = (value: unknown, field: string, maxLength = 256) => {
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

export const parseMediaVariant = (value: unknown) => {
  const variant = getRequiredUploadString(value, 'variant', 32);
  if (variant !== 'hero' && variant !== 'gallery') {
    throw new Error('variant must be either hero or gallery.');
  }

  return variant;
};

export const parseImageContentType = (value: unknown) => {
  const contentType = getRequiredUploadString(value, 'contentType', 120).toLowerCase();
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new Error('Unsupported image format.');
  }

  return contentType;
};

const getContentTypeExtension = (contentType: string) =>
  contentType === 'image/png'
    ? 'png'
    : contentType === 'image/jpeg'
      ? 'jpg'
      : contentType === 'image/avif'
        ? 'avif'
        : contentType === 'image/gif'
          ? 'gif'
          : 'webp';

export const parseMediaFileName = (value: unknown, contentType: string, fallback = 'image-upload') => {
  const preferred = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  const safeFileName = sanitizePathSegment(preferred);
  const baseName = safeFileName.replace(/\.[a-z0-9]+$/i, '') || fallback;
  return `${baseName}.${getContentTypeExtension(contentType)}`;
};

export const decodeBase64Image = (value: unknown, maxBytes: number) => {
  const base64 = getRequiredUploadString(value, 'dataBase64', 8_000_000);
  const body = Buffer.from(base64, 'base64');
  if (!body.length) {
    throw new Error('Image payload is empty.');
  }

  if (body.byteLength > maxBytes) {
    throw new Error('Optimized image is too large. Please upload a smaller file.');
  }

  return body;
};
