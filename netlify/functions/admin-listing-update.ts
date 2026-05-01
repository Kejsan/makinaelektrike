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
import { getOptionalString, getRequiredString } from './_lib/validation';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import type { ListingStatus } from '../../types';

interface ListingUpdateBody {
  listingId?: string;
  status?: ListingStatus;
  dealerId?: string;
  rejectionReason?: string | null;
}

const ALLOWED_STATUSES: ListingStatus[] = [
  'pending',
  'approved',
  'active',
  'inactive',
  'deleted',
  'rejected',
];

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const body = event.body ? (JSON.parse(event.body) as ListingUpdateBody) : {};
    const nextStatus =
      body.status !== undefined
        ? (() => {
            const status = getRequiredString(body.status, 'status', 32) as ListingStatus;
            if (!ALLOWED_STATUSES.includes(status)) {
              throw new Error(`status must be one of: ${ALLOWED_STATUSES.join(', ')}.`);
            }
            return status;
          })()
        : undefined;
    const nextDealerId = getOptionalString(body.dealerId, { field: 'dealerId', maxLength: 128 });
    const rejectionReason = body.rejectionReason === null
      ? null
      : getOptionalString(body.rejectionReason, { field: 'rejectionReason', maxLength: 1000 });

    if (nextStatus === undefined && nextDealerId === undefined && body.rejectionReason === undefined) {
      return badRequest('At least one listing update field is required.');
    }

    const requiredPermission =
      nextDealerId !== undefined ? 'listings.reassign' : 'listings.moderate';
    const { profile } = await requireAdminPermission(event, requiredPermission);
    const listingId = getRequiredString(body.listingId, 'listingId', 128);

    const firestore = getAdminFirestore();
    const listingRef = firestore.collection('listings').doc(listingId);
    const snapshot = await listingRef.get();
    if (!snapshot.exists) {
      return json(404, { error: 'Listing not found.' });
    }

    const previousData = (snapshot.data() ?? {}) as Record<string, unknown>;
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: profile.uid,
    };

    if (nextDealerId !== undefined) {
      updateData.dealerId = nextDealerId;
    }

    if (nextStatus !== undefined) {
      updateData.status = nextStatus;
      if (nextStatus === 'approved' || nextStatus === 'active') {
        updateData.approvedAt = FieldValue.serverTimestamp();
        updateData.rejectedAt = null;
        updateData.rejectionReason = null;
      } else if (nextStatus === 'rejected') {
        updateData.rejectedAt = FieldValue.serverTimestamp();
        updateData.rejectionReason = rejectionReason ?? null;
        updateData.approvedAt = null;
      } else if (nextStatus === 'deleted') {
        updateData.rejectionReason = previousData.rejectionReason ?? null;
      }
    }

    if (body.rejectionReason !== undefined && nextStatus !== 'rejected') {
      updateData.rejectionReason = rejectionReason;
    }

    await listingRef.update(updateData);

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'listing.updated',
      entityType: 'listing',
      entityId: listingId,
      target: {
        uid: typeof previousData.ownerUid === 'string' ? previousData.ownerUid : null,
      },
      summary: `Updated listing ${listingId}${nextStatus ? ` to status ${nextStatus}` : ''}${nextDealerId ? ` and reassigned to dealer ${nextDealerId}` : ''}.`,
      before: {
        status: previousData.status ?? null,
        dealerId: previousData.dealerId ?? null,
        rejectionReason: previousData.rejectionReason ?? null,
      },
      after: {
        status: nextStatus ?? previousData.status ?? null,
        dealerId: nextDealerId ?? previousData.dealerId ?? null,
        rejectionReason:
          body.rejectionReason !== undefined
            ? rejectionReason
            : nextStatus === 'rejected'
              ? rejectionReason ?? null
              : nextStatus === 'approved' || nextStatus === 'active'
                ? null
                : previousData.rejectionReason ?? null,
      },
      metadata: {
        previousDealerId: previousData.dealerId ?? null,
        previousStatus: previousData.status ?? null,
      },
    });

    return json(200, {
      ok: true,
      listingId,
      status: nextStatus ?? null,
      dealerId: nextDealerId ?? previousData.dealerId ?? null,
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
      return serviceUnavailable('Server-side listing moderation is not configured.');
    }
    if (message.includes('required') || message.includes('must be one of') || message.includes('At least one listing update field')) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
