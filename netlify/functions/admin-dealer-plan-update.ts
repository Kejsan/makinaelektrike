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
import type { DealerPlanId, DealerSubscriptionStatus } from '../../types';

interface DealerPlanUpdateBody {
  dealerId?: string;
  planId?: DealerPlanId;
  subscriptionStatus?: DealerSubscriptionStatus;
}

const DEALER_PLAN_IDS = ['free', 'paid'] as const satisfies readonly DealerPlanId[];
const DEALER_SUBSCRIPTION_STATUSES = [
  'active',
  'paused',
  'expired',
  'cancelled',
] as const satisfies readonly DealerSubscriptionStatus[];

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'dealer_plans.assign');
    const body = event.body ? (JSON.parse(event.body) as DealerPlanUpdateBody) : {};
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const planId = getEnumValue(body.planId, DEALER_PLAN_IDS, 'planId');
    const subscriptionStatus = body.subscriptionStatus
      ? getEnumValue(body.subscriptionStatus, DEALER_SUBSCRIPTION_STATUSES, 'subscriptionStatus')
      : 'active';

    const firestore = getAdminFirestore();
    const dealerRef = firestore.collection('dealers').doc(dealerId);
    const dealerSnapshot = await dealerRef.get();

    if (!dealerSnapshot.exists) {
      return json(404, { error: 'Dealer not found.' });
    }

    const dealerData = dealerSnapshot.data() as Record<string, unknown>;
    const previousPlanId =
      typeof dealerData.planId === 'string' ? (dealerData.planId as DealerPlanId) : 'free';
    const previousSubscriptionStatus =
      typeof dealerData.subscriptionStatus === 'string'
        ? (dealerData.subscriptionStatus as DealerSubscriptionStatus)
        : 'active';
    const candidateUserIds = Array.from(
      new Set(
        [dealerData.ownerUid, dealerData.uid, dealerId].filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        ),
      ),
    );

    await dealerRef.update({
      planId,
      subscriptionStatus,
      updatedBy: profile.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await Promise.all(
      candidateUserIds.map(async userId => {
        const userRef = firestore.collection('users').doc(userId);
        const snapshot = await userRef.get();
        if (!snapshot.exists) {
          return;
        }

        await userRef.update({
          dealerPlanId: planId,
          dealerSubscriptionStatus: subscriptionStatus,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }),
    );

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'dealer_plan.updated',
      entityType: 'dealer',
      entityId: dealerId,
      target: {
        uid:
          typeof dealerData.ownerUid === 'string'
            ? dealerData.ownerUid
            : typeof dealerData.uid === 'string'
              ? dealerData.uid
              : null,
      },
      summary: `Updated dealer plan from ${previousPlanId}/${previousSubscriptionStatus} to ${planId}/${subscriptionStatus}.`,
      before: {
        planId: previousPlanId,
        subscriptionStatus: previousSubscriptionStatus,
      },
      after: {
        planId,
        subscriptionStatus,
      },
      metadata: {
        candidateUserIds,
        dealerStatus: typeof dealerData.status === 'string' ? dealerData.status : null,
      },
    });

    return json(200, {
      ok: true,
      dealerId,
      planId,
      subscriptionStatus,
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
      return serviceUnavailable('Server-side admin updates are not configured.');
    }
    if (message.includes('required') || message.includes('must be one of')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
