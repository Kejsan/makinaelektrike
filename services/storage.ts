import { auth, storage } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import { optimizeImageForUpload, encodeFileAsBase64 } from '../utils/imageUpload';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

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

interface DealerMediaUploadResponse {
  ok: true;
  url: string;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to upload dealer media.');
  }

  return currentUser.getIdToken();
};

const uploadDealerMediaViaFunction = async (
  dealerId: string,
  file: File,
  variant: 'hero' | 'gallery',
): Promise<string> => {
  const optimizedFile = await optimizeImageForUpload(file, {
    maxDimension: variant === 'hero' ? 1600 : 1400,
    targetMaxBytes: variant === 'hero' ? 900 * 1024 : 750 * 1024,
  });
  const idToken = await getRequiredIdToken();
  const dataBase64 = await encodeFileAsBase64(optimizedFile);
  const folder = variant === 'hero' ? 'hero' : 'gallery';

  const response = await fetchFunctionJson<
    DealerMediaUploadResponse,
    {
      dealerId: string;
      variant: 'hero' | 'gallery';
      fileName: string;
      contentType: string;
      dataBase64: string;
    }
  >('dealer-media-upload', {
    method: 'POST',
    body: {
      dealerId,
      variant,
      fileName: buildFileName(optimizedFile, `dealer-${folder}`),
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
): Promise<string> => {
  return uploadDealerMediaViaFunction(dealerId, file, variant);
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
