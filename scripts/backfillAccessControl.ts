import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../netlify/functions/_lib/firebaseAdmin';
import { normalizeUserProfile } from '../utils/accessControl';

const shouldWrite = process.argv.includes('--write');

const main = async () => {
  const firestore = getAdminFirestore();
  const snapshot = await firestore.collection('users').get();

  let scanned = 0;
  let changed = 0;
  let written = 0;
  let batch = firestore.batch();
  let batchOps = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const raw = (doc.data() ?? {}) as Record<string, unknown>;
    const identity = {
      uid: doc.id,
      email: typeof raw.email === 'string' ? raw.email : null,
    };
    const normalized = normalizeUserProfile(identity, raw);

    const patch: Record<string, unknown> = {
      role: normalized.role,
      status: normalized.status ?? normalized.accountStatus ?? 'active',
      accountType: normalized.accountType ?? 'user',
      accountStatus: normalized.accountStatus ?? normalized.status ?? 'active',
      adminRoleIds: normalized.adminRoleIds ?? [],
      directPermissions: normalized.directPermissions ?? {},
      isMasterAdmin: normalized.isMasterAdmin ?? false,
    };

    if (normalized.dealerPlanId !== undefined) {
      patch.dealerPlanId = normalized.dealerPlanId;
    }
    if (normalized.dealerSubscriptionStatus !== undefined) {
      patch.dealerSubscriptionStatus = normalized.dealerSubscriptionStatus;
    }

    const differs = Object.entries(patch).some(([key, value]) => {
      const current = raw[key];
      return JSON.stringify(current) !== JSON.stringify(value);
    });

    if (!differs) {
      continue;
    }

    changed += 1;

    if (shouldWrite) {
      batch.set(
        doc.ref,
        {
          ...patch,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      batchOps += 1;

      if (batchOps >= 400) {
        await batch.commit();
        written += batchOps;
        batch = firestore.batch();
        batchOps = 0;
      }
    }
  }

  if (shouldWrite && batchOps > 0) {
    await batch.commit();
    written += batchOps;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: shouldWrite ? 'write' : 'dry-run',
        scanned,
        changed,
        written,
      },
      null,
      2,
    ),
  );
};

void main().catch(error => {
  console.error(error);
  process.exit(1);
});
