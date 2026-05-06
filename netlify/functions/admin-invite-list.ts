import type { DocumentData } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { serializeAccessInvite } from './_lib/invites';

const getSortTime = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  if ('toDate' in (value as Record<string, unknown>) && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }

  return 0;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    await requireAdminPermission(event, 'admins.invite');
    const snapshot = await getAdminFirestore()
      .collection('accessInvites')
      .where('type', '==', 'platform_admin')
      .get();

    const invites = snapshot.docs
      .sort(
        (left, right) =>
          getSortTime((right.data() as DocumentData).createdAt) - getSortTime((left.data() as DocumentData).createdAt),
      )
      .slice(0, 50)
      .map(doc => serializeAccessInvite(doc.id, (doc.data() ?? {}) as Record<string, unknown>, event));

    return json(200, {
      ok: true,
      invites,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Missing required permission') || message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side admin invites are not configured.');
    }

    return internalError(message);
  }
};
