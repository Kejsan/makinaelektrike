import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize R2 Client (S3 Compatible)
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${import.meta.env.VITE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
const PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;

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

export const uploadFile = async (objectPath: string, file: File): Promise<string> => {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectPath,
      Body: file,
      ContentType: file.type,
      // ACL: 'public-read', // R2 doesn't support ACLs the same way, public access is bucket-level
    });

    await r2.send(command);

    // Construct public URL
    return `${PUBLIC_URL}/${objectPath}`;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw error;
  }
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
