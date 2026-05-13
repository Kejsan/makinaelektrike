import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { doc, setDoc } from 'firebase/firestore';
import { TEST_PROJECT_ID } from '../helpers/emulator';

const firestoreRules = readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
const storageRules = readFileSync(path.join(process.cwd(), 'storage.rules'), 'utf8');

describe('storage.rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: TEST_PROJECT_ID,
      firestore: {
        rules: firestoreRules,
        host: '127.0.0.1',
        port: 8080,
      },
      storage: {
        rules: storageRules,
        host: '127.0.0.1',
        port: 9199,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  const seedDoc = async (collection: string, id: string, data: Record<string, unknown>) => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), collection, id), data);
    });
  };

  const uploadImage = async (
    context: RulesTestContext,
    objectPath: string,
  ) => {
    const objectRef = context.storage().ref(objectPath);
    return objectRef.putString('tiny-image', 'raw', {
      contentType: 'image/webp',
    });
  };

  it('allows a dealer member to upload dealer media into their own path', async () => {
    await seedDoc('users', 'dealer-storage-owner', {
      uid: 'dealer-storage-owner',
      email: 'dealer-storage-owner@example.com',
      role: 'dealer',
      accountType: 'dealer',
      accountStatus: 'active',
      status: 'active',
    });
    await seedDoc('dealers', 'dealer-storage-owner', {
      ownerUid: 'dealer-storage-owner',
      approved: true,
      status: 'approved',
      isActive: true,
      isDeleted: false,
      address: 'Dealer',
      city: 'Tirane',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Dealer Storage Owner',
    });

    const dealerContext = testEnv.authenticatedContext('dealer-storage-owner', {
      email: 'dealer-storage-owner@example.com',
    });

    await assertSucceeds(uploadImage(dealerContext, 'dealers/dealer-storage-owner/hero/test.webp'));
  });

  it('blocks an unrelated user from uploading dealer media into someone else’s path', async () => {
    await seedDoc('users', 'outsider-user', {
      uid: 'outsider-user',
      email: 'outsider-user@example.com',
      role: 'user',
      accountType: 'user',
      accountStatus: 'active',
      status: 'active',
    });

    const outsiderContext = testEnv.authenticatedContext('outsider-user', {
      email: 'outsider-user@example.com',
    });

    await assertFails(uploadImage(outsiderContext, 'dealers/dealer-storage-owner/hero/test.webp'));
  });

  it('allows an admin to upload model media', async () => {
    await seedDoc('users', 'catalog-admin', {
      uid: 'catalog-admin',
      email: 'catalog-admin@example.com',
      role: 'admin',
      accountType: 'admin',
      accountStatus: 'active',
      status: 'active',
      adminRoleIds: ['catalog_admin'],
      directPermissions: {},
    });

    const adminContext = testEnv.authenticatedContext('catalog-admin', {
      email: 'catalog-admin@example.com',
    });

    await assertSucceeds(uploadImage(adminContext, 'models/model-alpha/hero/test.webp'));
  });

  it('blocks a dealer from uploading media to an approved canonical model', async () => {
    await seedDoc('users', 'dealer-model-uploader', {
      uid: 'dealer-model-uploader',
      email: 'dealer-model-uploader@example.com',
      role: 'dealer',
      accountType: 'dealer',
      accountStatus: 'active',
      status: 'active',
    });
    await seedDoc('dealers', 'dealer-model-uploader', {
      ownerUid: 'dealer-model-uploader',
      approved: true,
      status: 'approved',
      isActive: true,
      isDeleted: false,
      address: 'Dealer',
      city: 'Tirane',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Dealer Model Uploader',
    });
    await seedDoc('models', 'approved-model', {
      brand: 'BMW',
      model_name: 'i5',
      ownerUid: 'dealer-model-uploader',
      ownerDealerId: 'dealer-model-uploader',
      reviewStatus: 'approved',
      submissionSource: 'dealer',
      isActive: true,
    });

    const dealerContext = testEnv.authenticatedContext('dealer-model-uploader', {
      email: 'dealer-model-uploader@example.com',
    });

    await assertFails(uploadImage(dealerContext, 'models/approved-model/hero/test.webp'));
  });

  it('blocks a suspended dealer from uploading listing media', async () => {
    await seedDoc('users', 'suspended-dealer', {
      uid: 'suspended-dealer',
      email: 'suspended-dealer@example.com',
      role: 'dealer',
      accountType: 'dealer',
      accountStatus: 'suspended',
      status: 'suspended',
    });
    await seedDoc('dealers', 'suspended-dealer', {
      ownerUid: 'suspended-dealer',
      approved: true,
      status: 'approved',
      isActive: true,
      isDeleted: false,
      address: 'Dealer',
      city: 'Durres',
      lat: 0,
      lng: 0,
      brands: [],
      languages: [],
      typeOfCars: 'EV',
      modelsAvailable: [],
      name: 'Suspended Dealer',
    });

    const suspendedContext = testEnv.authenticatedContext('suspended-dealer', {
      email: 'suspended-dealer@example.com',
    });

    await assertFails(
      uploadImage(suspendedContext, 'listings/suspended-dealer/listing-alpha/hero/test.webp'),
    );
  });
});
