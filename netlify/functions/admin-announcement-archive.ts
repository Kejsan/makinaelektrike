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
import { serializePublicAnnouncement } from './_lib/publicAnnouncements';

interface ArchiveAnnouncementBody {
  id?: unknown;
}

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'announcements.edit');
    const body = parseJsonBody<ArchiveAnnouncementBody>(event);
    const announcementId = typeof body.id === 'string' ? body.id.trim() : '';
    if (!announcementId) {
      return badRequest('id is required.');
    }

    const firestore = getAdminFirestore();
    const docRef = firestore.collection('publicAnnouncements').doc(announcementId);
    const beforeSnapshot = await docRef.get();
    if (!beforeSnapshot.exists) {
      return json(404, { error: 'Announcement not found.' });
    }

    await docRef.set(
      {
        status: 'archived',
        updatedBy: profile.uid,
        updatedAt: FieldValue.serverTimestamp(),
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
      summary: `Archived public announcement ${announcement.title}.`,
      before: beforeSnapshot.data() as Record<string, unknown>,
      after: savedSnapshot.data() as Record<string, unknown>,
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
    if (message.includes('required')) {
      return badRequest(message);
    }
    if (isFirestoreQuotaError(error)) {
      return quotaExceeded('Firestore quota is exhausted, so the announcement could not be archived.');
    }

    return internalError(message);
  }
};
