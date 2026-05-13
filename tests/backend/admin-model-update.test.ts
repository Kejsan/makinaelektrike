import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handler } from '../../netlify/functions/admin-model-update';
import type { EmulatorClientContext, SignedInEmulatorUser } from '../helpers/emulator';
import {
  buildFunctionEvent,
  clearAuthEmulatorUsers,
  clearFirestoreEmulatorData,
  createSignedInEmulatorUser,
  destroyEmulatorClientContext,
  getAdminFirestoreForTests,
  setEmulatorEnv,
} from '../helpers/emulator';

const contexts: EmulatorClientContext[] = [];

const rememberContext = <T extends EmulatorClientContext>(context: T) => {
  contexts.push(context);
  return context;
};

const createUser = (input?: Parameters<typeof createSignedInEmulatorUser>[0]) =>
  createSignedInEmulatorUser(input).then(rememberContext);

const parseResponseBody = <T,>(body: string) => JSON.parse(body) as T;

describe('admin-model-update', () => {
  beforeAll(() => {
    setEmulatorEnv();
  });

  beforeEach(async () => {
    await clearAuthEmulatorUsers();
    await clearFirestoreEmulatorData();
  });

  afterEach(async () => {
    await Promise.all(contexts.splice(0).map(context => destroyEmulatorClientContext(context)));
  });

  const seedUserProfile = async (
    user: SignedInEmulatorUser,
    data: Record<string, unknown>,
  ) => {
    const firestore = await getAdminFirestoreForTests();
    await firestore.collection('users').doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      ...data,
    });
  };

  it('allows a catalog admin to approve a pending review model', async () => {
    const actor = await createUser({ name: 'catalog-admin' });

    await seedUserProfile(actor, {
      role: 'admin',
      accountType: 'admin',
      accountStatus: 'active',
      status: 'active',
      adminRoleIds: ['catalog_admin'],
      directPermissions: {},
    });

    const firestore = await getAdminFirestoreForTests();
    await firestore.collection('models').doc('pending-model').set({
      brand: 'BYD',
      model_name: 'Sealion 7',
      ownerUid: actor.uid,
      ownerDealerId: 'dealer-1',
      reviewStatus: 'pending_review',
      submissionSource: 'dealer',
      isActive: false,
      createdAt: new Date('2026-05-12T00:00:00.000Z'),
      reviewRequestedAt: new Date('2026-05-12T00:00:00.000Z'),
    });

    const response = await handler(
      buildFunctionEvent({
        idToken: actor.idToken,
        body: {
          modelId: 'pending-model',
          reviewStatus: 'approved',
          reviewNotes: 'Approved after canonical review.',
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(
      parseResponseBody<{
        reviewStatus: string;
        isActive: boolean;
      }>(response.body),
    ).toMatchObject({
      reviewStatus: 'approved',
      isActive: true,
    });

    const snapshot = await firestore.collection('models').doc('pending-model').get();
    expect(snapshot.data()).toMatchObject({
      reviewStatus: 'approved',
      reviewNotes: 'Approved after canonical review.',
      isActive: true,
      reviewedBy: actor.uid,
    });
  });
});
