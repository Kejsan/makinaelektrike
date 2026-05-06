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
import { getRequiredString } from './_lib/validation';
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { getDealerTeamCapacity, listDealerStaffUsers, requireDealerAccess } from './_lib/dealerAccess';
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
    const { profile } = await requireAuthenticatedProfile(event);
    const dealerId = getRequiredString(event.queryStringParameters?.dealerId, 'dealerId', 128);
    const dealerAccess = await requireDealerAccess(profile, dealerId);
    const [staffMembers, capacity, inviteSnapshot] = await Promise.all([
      listDealerStaffUsers(dealerId),
      getDealerTeamCapacity(dealerId, dealerAccess.dealerData),
      getAdminFirestore()
        .collection('accessInvites')
        .where('type', '==', 'dealer_staff')
        .where('dealerId', '==', dealerId)
        .get(),
    ]);

    const invites = inviteSnapshot.docs
      .sort(
        (left, right) =>
          getSortTime((right.data() as DocumentData).createdAt) - getSortTime((left.data() as DocumentData).createdAt),
      )
      .slice(0, 50)
      .map(doc => serializeAccessInvite(doc.id, (doc.data() ?? {}) as Record<string, unknown>, event));

    return json(200, {
      ok: true,
      dealerId,
      capacity,
      staffMembers,
      invites,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Authenticated admin profile was not found') || message.startsWith('You do not have dealer access')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side dealer team access is not configured.');
    }
    if (message.includes('required') || message.includes('Dealer record was not found')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
