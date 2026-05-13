import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handler } from '../../netlify/functions/admin-dealer-plan-update';
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

describe('admin-dealer-plan-update', () => {
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

  const seedDealer = async (dealerId: string, data: Record<string, unknown>) => {
    const firestore = await getAdminFirestoreForTests();
    await firestore.collection('dealers').doc(dealerId).set(data);
  };

  it('allows a dealer operations admin to update dealer plan fields and propagates them to the linked user', async () => {
    const actor = await createUser({ name: 'dealer-plan-admin' });
    const dealerOwner = await createUser({ name: 'dealer-plan-owner' });

    await seedUserProfile(actor, {
      role: 'admin',
      accountType: 'admin',
      accountStatus: 'active',
      status: 'active',
      adminRoleIds: ['dealer_ops_admin'],
      directPermissions: {},
    });
    await seedUserProfile(dealerOwner, {
      role: 'dealer',
      accountType: 'dealer',
      accountStatus: 'active',
      status: 'active',
      dealerPlanId: 'free',
      dealerSubscriptionStatus: 'active',
    });
    await seedDealer(dealerOwner.uid, {
      ownerUid: dealerOwner.uid,
      planId: 'free',
      subscriptionStatus: 'active',
      approved: true,
      status: 'approved',
      isActive: true,
      isDeleted: false,
      address: 'Dealer street',
      city: 'Tirane',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Dealer Plan Owner',
    });

    const response = await handler(
      buildFunctionEvent({
        idToken: actor.idToken,
        body: {
          dealerId: dealerOwner.uid,
          planId: 'paid',
          subscriptionStatus: 'paused',
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(
      parseResponseBody<{ planId: string; subscriptionStatus: string }>(response.body),
    ).toMatchObject({
      planId: 'paid',
      subscriptionStatus: 'paused',
    });

    const firestore = await getAdminFirestoreForTests();
    const [dealerSnapshot, userSnapshot, auditSnapshot] = await Promise.all([
      firestore.collection('dealers').doc(dealerOwner.uid).get(),
      firestore.collection('users').doc(dealerOwner.uid).get(),
      firestore
        .collection('adminAuditLogs')
        .where('action', '==', 'dealer_plan.updated')
        .where('entityId', '==', dealerOwner.uid)
        .get(),
    ]);

    expect(dealerSnapshot.data()).toMatchObject({
      planId: 'paid',
      subscriptionStatus: 'paused',
      updatedBy: actor.uid,
    });
    expect(userSnapshot.data()).toMatchObject({
      dealerPlanId: 'paid',
      dealerSubscriptionStatus: 'paused',
    });
    expect(auditSnapshot.size).toBe(1);
    expect(auditSnapshot.docs[0]?.data()).toMatchObject({
      action: 'dealer_plan.updated',
      entityType: 'dealer',
      entityId: dealerOwner.uid,
      actorUid: actor.uid,
    });
  });

  it('rejects a regular user without dealer plan permissions', async () => {
    const actor = await createUser({ name: 'regular-user' });
    const dealerOwner = await createUser({ name: 'dealer-owner' });

    await seedUserProfile(actor, {
      role: 'user',
      accountType: 'user',
      accountStatus: 'active',
      status: 'active',
    });
    await seedUserProfile(dealerOwner, {
      role: 'dealer',
      accountType: 'dealer',
      accountStatus: 'active',
      status: 'active',
      dealerPlanId: 'free',
      dealerSubscriptionStatus: 'active',
    });
    await seedDealer(dealerOwner.uid, {
      ownerUid: dealerOwner.uid,
      planId: 'free',
      subscriptionStatus: 'active',
      approved: true,
      status: 'approved',
      isActive: true,
      isDeleted: false,
      address: 'Dealer street',
      city: 'Durres',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Dealer Owner',
    });

    const response = await handler(
      buildFunctionEvent({
        idToken: actor.idToken,
        body: {
          dealerId: dealerOwner.uid,
          planId: 'paid',
        },
      }),
    );

    expect(response.statusCode).toBe(403);
    expect(parseResponseBody<{ error: string }>(response.body).error).toContain(
      'dealer_plans.assign',
    );
  });
});
