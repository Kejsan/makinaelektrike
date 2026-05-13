import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  type Auth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

export const TEST_PROJECT_ID = 'demo-makina-elektrike';
export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
export const FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
export const STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

export interface EmulatorClientContext {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

export interface SignedInEmulatorUser extends EmulatorClientContext {
  uid: string;
  email: string;
  idToken: string;
  password: string;
}

export const setEmulatorEnv = () => {
  process.env.GCLOUD_PROJECT = TEST_PROJECT_ID;
  process.env.FIREBASE_PROJECT_ID = TEST_PROJECT_ID;
  process.env.VITE_FIREBASE_PROJECT_ID = TEST_PROJECT_ID;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = STORAGE_EMULATOR_HOST;
  process.env.VITE_FIREBASE_API_KEY = 'demo-api-key';
  process.env.VITE_FIREBASE_AUTH_DOMAIN = 'demo.local';
};

export const createEmulatorClientContext = (name = `client-${Date.now()}-${Math.random()}`): EmulatorClientContext => {
  setEmulatorEnv();

  const app = initializeApp(
    {
      apiKey: 'demo-api-key',
      authDomain: 'demo.local',
      projectId: TEST_PROJECT_ID,
    },
    name,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });

  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);

  return { app, auth, firestore };
};

export const destroyEmulatorClientContext = async (context: EmulatorClientContext) => {
  await deleteApp(context.app);
};

export const createSignedInEmulatorUser = async (input: {
  email?: string;
  password?: string;
  name?: string;
} = {}): Promise<SignedInEmulatorUser> => {
  const context = createEmulatorClientContext(input.name);
  const email = input.email ?? `codex-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = input.password ?? 'Password123!';
  const credential = await createUserWithEmailAndPassword(context.auth, email, password);
  const idToken = await credential.user.getIdToken();

  return {
    ...context,
    uid: credential.user.uid,
    email,
    password,
    idToken,
  };
};

export const getAdminFirestoreForTests = async () => {
  setEmulatorEnv();
  const { getAdminFirestore } = await import('../../netlify/functions/_lib/firebaseAdmin');
  return getAdminFirestore();
};

export const getAdminAuthForTests = async () => {
  setEmulatorEnv();
  const { getAdminAuth } = await import('../../netlify/functions/_lib/firebaseAdmin');
  return getAdminAuth();
};

export const clearFirestoreEmulatorData = async () => {
  setEmulatorEnv();
  const response = await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`,
    {
      method: 'DELETE',
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to clear Firestore emulator: ${response.status} ${response.statusText}`);
  }
};

export const clearAuthEmulatorUsers = async () => {
  setEmulatorEnv();
  const response = await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${TEST_PROJECT_ID}/accounts`,
    {
      method: 'DELETE',
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to clear Auth emulator: ${response.status} ${response.statusText}`);
  }
};

export const buildFunctionEvent = (input: {
  method?: string;
  idToken?: string | null;
  body?: Record<string, unknown> | null;
}) => ({
  httpMethod: input.method ?? 'POST',
  headers: input.idToken
    ? {
        authorization: `Bearer ${input.idToken}`,
      }
    : {},
  body: input.body ? JSON.stringify(input.body) : null,
});
