import { FieldValue } from 'firebase-admin/firestore';
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
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { requireDealerAccess } from './_lib/dealerAccess';
import { serializeSponsorshipOrder } from './_lib/placements';

interface DealerPlacementOrderUpdateBody {
  dealerId?: string;
  orderId?: string;
  action?: 'cancel';
}

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = event.body ? (JSON.parse(event.body) as DealerPlacementOrderUpdateBody) : {};
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const orderId = getRequiredString(body.orderId, 'orderId', 128);

    if (body.action !== 'cancel') {
      return badRequest('action must be cancel.');
    }

    await requireDealerAccess(profile, dealerId, { requireTeamManagement: true });
    const firestore = getAdminFirestore();
    const orderRef = firestore.collection('sponsorshipOrders').doc(orderId);
    const previousSnapshot = await orderRef.get();

    if (!previousSnapshot.exists) {
      return badRequest('The selected sponsorship order was not found.');
    }

    const previousOrder = serializeSponsorshipOrder(
      previousSnapshot.id,
      (previousSnapshot.data() ?? {}) as DocumentData,
    );

    if (previousOrder.dealerId !== dealerId) {
      return forbidden('This sponsorship order does not belong to the selected dealer account.');
    }
    if (previousOrder.status !== 'draft' && previousOrder.status !== 'quoted') {
      return badRequest('Only draft or quoted sponsorship orders can be cancelled by the dealer.');
    }

    await orderRef.set(
      {
        status: 'cancelled',
        updatedBy: profile.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const savedSnapshot = await orderRef.get();
    const savedOrder = serializeSponsorshipOrder(orderRef.id, (savedSnapshot.data() ?? {}) as DocumentData);

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'sponsorship_order.updated',
      entityType: 'sponsorship_order',
      entityId: orderId,
      summary: `Dealer cancelled sponsorship request ${savedOrder.name}.`,
      before: previousOrder as unknown as Record<string, unknown>,
      after: savedOrder as unknown as Record<string, unknown>,
      metadata: {
        dealerId,
        requestOrigin: 'dealer_dashboard',
        action: 'cancel',
      },
    });

    return json(200, {
      ok: true,
      order: savedOrder,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (
      message.startsWith('Authenticated admin profile was not found') ||
      message.startsWith('You do not have dealer access') ||
      message.includes('does not belong')
    ) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side dealer promotion requests are not configured.');
    }
    if (message.includes('required') || message.includes('not found') || message.includes('can be cancelled')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
