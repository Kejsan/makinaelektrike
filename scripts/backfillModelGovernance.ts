import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../netlify/functions/_lib/firebaseAdmin';

const shouldWrite = process.argv.includes('--write');
const VALID_REVIEW_STATUSES = new Set(['approved', 'pending_review', 'rejected']);
const VALID_SUBMISSION_SOURCES = new Set(['admin', 'dealer', 'import', 'migration']);

const main = async () => {
  const firestore = getAdminFirestore();
  const snapshot = await firestore.collection('models').get();

  let scanned = 0;
  let changed = 0;
  let written = 0;
  let batch = firestore.batch();
  let batchOps = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const raw = (doc.data() ?? {}) as Record<string, unknown>;

    const reviewStatus =
      typeof raw.reviewStatus === 'string' && VALID_REVIEW_STATUSES.has(raw.reviewStatus)
        ? raw.reviewStatus
        : 'approved';
    const submissionSource =
      typeof raw.submissionSource === 'string' && VALID_SUBMISSION_SOURCES.has(raw.submissionSource)
        ? raw.submissionSource
        : typeof raw.ownerDealerId === 'string' && raw.ownerDealerId.trim().length > 0
          ? 'dealer'
          : 'migration';

    const patch: Record<string, unknown> = {
      reviewStatus,
      submissionSource,
    };

    if (reviewStatus === 'approved') {
      if (raw.isActive === undefined) {
        patch.isActive = true;
      }
      if (raw.reviewedAt === undefined || raw.reviewedAt === null) {
        patch.reviewedAt = raw.updatedAt ?? raw.createdAt ?? FieldValue.serverTimestamp();
      }
      if (raw.reviewNotes === undefined) {
        patch.reviewNotes = null;
      }
    } else {
      if (raw.isActive !== false) {
        patch.isActive = false;
      }
      if (raw.reviewRequestedAt === undefined || raw.reviewRequestedAt === null) {
        patch.reviewRequestedAt = raw.updatedAt ?? raw.createdAt ?? FieldValue.serverTimestamp();
      }
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
