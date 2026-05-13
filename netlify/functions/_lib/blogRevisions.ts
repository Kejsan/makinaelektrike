import { FieldValue } from 'firebase-admin/firestore';

type BlogRevisionAction = 'create' | 'save' | 'publish' | 'unpublish' | 'delete' | 'backfill';

interface WriteBlogRevisionInput {
  postId: string;
  snapshot: Record<string, unknown>;
  action: BlogRevisionAction;
  actorUid?: string | null;
  actorEmail?: string | null;
  summary?: string | null;
}

const REVISION_ID_PAD = 6;

export const writeBlogPostRevision = async (
  firestore: FirebaseFirestore.Firestore,
  input: WriteBlogRevisionInput,
) => {
  const postRef = firestore.collection('blogPosts').doc(input.postId);
  const revisionsRef = postRef.collection('revisions');
  const latestRevisionSnapshot = await revisionsRef
    .orderBy('revisionNumber', 'desc')
    .limit(1)
    .get();

  const previousRevisionNumber =
    latestRevisionSnapshot.docs[0]?.data()?.revisionNumber;
  const nextRevisionNumber =
    typeof previousRevisionNumber === 'number' ? previousRevisionNumber + 1 : 1;

  const revisionRef = revisionsRef.doc(String(nextRevisionNumber).padStart(REVISION_ID_PAD, '0'));
  await revisionRef.set({
    postId: input.postId,
    revisionNumber: nextRevisionNumber,
    action: input.action,
    snapshot: input.snapshot,
    createdBy: input.actorUid ?? null,
    createdByEmail: input.actorEmail ?? null,
    summary: input.summary ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  const postSnapshot = await postRef.get();
  if (postSnapshot.exists) {
    await postRef.set(
      {
        revisionCount: nextRevisionNumber,
        latestRevisionNumber: nextRevisionNumber,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  return nextRevisionNumber;
};
