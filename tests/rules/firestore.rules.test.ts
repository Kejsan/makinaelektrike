import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { TEST_PROJECT_ID } from '../helpers/emulator';

const firestoreRules = readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');

describe('firestore.rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: TEST_PROJECT_ID,
      firestore: {
        rules: firestoreRules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  const seedUser = async (uid: string, data: Record<string, unknown>) => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users', uid), data);
    });
  };

  const seedDealer = async (dealerId: string, data: Record<string, unknown>) => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'dealers', dealerId), data);
    });
  };

  it('allows a regular user to create their own basic user profile', async () => {
    const userDb = testEnv.authenticatedContext('user-basic', {
      email: 'user-basic@example.com',
    }).firestore();

    await assertSucceeds(
      setDoc(doc(userDb, 'users', 'user-basic'), {
        uid: 'user-basic',
        email: 'user-basic@example.com',
        role: 'user',
        accountType: 'user',
        accountStatus: 'active',
        status: 'active',
        firstName: 'Basic',
      }),
    );
  });

  it('blocks a regular user from creating a profile with admin fields', async () => {
    const userDb = testEnv.authenticatedContext('user-adminish', {
      email: 'user-adminish@example.com',
    }).firestore();

    await assertFails(
      setDoc(doc(userDb, 'users', 'user-adminish'), {
        uid: 'user-adminish',
        email: 'user-adminish@example.com',
        role: 'user',
        accountType: 'admin',
        accountStatus: 'active',
        status: 'active',
        adminRoleIds: ['master_admin'],
      }),
    );
  });

  it('allows a dealer member to create a pending listing for their own dealer account', async () => {
    await seedUser('dealer-owner', {
      uid: 'dealer-owner',
      email: 'dealer-owner@example.com',
      role: 'dealer',
      accountType: 'dealer',
      accountStatus: 'active',
      status: 'active',
    });
    await seedDealer('dealer-owner', {
      ownerUid: 'dealer-owner',
      approved: true,
      status: 'approved',
      isActive: true,
      isDeleted: false,
      address: 'Test',
      city: 'Tirane',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Dealer Owner',
    });

    const dealerDb = testEnv.authenticatedContext('dealer-owner', {
      email: 'dealer-owner@example.com',
    }).firestore();

    await assertSucceeds(
      setDoc(doc(dealerDb, 'listings', 'listing-pending'), {
        dealerId: 'dealer-owner',
        ownerUid: 'dealer-owner',
        status: 'pending',
        title: 'Pending Listing',
        description: 'Awaiting moderation',
        make: 'BYD',
        model: 'Seal',
        year: 2025,
        bodyType: 'Sedan',
        mileage: 0,
        fuelType: 'Electric',
        price: 1000,
        priceCurrency: 'EUR',
        images: [],
      }),
    );
  });

  it('blocks a dealer member from creating an already-active listing', async () => {
    await seedUser('dealer-owner-2', {
      uid: 'dealer-owner-2',
      email: 'dealer-owner-2@example.com',
      role: 'dealer',
      accountType: 'dealer',
      accountStatus: 'active',
      status: 'active',
    });
    await seedDealer('dealer-owner-2', {
      ownerUid: 'dealer-owner-2',
      approved: true,
      status: 'approved',
      isActive: true,
      isDeleted: false,
      address: 'Test',
      city: 'Durres',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Dealer Owner 2',
    });

    const dealerDb = testEnv.authenticatedContext('dealer-owner-2', {
      email: 'dealer-owner-2@example.com',
    }).firestore();

    await assertFails(
      setDoc(doc(dealerDb, 'listings', 'listing-active'), {
        dealerId: 'dealer-owner-2',
        ownerUid: 'dealer-owner-2',
        status: 'active',
        title: 'Active Listing',
        description: 'Should not bypass moderation',
        make: 'Tesla',
        model: 'Model 3',
        year: 2025,
        bodyType: 'Sedan',
        mileage: 0,
        fuelType: 'Electric',
        price: 1000,
        priceCurrency: 'EUR',
        images: [],
      }),
    );
  });

  it('allows an admin to update dealer plan fields but blocks the dealer from doing so', async () => {
    await seedUser('dealer-plan-admin', {
      uid: 'dealer-plan-admin',
      email: 'dealer-plan-admin@example.com',
      role: 'admin',
      accountType: 'admin',
      accountStatus: 'active',
      status: 'active',
      adminRoleIds: ['dealer_ops_admin'],
      directPermissions: {},
    });
    await seedUser('dealer-plan-owner', {
      uid: 'dealer-plan-owner',
      email: 'dealer-plan-owner@example.com',
      role: 'dealer',
      accountType: 'dealer',
      accountStatus: 'active',
      status: 'active',
      dealerPlanId: 'free',
      dealerSubscriptionStatus: 'active',
    });
    await seedDealer('dealer-plan-owner', {
      ownerUid: 'dealer-plan-owner',
      approved: true,
      status: 'approved',
      isActive: true,
      isDeleted: false,
      planId: 'free',
      subscriptionStatus: 'active',
      address: 'Test',
      city: 'Vlore',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Dealer Plan Owner',
    });

    const adminDb = testEnv.authenticatedContext('dealer-plan-admin', {
      email: 'dealer-plan-admin@example.com',
    }).firestore();
    const dealerDb = testEnv.authenticatedContext('dealer-plan-owner', {
      email: 'dealer-plan-owner@example.com',
    }).firestore();

    await assertSucceeds(
      updateDoc(doc(adminDb, 'dealers', 'dealer-plan-owner'), {
        planId: 'paid',
        subscriptionStatus: 'active',
      }),
    );

    const dealerSnapshot = await getDoc(doc(adminDb, 'dealers', 'dealer-plan-owner'));
    expect(dealerSnapshot.data()?.planId).toBe('paid');

    await assertFails(
      updateDoc(doc(dealerDb, 'dealers', 'dealer-plan-owner'), {
        planId: 'free',
      }),
    );
  });

  it('allows a dealer to create a pending review model but blocks direct edits to an approved canonical model', async () => {
    await seedUser('dealer-model-owner', {
      uid: 'dealer-model-owner',
      email: 'dealer-model-owner@example.com',
      role: 'dealer',
      accountType: 'dealer',
      accountStatus: 'active',
      status: 'active',
    });
    await seedDealer('dealer-model-owner', {
      ownerUid: 'dealer-model-owner',
      approved: true,
      status: 'approved',
      isActive: true,
      isDeleted: false,
      address: 'Test',
      city: 'Tirane',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Dealer Model Owner',
    });
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'models', 'approved-model'), {
        brand: 'BMW',
        model_name: 'i5',
        ownerUid: 'dealer-model-owner',
        ownerDealerId: 'dealer-model-owner',
        reviewStatus: 'approved',
        submissionSource: 'dealer',
        isActive: true,
      });
    });

    const dealerDb = testEnv.authenticatedContext('dealer-model-owner', {
      email: 'dealer-model-owner@example.com',
    }).firestore();

    await assertSucceeds(
      setDoc(doc(dealerDb, 'models', 'pending-model'), {
        brand: 'BYD',
        model_name: 'Sealion 7',
        ownerUid: 'dealer-model-owner',
        ownerDealerId: 'dealer-model-owner',
        reviewStatus: 'pending_review',
        submissionSource: 'dealer',
        reviewRequestedAt: '2026-05-12T00:00:00.000Z',
        isActive: false,
      }),
    );

    await assertFails(
      updateDoc(doc(dealerDb, 'models', 'approved-model'), {
        notes: 'Dealer should not edit approved canonical data directly.',
      }),
    );
  });

  it('allows public reads of approved active dealers but not private dealer records', async () => {
    await seedDealer('dealer-public', {
      ownerUid: 'dealer-public',
      approved: true,
      status: 'approved',
      isActive: true,
      isDeleted: false,
      address: 'Public',
      city: 'Tirane',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Public Dealer',
    });
    await seedDealer('dealer-private', {
      ownerUid: 'dealer-private',
      approved: false,
      status: 'pending',
      isActive: false,
      isDeleted: false,
      address: 'Private',
      city: 'Tirane',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Private Dealer',
    });

    const publicDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(publicDb, 'dealers', 'dealer-public')));
    await assertFails(getDoc(doc(publicDb, 'dealers', 'dealer-private')));
  });
});
