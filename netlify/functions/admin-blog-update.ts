import { FieldValue } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { getEnumValue, getOptionalBoolean, getRequiredString } from './_lib/validation';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { writeBlogPostRevision } from './_lib/blogRevisions';

interface BlogAdminUpdateBody {
  postId?: string;
  status?: 'draft' | 'published';
  delete?: boolean | string;
}

const BLOG_STATUSES = ['draft', 'published'] as const;

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'blog.publish');
    const body = event.body ? (JSON.parse(event.body) as BlogAdminUpdateBody) : {};
    const postId = getRequiredString(body.postId, 'postId', 128);
    const nextStatus =
      body.status === undefined ? undefined : getEnumValue(body.status, BLOG_STATUSES, 'status');
    const shouldDelete =
      body.delete === undefined ? false : getOptionalBoolean(body.delete) === true;

    if (nextStatus === undefined && !shouldDelete) {
      return badRequest('At least one blog admin update field is required.');
    }

    const firestore = getAdminFirestore();
    const postRef = firestore.collection('blogPosts').doc(postId);
    const snapshot = await postRef.get();
    if (!snapshot.exists) {
      return json(404, { error: 'Blog post not found.' });
    }

    const previousData = (snapshot.data() ?? {}) as Record<string, unknown>;

    if (shouldDelete) {
      await writeBlogPostRevision(firestore, {
        postId,
        snapshot: previousData,
        action: 'delete',
        actorUid: profile.uid,
        actorEmail: profile.email ?? null,
        summary: `Captured final revision before deleting blog post ${postId}.`,
      });
      await postRef.delete();
      await writeAdminAuditLog({
        actor: buildAuditActor(profile),
        action: 'blog_post.updated',
        entityType: 'blog_post',
        entityId: postId,
        target: {
          uid: typeof previousData.ownerUid === 'string' ? previousData.ownerUid : null,
        },
        summary: `Deleted blog post ${postId}.`,
        before: {
          title: previousData.title ?? null,
          status: previousData.status ?? null,
          slug: previousData.slug ?? null,
        },
        after: {
          deleted: true,
        },
      });

      return json(200, {
        ok: true,
        postId,
        deleted: true,
      });
    }

    const updateData: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: profile.uid,
    };
    if (nextStatus === 'published') {
      updateData.published = true;
      updateData.publishedAt = FieldValue.serverTimestamp();
    } else {
      updateData.published = false;
    }

    await postRef.update(updateData);
    const updatedSnapshot = await postRef.get();
    const updatedData = (updatedSnapshot.data() ?? {}) as Record<string, unknown>;

    await writeBlogPostRevision(firestore, {
      postId,
      snapshot: updatedData,
      action: nextStatus === 'published' ? 'publish' : 'unpublish',
      actorUid: profile.uid,
      actorEmail: profile.email ?? null,
      summary: `Captured ${nextStatus} revision for blog post ${postId}.`,
    });

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'blog_post.updated',
      entityType: 'blog_post',
      entityId: postId,
      target: {
        uid: typeof previousData.ownerUid === 'string' ? previousData.ownerUid : null,
      },
      summary: `Changed blog post ${postId} to ${nextStatus}.`,
      before: {
        status: previousData.status ?? null,
        published: previousData.published ?? null,
      },
      after: {
        status: nextStatus,
        published: nextStatus === 'published',
      },
      metadata: {
        title: previousData.title ?? null,
        slug: previousData.slug ?? null,
      },
    });

    return json(200, {
      ok: true,
      postId,
      status: nextStatus,
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Missing required permission')) {
      return forbidden(message);
    }
    if (message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side blog moderation is not configured.');
    }
    if (message.includes('required') || message.includes('must be one of') || message.includes('Boolean value is invalid') || message.includes('At least one blog admin update field')) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
