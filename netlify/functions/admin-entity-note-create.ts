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
import { getRequiredString } from './_lib/validation';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { buildAdminEntityKey, serializeAdminEntityNote } from './_lib/adminEntityDetails';

interface AdminEntityNoteCreateBody {
  entityType?: string;
  entityId?: string;
  body?: string;
}

type SupportedEntityType = 'user' | 'dealer' | 'listing';

const ENTITY_PERMISSION_MAP: Record<
  SupportedEntityType,
  'users.edit' | 'dealers.edit' | 'listings.moderate'
> = {
  user: 'users.edit',
  dealer: 'dealers.edit',
  listing: 'listings.moderate',
};

const ENTITY_COLLECTION_MAP: Record<SupportedEntityType, 'users' | 'dealers' | 'listings'> = {
  user: 'users',
  dealer: 'dealers',
  listing: 'listings',
};

const getEntityType = (value: unknown): SupportedEntityType => {
  const entityType = getRequiredString(value, 'entityType', 32);
  if (entityType !== 'user' && entityType !== 'dealer' && entityType !== 'listing') {
    throw new Error('entityType must be either user, dealer, or listing.');
  }
  return entityType;
};

const buildSummary = (entityType: SupportedEntityType, label: string) =>
  entityType === 'user'
    ? `Added internal admin note to user ${label}.`
    : entityType === 'dealer'
      ? `Added internal admin note to dealer ${label}.`
      : `Added internal admin note to listing ${label}.`;

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const body = event.body ? (JSON.parse(event.body) as AdminEntityNoteCreateBody) : {};
    const entityType = getEntityType(body.entityType);
    const entityId = getRequiredString(body.entityId, 'entityId', 128);
    const noteBody = getRequiredString(body.body, 'body', 5000);
    const { profile } = await requireAdminPermission(event, ENTITY_PERMISSION_MAP[entityType]);
    const firestore = getAdminFirestore();
    const targetSnapshot = await firestore.collection(ENTITY_COLLECTION_MAP[entityType]).doc(entityId).get();

    if (!targetSnapshot.exists) {
      return json(404, {
        error:
          entityType === 'user'
            ? 'User not found.'
            : entityType === 'dealer'
              ? 'Dealer not found.'
              : 'Listing not found.',
      });
    }

    const targetData = (targetSnapshot.data() ?? {}) as Record<string, unknown>;
    const targetLabel =
      entityType === 'user'
        ? typeof targetData.email === 'string'
          ? targetData.email
          : entityId
        : entityType === 'dealer'
          ? typeof targetData.name === 'string'
            ? targetData.name
            : typeof targetData.companyName === 'string'
              ? targetData.companyName
              : entityId
          : typeof targetData.title === 'string'
            ? targetData.title
            : [targetData.make, targetData.model]
                .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
                .join(' ') || entityId;

    const noteReference = firestore.collection('adminEntityNotes').doc();
    const entityKey = buildAdminEntityKey(entityType, entityId);

    await noteReference.set({
      entityType,
      entityId,
      entityKey,
      body: noteBody,
      createdByUid: profile.uid,
      createdByEmail: profile.email ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    const noteSnapshot = await noteReference.get();

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'admin_note.created',
      entityType,
      entityId,
      summary: buildSummary(entityType, targetLabel),
      target:
        entityType === 'user'
          ? {
              uid: entityId,
              email: typeof targetData.email === 'string' ? targetData.email : null,
            }
          : entityType === 'listing' && typeof targetData.ownerUid === 'string'
            ? {
                uid: targetData.ownerUid,
              }
          : undefined,
      after: {
        noteId: noteReference.id,
        body: noteBody,
      },
      metadata: {
        entityKey,
      },
    });

    return json(200, {
      ok: true,
      note: serializeAdminEntityNote(noteReference.id, (noteSnapshot.data() ?? {}) as Record<string, unknown>),
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
      return serviceUnavailable('Server-side admin notes are not configured.');
    }
    if (message.includes('required') || message.includes('entityType must be')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
