import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

interface ServiceAccountShape {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const normalizePrivateKey = (value: string) => value.replace(/\\n/g, '\n');

const readServiceAccountFromEnv = (): ServiceAccountShape | null => {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
};

const readServiceAccountFromFile = (): ServiceAccountShape | null => {
  const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
  if (!existsSync(serviceAccountPath)) {
    return null;
  }

  const payload = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as Record<string, unknown>;
  const projectId = payload.projectId ?? payload.project_id;
  const clientEmail = payload.clientEmail ?? payload.client_email;
  const privateKey = payload.privateKey ?? payload.private_key;

  if (
    typeof projectId !== 'string' ||
    typeof clientEmail !== 'string' ||
    typeof privateKey !== 'string'
  ) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
};

const getAdminApp = () => {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const serviceAccount = readServiceAccountFromEnv() ?? readServiceAccountFromFile();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp();
  }

  throw new Error(
    'Missing Firebase admin credentials. Configure FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY, or provide GOOGLE_APPLICATION_CREDENTIALS/service-account.json.',
  );
};

export const getAdminFirestore = () => getFirestore(getAdminApp());
