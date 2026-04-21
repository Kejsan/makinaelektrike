import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

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

export const uploadFile = async (objectPath: string, file: File): Promise<string> => {
  assertSafeImageUpload(file);

  const storageRef = ref(storage, objectPath);
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: 'public,max-age=31536000,immutable',
  });
  return getDownloadURL(storageRef);
};

const buildObjectPath = (segments: string[]) => segments.filter(Boolean).join('/');

// --- helper functions ---

const uploadDealerMedia = async (
  dealerId: string,
  file: File,
  variant: 'hero' | 'gallery',
): Promise<string> => {
  const folder = variant === 'hero' ? 'hero' : 'gallery';
  const fileName = buildFileName(file, `dealer-${folder}`);
  const objectPath = buildObjectPath(['dealers', dealerId, folder, fileName]);
  return uploadFile(objectPath, file);
};

const uploadModelMedia = async (
  modelId: string,
  file: File,
  variant: 'hero' | 'gallery',
): Promise<string> => {
  const folder = variant === 'hero' ? 'hero' : 'gallery';
  const fileName = buildFileName(file, `model-${folder}`);
  const objectPath = buildObjectPath(['models', modelId, folder, fileName]);
  return uploadFile(objectPath, file);
};

export const uploadDealerHeroImage = (dealerId: string, file: File) =>
  uploadDealerMedia(dealerId, file, 'hero');

export const uploadDealerGalleryImage = (dealerId: string, file: File) =>
  uploadDealerMedia(dealerId, file, 'gallery');

export const uploadModelHeroImage = (modelId: string, file: File) =>
  uploadModelMedia(modelId, file, 'hero');

export const uploadModelGalleryImage = (modelId: string, file: File) =>
  uploadModelMedia(modelId, file, 'gallery');
