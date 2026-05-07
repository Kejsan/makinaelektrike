import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
const shouldApply = process.argv.includes('--apply');

if (!existsSync(serviceAccountPath)) {
  console.error('Missing service-account.json at', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const deriveAdminVisible = dealer => {
  const status =
    dealer.status === 'approved' || dealer.status === 'active'
      ? 'approved'
      : dealer.status ?? (dealer.approved === false ? 'pending' : 'approved');

  if (dealer.isDeleted === true) {
    return false;
  }

  if (status !== 'approved') {
    return false;
  }

  if (dealer.isActive === false) {
    return false;
  }

  return true;
};

const main = async () => {
  console.log(`Running dealer public-visibility backfill in ${shouldApply ? 'APPLY' : 'DRY-RUN'} mode...`);

  const snapshot = await db.collection('dealers').get();
  const candidates = snapshot.docs
    .map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
    .filter(dealer => deriveAdminVisible(dealer))
    .filter(
      dealer =>
        dealer.approved !== true ||
        dealer.isActive !== true ||
        dealer.isDeleted === true ||
        dealer.status !== 'approved',
    );

  if (candidates.length === 0) {
    console.log('No dealer records require backfill.');
    return;
  }

  console.log(`Found ${candidates.length} dealer records that are admin-visible but not public-visible.`);
  candidates.forEach(dealer => {
    console.log(
      `- ${dealer.name ?? dealer.id}: status=${dealer.status ?? 'null'}, approved=${dealer.approved ?? 'null'}, isActive=${dealer.isActive ?? 'null'}, isDeleted=${dealer.isDeleted ?? 'null'}`,
    );
  });

  if (!shouldApply) {
    console.log('Dry run complete. Re-run with --apply to persist these updates.');
    return;
  }

  const batch = db.batch();
  candidates.forEach(dealer => {
    batch.update(dealer.ref, {
      status: 'approved',
      approved: true,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
  console.log(`Applied public-visibility backfill to ${candidates.length} dealer records.`);
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Dealer public-visibility backfill failed:', error);
    process.exit(1);
  });
