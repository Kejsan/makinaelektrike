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
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import {
  getRequiredRecord,
  hasOwnField,
  parseBlogFaqsField,
  parseBlogSectionsField,
  parseBlogTranslationsField,
  parseOptionalBooleanField,
  parseOptionalStringField,
  parseStringArrayField,
} from './_lib/adminFormPayloads';
import { getEnumValue, getRequiredString } from './_lib/validation';

interface BlogSaveBody {
  postId?: string;
  values?: Record<string, unknown>;
}

const BLOG_STATUSES = ['draft', 'published'] as const;

const parseBlogValues = (value: unknown) => {
  const record = getRequiredRecord(value, 'values');
  const updates: Record<string, unknown> = {};

  const title = parseOptionalStringField(record, 'title', 300, { allowEmpty: true });
  if (title !== undefined) updates.title = title;

  const excerpt = parseOptionalStringField(record, 'excerpt', 5000, { allowEmpty: true });
  if (excerpt !== undefined) updates.excerpt = excerpt;

  const author = parseOptionalStringField(record, 'author', 200);
  if (author !== undefined) updates.author = author;

  const date = parseOptionalStringField(record, 'date', 64);
  if (date !== undefined) updates.date = date;

  const readTime = parseOptionalStringField(record, 'readTime', 120);
  if (readTime !== undefined) updates.readTime = readTime;

  const imageUrl = parseOptionalStringField(record, 'imageUrl', 2000);
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;

  const slug = parseOptionalStringField(record, 'slug', 300, { allowEmpty: true });
  if (slug !== undefined) updates.slug = slug;

  const metaTitle = parseOptionalStringField(record, 'metaTitle', 300, { allowEmpty: true });
  if (metaTitle !== undefined) updates.metaTitle = metaTitle;

  const metaDescription = parseOptionalStringField(record, 'metaDescription', 5000, {
    allowEmpty: true,
  });
  if (metaDescription !== undefined) updates.metaDescription = metaDescription;

  const focusKeyword = parseOptionalStringField(record, 'focusKeyword', 300);
  if (focusKeyword !== undefined) updates.focusKeyword = focusKeyword;

  const canonicalUrl = parseOptionalStringField(record, 'canonicalUrl', 1000);
  if (canonicalUrl !== undefined) updates.canonicalUrl = canonicalUrl;

  const metaRobots = parseOptionalStringField(record, 'metaRobots', 100);
  if (metaRobots !== undefined) updates.metaRobots = metaRobots;

  const tags = parseStringArrayField(record, 'tags', 100, 100);
  if (tags !== undefined) updates.tags = tags;

  const sections = parseBlogSectionsField(record, 'sections');
  if (sections !== undefined) updates.sections = sections;

  const faqs = parseBlogFaqsField(record, 'faqs');
  if (faqs !== undefined) updates.faqs = faqs;

  const translations = parseBlogTranslationsField(record, 'translations');
  if (translations !== undefined) updates.translations = translations;

  if (hasOwnField(record, 'status') && record.status !== undefined && record.status !== null) {
    updates.status = getEnumValue(record.status, BLOG_STATUSES, 'status');
  }

  const published = parseOptionalBooleanField(record, 'published');
  if (published !== undefined) updates.published = published;

  return updates;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'blog.publish');
    const body = event.body ? (JSON.parse(event.body) as BlogSaveBody) : {};
    const postId =
      body.postId === undefined ? undefined : getRequiredString(body.postId, 'postId', 128);
    const isCreate = !postId;
    const updates = parseBlogValues(body.values);

    if (!isCreate && Object.keys(updates).length === 0) {
      return badRequest('At least one blog save field is required.');
    }

    const firestore = getAdminFirestore();
    let resolvedPostId = postId ?? null;
    let previousData: Record<string, unknown> = {};

    if (postId) {
      const postRef = firestore.collection('blogPosts').doc(postId);
      const snapshot = await postRef.get();
      if (!snapshot.exists) {
        return json(404, { error: 'Blog post not found.' });
      }
      previousData = (snapshot.data() ?? {}) as Record<string, unknown>;

      const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: profile.uid,
      };

      if (updateData.status === 'published' && !hasOwnField(updateData, 'published')) {
        updateData.published = true;
        updateData.publishedAt = FieldValue.serverTimestamp();
      } else if (updateData.status === 'draft' && !hasOwnField(updateData, 'published')) {
        updateData.published = false;
      }

      if (updateData.published === true && !hasOwnField(updateData, 'publishedAt')) {
        updateData.publishedAt = FieldValue.serverTimestamp();
      }

      await postRef.update(updateData);
      resolvedPostId = postId;
    } else {
      const title = typeof updates.title === 'string' ? updates.title : null;
      const author = typeof updates.author === 'string' ? updates.author : null;
      const date = typeof updates.date === 'string' ? updates.date : null;
      if (!title || !author || !date) {
        return badRequest('title, author, and date are required to create a blog post.');
      }

      const postRef = firestore.collection('blogPosts').doc();
      const status =
        (updates.status as 'draft' | 'published' | undefined) ?? 'published';
      const published =
        (updates.published as boolean | undefined) ?? status === 'published';

      await postRef.set({
        ...updates,
        ownerUid: profile.uid,
        createdBy: profile.uid,
        updatedBy: profile.uid,
        status,
        published,
        ...(published ? { publishedAt: FieldValue.serverTimestamp() } : {}),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      resolvedPostId = postRef.id;
    }

    if (!resolvedPostId) {
      return internalError('Blog post id could not be resolved after save.');
    }

    const savedSnapshot = await firestore.collection('blogPosts').doc(resolvedPostId).get();
    const savedData = (savedSnapshot.data() ?? {}) as Record<string, unknown>;

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'blog_post.updated',
      entityType: 'blog_post',
      entityId: resolvedPostId,
      target: {
        uid:
          typeof savedData.ownerUid === 'string'
            ? savedData.ownerUid
            : typeof previousData.ownerUid === 'string'
              ? previousData.ownerUid
              : null,
      },
      summary: isCreate
        ? `Created blog post ${resolvedPostId}.`
        : `Updated blog post ${resolvedPostId}.`,
      before: isCreate
        ? null
        : {
            title: previousData.title ?? null,
            slug: previousData.slug ?? null,
            status: previousData.status ?? null,
            published: previousData.published ?? null,
            metaTitle: previousData.metaTitle ?? null,
          },
      after: {
        title: savedData.title ?? null,
        slug: savedData.slug ?? null,
        status: savedData.status ?? null,
        published: savedData.published ?? null,
        metaTitle: savedData.metaTitle ?? null,
      },
      metadata: {
        operation: isCreate ? 'create' : 'update',
        hasTranslations:
          typeof savedData.translations === 'object' && savedData.translations !== null,
      },
    });

    return json(200, {
      ok: true,
      postId: resolvedPostId,
      post: {
        id: savedSnapshot.id,
        ...(savedData as Record<string, unknown>),
      },
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
      return serviceUnavailable('Server-side blog saves are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be one of') ||
      message.includes('must be an object') ||
      message.includes('must be a string') ||
      message.includes('must be an array') ||
      message.includes('Boolean value is invalid')
    ) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
