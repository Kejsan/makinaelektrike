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
import { getEnumValue, getRequiredString } from './_lib/validation';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';

interface DealerStatusUpdateBody {
  dealerId?: string;
  action?: 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'delete';
}

const DEALER_ACTIONS = [
  'approve',
  'reject',
  'deactivate',
  'reactivate',
  'delete',
] as const satisfies readonly DealerStatusUpdateBody['action'][];

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const body = event.body ? (JSON.parse(event.body) as DealerStatusUpdateBody) : {};
    const action = getEnumValue(body.action, DEALER_ACTIONS, 'action');
    const requiredPermission =
      action === 'approve' || action === 'reject' ? 'dealers.approve' : 'dealers.edit';
    const { profile } = await requireAdminPermission(event, requiredPermission);
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);

    const firestore = getAdminFirestore();
    const dealerRef = firestore.collection('dealers').doc(dealerId);
    const dealerSnapshot = await dealerRef.get();
    if (!dealerSnapshot.exists) {
      return json(404, { error: 'Dealer not found.' });
    }

    const previousData = (dealerSnapshot.data() ?? {}) as Record<string, unknown>;
    const dealerUpdate: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: profile.uid,
    };
    const userUpdate: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: profile.uid,
    };

    if (action === 'approve') {
      Object.assign(dealerUpdate, {
        approved: true,
        status: 'approved',
        isActive: true,
        isDeleted: false,
        approvedAt: FieldValue.serverTimestamp(),
        rejectedAt: null,
        deletedAt: null,
      });
      Object.assign(userUpdate, {
        role: 'dealer',
        accountType: 'dealer',
        accountStatus: 'approved',
        status: 'approved',
      });
    } else if (action === 'reject') {
      Object.assign(dealerUpdate, {
        approved: false,
        status: 'rejected',
        isActive: false,
        rejectedAt: FieldValue.serverTimestamp(),
        approvedAt: null,
      });
      Object.assign(userUpdate, {
        accountType: 'dealer',
        accountStatus: 'rejected',
        status: 'rejected',
      });
    } else if (action === 'deactivate') {
      Object.assign(dealerUpdate, {
        approved: true,
        status: 'approved',
        isActive: false,
      });
    } else if (action === 'reactivate') {
      Object.assign(dealerUpdate, {
        approved: true,
        status: 'approved',
        isActive: true,
        isDeleted: false,
        deletedAt: null,
        approvedAt: FieldValue.serverTimestamp(),
        rejectedAt: null,
      });
      Object.assign(userUpdate, {
        role: 'dealer',
        accountType: 'dealer',
        accountStatus: 'approved',
        status: 'approved',
      });
    } else if (action === 'delete') {
      Object.assign(dealerUpdate, {
        approved: false,
        status: 'deleted',
        isActive: false,
        isDeleted: true,
        deletedAt: FieldValue.serverTimestamp(),
      });
    }

    await dealerRef.update(dealerUpdate);

    const linkedUserIds = Array.from(
      new Set(
        [dealerId, previousData.ownerUid, previousData.uid].filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        ),
      ),
    );
    await Promise.all(
      linkedUserIds.map(async userId => {
        const userRef = firestore.collection('users').doc(userId);
        const snapshot = await userRef.get();
        if (!snapshot.exists) {
          return;
        }
        await userRef.update(userUpdate);
      }),
    );

    const afterData = {
      approved: action === 'approve' || action === 'reactivate' ? true : action === 'reject' || action === 'delete' ? false : previousData.approved ?? true,
      status:
        action === 'delete'
          ? 'deleted'
          : action === 'reject'
            ? 'rejected'
            : 'approved',
      isActive:
        action === 'approve' || action === 'reactivate'
          ? true
          : action === 'deactivate' || action === 'reject' || action === 'delete'
            ? false
            : previousData.isActive ?? false,
      isDeleted: action === 'delete' ? true : action === 'reactivate' ? false : previousData.isDeleted ?? false,
    };

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'dealer_status.updated',
      entityType: 'dealer',
      entityId: dealerId,
      target: {
        uid:
          typeof previousData.ownerUid === 'string'
            ? previousData.ownerUid
            : typeof previousData.uid === 'string'
              ? previousData.uid
              : null,
        email: typeof previousData.contact_email === 'string' ? previousData.contact_email : null,
      },
      summary: `Ran dealer action "${action}" on dealer ${dealerId}.`,
      before: {
        approved: previousData.approved ?? null,
        status: previousData.status ?? null,
        isActive: previousData.isActive ?? null,
        isDeleted: previousData.isDeleted ?? null,
      },
      after: afterData,
      metadata: {
        action,
        linkedUserIds,
      },
    });

    return json(200, {
      ok: true,
      dealerId,
      action,
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
      return serviceUnavailable('Server-side dealer moderation is not configured.');
    }
    if (message.includes('required') || message.includes('must be one of')) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
