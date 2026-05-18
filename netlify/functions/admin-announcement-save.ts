import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentData } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  parseJsonBody,
  quotaExceeded,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { isFirestoreQuotaError } from './_lib/firebaseErrors';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import {
  buildAnnouncementWritePayload,
  serializePublicAnnouncement,
} from './_lib/publicAnnouncements';
import type { PublicAnnouncementFormValues } from '../../types';

interface SaveAnnouncementBody {
  id?: unknown;
  values?: PublicAnnouncementFormValues;
}

const parseOptionalId = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 160) : null;

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const body = parseJsonBody<SaveAnnouncementBody>(event);
    const announcementId = parseOptionalId(body.id);
    const values = body.values;
    if (!values) {
      return badRequest('values are required.');
    }

    const requiredPermission = announcementId ? 'announcements.edit' : 'announcements.create';
    const { profile } = await requireAdminPermission(event, requiredPermission);

    const payload = buildAnnouncementWritePayload(values);
    if (payload.status === 'active' || payload.status === 'scheduled') {
      await requireAdminPermission(event, 'announcements.publish');
    }

    const firestore = getAdminFirestore();
    const collection = firestore.collection('publicAnnouncements');
    const docRef = announcementId ? collection.doc(announcementId) : collection.doc();
    const beforeSnapshot = announcementId ? await docRef.get() : null;
    if (announcementId && !beforeSnapshot?.exists) {
      return json(404, { error: 'Announcement not found.' });
    }

    await docRef.set(
      {
        ...payload,
        updatedBy: profile.uid,
        updatedAt: FieldValue.serverTimestamp(),
        ...(announcementId
          ? {}
          : {
              createdBy: profile.uid,
              createdAt: FieldValue.serverTimestamp(),
            }),
      },
      { merge: true },
    );

    const savedSnapshot = await docRef.get();
    const announcement = serializePublicAnnouncement(docRef.id, savedSnapshot.data() as DocumentData);

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'public_announcement.updated',
      entityType: 'public_announcement',
      entityId: docRef.id,
      summary: `${announcementId ? 'Updated' : 'Created'} public announcement ${announcement.title}.`,
      before: beforeSnapshot?.exists ? (beforeSnapshot.data() as Record<string, unknown>) : null,
      after: savedSnapshot.data() as Record<string, unknown>,
      metadata: {
        status: announcement.status,
        displayMode: announcement.displayMode,
        type: announcement.type,
      },
    });

    return json(200, {
      ok: true,
      announcement,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Missing required permission') || message.startsWith('Authenticated admin profile')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side announcement management is not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('valid') ||
      message.includes('date') ||
      message.includes('number') ||
      message.includes('at least')
    ) {
      return badRequest(message);
    }
    if (isFirestoreQuotaError(error)) {
      return quotaExceeded('Firestore quota is exhausted, so the announcement could not be saved.');
    }

    return internalError(message);
  }
};
