import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

const normalizePublicUrl = (value: string) => value.replace(/\/+$/, '');

const readR2Config = (): R2Config => {
  const accountId = process.env.R2_ACCOUNT_ID ?? process.env.VITE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? process.env.VITE_R2_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY ?? process.env.VITE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME ?? process.env.VITE_R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL ?? process.env.VITE_R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    throw new Error(
      'Missing R2 upload credentials. Configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL.',
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl: normalizePublicUrl(publicUrl),
  };
};

let r2Client: S3Client | null = null;

const getR2Client = () => {
  if (r2Client) {
    return r2Client;
  }

  const config = readR2Config();
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return r2Client;
};

export const uploadBufferToR2 = async (input: {
  key: string;
  contentType: string;
  body: Buffer;
  cacheControl?: string;
}) => {
  const config = readR2Config();
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl ?? 'public, max-age=31536000, immutable',
    }),
  );

  return `${config.publicUrl}/${input.key}`;
};
