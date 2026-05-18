import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import { encodeFileAsBase64, optimizeImageForUpload } from '../utils/imageUpload';

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

interface MediaUploadResponse {
  ok: true;
  url: string;
}

const sanitizeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const buildFileName = (file: File, fallbackBase: string) => {
  const parts = file.name.split('.');
  const hasExtension = parts.length > 1;
  const extension = hasExtension ? parts.pop()!.toLowerCase() : '';
  const baseName = sanitizeFileName(parts.join('.')) || fallbackBase;
  const timestamp = Date.now();
  return hasExtension ? `${timestamp}-${baseName}.${extension}` : `${timestamp}-${baseName}`;
};

const assertSafeImageUpload = (file: File) => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Unsupported image format. Please upload a JPEG, PNG, WebP, AVIF, or GIF file.');
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error('Image is too large. Please upload a file smaller than 10 MB.');
  }
};

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to upload media.');
  }

  return currentUser.getIdToken();
};

const uploadMediaViaFunction = async <TBody extends Record<string, string>>(input: {
  functionName: string;
  file: File;
  variant: 'hero' | 'gallery';
  fallbackBase: string;
  maxDimension: number;
  targetMaxBytes: number;
  body: TBody;
}) => {
  assertSafeImageUpload(input.file);

  const optimizedFile = await optimizeImageForUpload(input.file, {
    maxDimension: input.maxDimension,
    targetMaxBytes: input.targetMaxBytes,
  });
  const idToken = await getRequiredIdToken();
  const dataBase64 = await encodeFileAsBase64(optimizedFile);
  const response = await fetchFunctionJson<
    MediaUploadResponse,
    TBody & {
      variant: 'hero' | 'gallery';
      fileName: string;
      contentType: string;
      dataBase64: string;
    }
  >(input.functionName, {
    method: 'POST',
    body: {
      ...input.body,
      variant: input.variant,
      fileName: buildFileName(optimizedFile, input.fallbackBase),
      contentType: optimizedFile.type,
      dataBase64,
    },
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  return response.url;
};

const uploadDealerMedia = async (
  dealerId: string,
  file: File,
  variant: 'hero' | 'gallery',
): Promise<string> =>
  uploadMediaViaFunction({
    functionName: 'dealer-media-upload',
    file,
    variant,
    fallbackBase: `dealer-${variant}`,
    maxDimension: variant === 'hero' ? 1600 : 1400,
    targetMaxBytes: variant === 'hero' ? 900 * 1024 : 750 * 1024,
    body: {
      dealerId,
    },
  });

const uploadModelMedia = async (
  modelId: string,
  file: File,
  variant: 'hero' | 'gallery',
): Promise<string> =>
  uploadMediaViaFunction({
    functionName: 'model-media-upload',
    file,
    variant,
    fallbackBase: `model-${variant}`,
    maxDimension: variant === 'hero' ? 1600 : 1400,
    targetMaxBytes: variant === 'hero' ? 900 * 1024 : 750 * 1024,
    body: {
      modelId,
    },
  });

const uploadListingMedia = async (
  dealerId: string,
  listingId: string,
  file: File,
  variant: 'hero' | 'gallery',
): Promise<string> =>
  uploadMediaViaFunction({
    functionName: 'listing-media-upload',
    file,
    variant,
    fallbackBase: `listing-${variant}`,
    maxDimension: variant === 'hero' ? 1800 : 1600,
    targetMaxBytes: variant === 'hero' ? 1_000 * 1024 : 850 * 1024,
    body: {
      dealerId,
      listingId,
    },
  });

const uploadSiteHeroMedia = async (
  slot: 'desktop' | 'mobile' | 'announcement',
  file: File,
): Promise<string> =>
  uploadMediaViaFunction({
    functionName: 'admin-site-media-upload',
    file,
    variant: 'hero',
    fallbackBase: `homepage-hero-${slot}`,
    maxDimension: slot === 'desktop' ? 2200 : 1200,
    targetMaxBytes: slot === 'desktop' ? 1_200 * 1024 : 750 * 1024,
    body: {
      slot,
    },
  });

export const uploadDealerHeroImage = (dealerId: string, file: File) =>
  uploadDealerMedia(dealerId, file, 'hero');

export const uploadDealerGalleryImage = (dealerId: string, file: File) =>
  uploadDealerMedia(dealerId, file, 'gallery');

export const uploadModelHeroImage = (modelId: string, file: File) =>
  uploadModelMedia(modelId, file, 'hero');

export const uploadModelGalleryImage = (modelId: string, file: File) =>
  uploadModelMedia(modelId, file, 'gallery');

export const uploadListingHeroImage = (dealerId: string, listingId: string, file: File) =>
  uploadListingMedia(dealerId, listingId, file, 'hero');

export const uploadListingGalleryImage = (dealerId: string, listingId: string, file: File) =>
  uploadListingMedia(dealerId, listingId, file, 'gallery');

export const uploadSiteHeroBackgroundImage = (
  slot: 'desktop' | 'mobile',
  file: File,
) => uploadSiteHeroMedia(slot, file);

export const uploadAnnouncementImage = (file: File) =>
  uploadSiteHeroMedia('announcement', file);
