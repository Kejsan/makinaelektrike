import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize R2 Client (S3 Compatible)
// NOTE: Hardcoded for immediate stability. In production, these should be environment variables.
const endpoint = 'https://d399432f7c48ddf1336a2e1cd489ba07.r2.cloudflarestorage.com';
const accessKeyId = '0b571d42ee76f464679ae36439ac8817';
const secretAccessKey = '3ff8024d12bc5f0c9b2002131e897e3ae196165f3c493a014bb1fa3a7a075cfa';
const bucketName = 'makinaelektrike';

const r2 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const BUCKET_NAME = bucketName;
const PUBLIC_URL = 'https://pub-c15556a0b3fc473f8df3c05a32a23860.r2.dev';

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
    // Convert File to Uint8Array to avoid AWS SDK stream issues in browser
    const arrayBuffer = await file.arrayBuffer();
    const fileContent = new Uint8Array(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectPath,
      Body: fileContent,
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
