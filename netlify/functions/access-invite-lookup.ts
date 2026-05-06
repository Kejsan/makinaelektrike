import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
} from './_lib/http';
import { getRequiredString } from './_lib/validation';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { serializeAccessInvite } from './_lib/invites';

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const inviteId = getRequiredString(event.queryStringParameters?.code, 'code', 128);
    const snapshot = await getAdminFirestore().collection('accessInvites').doc(inviteId).get();
    if (!snapshot.exists) {
      return json(404, { error: 'Invite not found.' });
    }

    return json(200, {
      ok: true,
      invite: serializeAccessInvite(inviteId, (snapshot.data() ?? {}) as Record<string, unknown>, event),
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Invite lookups are not configured.');
    }
    if (message.includes('required')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
