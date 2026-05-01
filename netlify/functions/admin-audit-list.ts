import type { DocumentData } from 'firebase-admin/firestore';
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

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const getLimit = (event: FunctionEvent) => {
  const rawLimit = event.queryStringParameters?.limit;
  if (!rawLimit) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_LIMIT) {
    throw new Error(`limit must be a positive number up to ${MAX_LIMIT}.`);
  }

  return Math.floor(parsed);
};

const serializeTimestamp = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }

  return null;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    await requireAdminPermission(event, 'audit.view');
    const limit = getLimit(event);
    const snapshot = await getAdminFirestore()
      .collection('adminAuditLogs')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return json(200, {
      ok: true,
      logs: snapshot.docs.map(doc => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          action: typeof data.action === 'string' ? data.action : '',
          entityType: typeof data.entityType === 'string' ? data.entityType : '',
          entityId: typeof data.entityId === 'string' ? data.entityId : '',
          actorUid: typeof data.actorUid === 'string' ? data.actorUid : '',
          actorEmail: typeof data.actorEmail === 'string' ? data.actorEmail : null,
          actorAdminRoleIds: Array.isArray(data.actorAdminRoleIds) ? data.actorAdminRoleIds : [],
          targetUid: typeof data.targetUid === 'string' ? data.targetUid : null,
          targetEmail: typeof data.targetEmail === 'string' ? data.targetEmail : null,
          summary: typeof data.summary === 'string' ? data.summary : '',
          before:
            data.before && typeof data.before === 'object' && !Array.isArray(data.before)
              ? data.before
              : null,
          after:
            data.after && typeof data.after === 'object' && !Array.isArray(data.after)
              ? data.after
              : null,
          metadata:
            data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
              ? data.metadata
              : null,
          createdAt: serializeTimestamp(data.createdAt),
        };
      }),
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
      return serviceUnavailable('Server-side audit log access is not configured.');
    }
    if (message.includes('limit must be')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
