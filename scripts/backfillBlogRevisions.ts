import { getAdminFirestore } from '../netlify/functions/_lib/firebaseAdmin';
import { writeBlogPostRevision } from '../netlify/functions/_lib/blogRevisions';

const shouldWrite = process.argv.includes('--write');

const main = async () => {
  const firestore = getAdminFirestore();
  const snapshot = await firestore.collection('blogPosts').get();

  let scanned = 0;
  let missingRevisionHistories = 0;
  let syncedCounters = 0;
  let written = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const revisionsRef = doc.ref.collection('revisions');
    const latestRevisionSnapshot = await revisionsRef
      .orderBy('revisionNumber', 'desc')
      .limit(1)
      .get();

    const latestRevisionNumber = latestRevisionSnapshot.docs[0]?.data()?.revisionNumber;

    if (typeof latestRevisionNumber !== 'number') {
      missingRevisionHistories += 1;
      if (shouldWrite) {
        await writeBlogPostRevision(firestore, {
          postId: doc.id,
          snapshot: data,
          action: 'backfill',
          actorUid:
            typeof data.updatedBy === 'string'
              ? data.updatedBy
              : typeof data.createdBy === 'string'
                ? data.createdBy
                : typeof data.ownerUid === 'string'
                  ? data.ownerUid
                  : null,
          actorEmail: typeof data.email === 'string' ? data.email : null,
          summary: `Backfilled initial revision history for blog post ${doc.id}.`,
        });
        written += 1;
      }
      continue;
    }

    if (
      data.revisionCount !== latestRevisionNumber ||
      data.latestRevisionNumber !== latestRevisionNumber
    ) {
      syncedCounters += 1;
      if (shouldWrite) {
        await doc.ref.set(
          {
            revisionCount: latestRevisionNumber,
            latestRevisionNumber,
          },
          { merge: true },
        );
        written += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: shouldWrite ? 'write' : 'dry-run',
        scanned,
        missingRevisionHistories,
        syncedCounters,
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
