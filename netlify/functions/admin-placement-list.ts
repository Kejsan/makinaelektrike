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
import { buildPlacementZoneAvailability } from './_lib/placementOrders';
import {
  serializePlacementZone,
  serializePromotionalCampaign,
  serializeSponsorshipOrder,
  serializeSponsorshipProduct,
} from './_lib/placements';

const sortByUpdatedAt = <T extends { updatedAt?: unknown; createdAt?: unknown }>(items: T[]) =>
  items.sort((left, right) => {
    const leftTime = Date.parse(String(left.updatedAt ?? left.createdAt ?? '')) || 0;
    const rightTime = Date.parse(String(right.updatedAt ?? right.createdAt ?? '')) || 0;
    return rightTime - leftTime;
  });

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    await requireAdminPermission(event, 'placements.read');
    const firestore = getAdminFirestore();
    const [zoneSnapshot, productSnapshot, campaignSnapshot, orderSnapshot] = await Promise.all([
      firestore.collection('placementZones').get(),
      firestore.collection('sponsorshipProducts').get(),
      firestore.collection('promotionalCampaigns').get(),
      firestore.collection('sponsorshipOrders').get(),
    ]);

    const zones = sortByUpdatedAt(
      zoneSnapshot.docs.map(doc => serializePlacementZone(doc.id, doc.data() as DocumentData)),
    );
    const products = sortByUpdatedAt(
      productSnapshot.docs.map(doc => serializeSponsorshipProduct(doc.id, doc.data() as DocumentData)),
    );
    const campaigns = sortByUpdatedAt(
      campaignSnapshot.docs.map(doc => serializePromotionalCampaign(doc.id, doc.data() as DocumentData)),
    );
    const orders = sortByUpdatedAt(
      orderSnapshot.docs.map(doc => serializeSponsorshipOrder(doc.id, doc.data() as DocumentData)),
    );
    const availability = buildPlacementZoneAvailability({
      zones,
      orders,
    });

    return json(200, {
      ok: true,
      zones,
      products,
      campaigns,
      orders,
      availability,
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
      return serviceUnavailable('Server-side placement management is not configured.');
    }

    return internalError(message);
  }
};
