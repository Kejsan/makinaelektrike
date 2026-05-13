import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handler } from '../../netlify/functions/admin-access-update';
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

describe('admin-access-update', () => {
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

  it('blocks a non-master admin from granting the master_admin role', async () => {
    const actor = await createUser({ name: 'scoped-admin' });
    const target = await createUser({ name: 'target-user' });

    await seedUserProfile(actor, {
      role: 'admin',
      accountType: 'admin',
      accountStatus: 'active',
      status: 'active',
      adminRoleIds: ['platform_ops_admin'],
      directPermissions: {
        'admins.assign_permissions': true,
      },
    });
    await seedUserProfile(target, {
      role: 'user',
      accountType: 'user',
      accountStatus: 'active',
      status: 'active',
    });

    const response = await handler(
      buildFunctionEvent({
        idToken: actor.idToken,
        body: {
          uid: target.uid,
          adminRoleIds: ['master_admin'],
        },
      }),
    );

    expect(response.statusCode).toBe(403);
    expect(parseResponseBody<{ error: string }>(response.body).error).toContain(
      'Only a master admin can grant the master_admin role.',
    );
  });

  it('blocks a non-master admin from setting direct permission overrides', async () => {
    const actor = await createUser({ name: 'scoped-admin-direct' });
    const target = await createUser({ name: 'target-user-direct' });

    await seedUserProfile(actor, {
      role: 'admin',
      accountType: 'admin',
      accountStatus: 'active',
      status: 'active',
      adminRoleIds: ['platform_ops_admin'],
      directPermissions: {
        'admins.assign_permissions': true,
      },
    });
    await seedUserProfile(target, {
      role: 'user',
      accountType: 'user',
      accountStatus: 'active',
      status: 'active',
    });

    const response = await handler(
      buildFunctionEvent({
        idToken: actor.idToken,
        body: {
          uid: target.uid,
          adminRoleIds: ['content_admin'],
          directPermissions: {
            'blog.publish': true,
          },
        },
      }),
    );

    expect(response.statusCode).toBe(403);
    expect(parseResponseBody<{ error: string }>(response.body).error).toContain(
      'Only a master admin can set direct permission overrides.',
    );
  });

  it('allows a master admin to assign scoped platform admin access and records an audit log', async () => {
    const actor = await createUser({ name: 'master-admin' });
    const target = await createUser({ name: 'target-admin' });

    await seedUserProfile(actor, {
      role: 'admin',
      accountType: 'admin',
      accountStatus: 'active',
      status: 'active',
      adminRoleIds: ['master_admin'],
      directPermissions: {},
      isMasterAdmin: true,
    });
    await seedUserProfile(target, {
      role: 'user',
      accountType: 'user',
      accountStatus: 'active',
      status: 'active',
    });

    const response = await handler(
      buildFunctionEvent({
        idToken: actor.idToken,
        body: {
          uid: target.uid,
          adminRoleIds: ['content_admin'],
          accountStatus: 'active',
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(
      parseResponseBody<{
        uid: string;
        role: string;
        accountStatus: string;
        adminRoleIds: string[];
        isMasterAdmin: boolean;
      }>(response.body),
    ).toMatchObject({
      uid: target.uid,
      role: 'admin',
      accountStatus: 'active',
      adminRoleIds: ['content_admin'],
      isMasterAdmin: false,
    });

    const firestore = await getAdminFirestoreForTests();
    const [targetSnapshot, auditSnapshot] = await Promise.all([
      firestore.collection('users').doc(target.uid).get(),
      firestore
        .collection('adminAuditLogs')
        .where('action', '==', 'admin_access.updated')
        .where('entityId', '==', target.uid)
        .get(),
    ]);

    expect(targetSnapshot.data()).toMatchObject({
      role: 'admin',
      accountType: 'admin',
      adminRoleIds: ['content_admin'],
      isMasterAdmin: false,
      updatedBy: actor.uid,
    });
    expect(auditSnapshot.size).toBe(1);
    expect(auditSnapshot.docs[0]?.data()).toMatchObject({
      action: 'admin_access.updated',
      entityType: 'user',
      entityId: target.uid,
      actorUid: actor.uid,
      targetUid: target.uid,
    });
  });
});
