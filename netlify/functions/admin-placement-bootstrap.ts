import { FieldValue } from 'firebase-admin/firestore';
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
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import {
  serializePlacementZone,
  serializeSponsorshipProduct,
} from './_lib/placements';
import {
  DEFAULT_PUBLIC_PLACEMENT_ZONES,
  DEFAULT_SPONSORSHIP_PRODUCTS,
  type PlacementZoneSeedDefinition,
  type SponsorshipProductSeedDefinition,
} from '../../utils/placements';
import type {
  PlacementZone,
  SponsorshipProduct,
} from '../../types';

type BootstrapSummary = {
  created: number;
  updated: number;
  unchanged: number;
};

const normalizeStringArray = (values: string[]) =>
  [...values].sort((left, right) => left.localeCompare(right));

const arraysEqual = (left: string[] | undefined, right: string[] | undefined) => {
  const normalizedLeft = normalizeStringArray(left ?? []);
  const normalizedRight = normalizeStringArray(right ?? []);
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
};

const zoneDefinitionChanged = (
  zone: PlacementZone,
  definition: PlacementZoneSeedDefinition,
) =>
  zone.name !== definition.name ||
  (zone.description ?? null) !== definition.description ||
  zone.pageKey !== definition.pageKey ||
  zone.slotKey !== definition.slotKey ||
  !arraysEqual(zone.allowedEntityTypes, definition.allowedEntityTypes) ||
  zone.allowHousePromotions !== definition.allowHousePromotions ||
  zone.allowSponsoredPromotions !== definition.allowSponsoredPromotions ||
  zone.maxAssignments !== definition.maxAssignments ||
  !arraysEqual(zone.localeTargets, definition.localeTargets) ||
  (zone.status ?? 'inactive') !== definition.status;

const productDefinitionChanged = (
  product: SponsorshipProduct,
  definition: SponsorshipProductSeedDefinition,
) =>
  product.name !== definition.name ||
  (product.description ?? null) !== definition.description ||
  !arraysEqual(product.eligiblePlanIds, definition.eligiblePlanIds) ||
  !arraysEqual(product.eligibleEntityTypes, definition.eligibleEntityTypes) ||
  (product.defaultDurationDays ?? null) !== definition.defaultDurationDays ||
  (product.priceLabel ?? null) !== definition.priceLabel ||
  (product.status ?? 'inactive') !== definition.status;

const seedZone = async (
  definition: PlacementZoneSeedDefinition,
  actorUid: string,
) => {
  const firestore = getAdminFirestore();
  const querySnapshot = await firestore
    .collection('placementZones')
    .where('key', '==', definition.key)
    .limit(1)
    .get();
  const existingDoc = querySnapshot.docs[0] ?? null;

  if (!existingDoc) {
    const docRef = firestore.collection('placementZones').doc();
    const payload = {
      ...definition,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    };
    await docRef.set(payload);
    const createdSnapshot = await docRef.get();
    const createdZone = serializePlacementZone(docRef.id, createdSnapshot.data() ?? {});
    return { outcome: 'created' as const, zone: createdZone, before: null };
  }

  const existingZone = serializePlacementZone(existingDoc.id, existingDoc.data() ?? {});
  if (!zoneDefinitionChanged(existingZone, definition)) {
    return { outcome: 'unchanged' as const, zone: existingZone, before: existingZone };
  }

  const payload = {
    ...definition,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorUid,
  };
  await existingDoc.ref.set(payload, { merge: true });
  const updatedSnapshot = await existingDoc.ref.get();
  const updatedZone = serializePlacementZone(existingDoc.id, updatedSnapshot.data() ?? {});
  return { outcome: 'updated' as const, zone: updatedZone, before: existingZone };
};

const seedProduct = async (
  definition: SponsorshipProductSeedDefinition,
  actorUid: string,
) => {
  const firestore = getAdminFirestore();
  const querySnapshot = await firestore
    .collection('sponsorshipProducts')
    .where('code', '==', definition.code)
    .limit(1)
    .get();
  const existingDoc = querySnapshot.docs[0] ?? null;

  if (!existingDoc) {
    const docRef = firestore.collection('sponsorshipProducts').doc();
    const payload = {
      ...definition,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    };
    await docRef.set(payload);
    const createdSnapshot = await docRef.get();
    const createdProduct = serializeSponsorshipProduct(docRef.id, createdSnapshot.data() ?? {});
    return { outcome: 'created' as const, product: createdProduct, before: null };
  }

  const existingProduct = serializeSponsorshipProduct(existingDoc.id, existingDoc.data() ?? {});
  if (!productDefinitionChanged(existingProduct, definition)) {
    return { outcome: 'unchanged' as const, product: existingProduct, before: existingProduct };
  }

  const payload = {
    ...definition,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorUid,
  };
  await existingDoc.ref.set(payload, { merge: true });
  const updatedSnapshot = await existingDoc.ref.get();
  const updatedProduct = serializeSponsorshipProduct(existingDoc.id, updatedSnapshot.data() ?? {});
  return { outcome: 'updated' as const, product: updatedProduct, before: existingProduct };
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'placements.override');
    const actor = buildAuditActor(profile);
    const zoneSummary: BootstrapSummary = { created: 0, updated: 0, unchanged: 0 };
    const productSummary: BootstrapSummary = { created: 0, updated: 0, unchanged: 0 };

    for (const definition of DEFAULT_PUBLIC_PLACEMENT_ZONES) {
      const result = await seedZone(definition, profile.uid);
      zoneSummary[result.outcome] += 1;

      if (result.outcome !== 'unchanged') {
        await writeAdminAuditLog({
          actor,
          action: 'placement_zone.updated',
          entityType: 'placement_zone',
          entityId: result.zone.id,
          summary: `${result.outcome === 'created' ? 'Bootstrapped' : 'Normalized'} placement zone ${result.zone.name}.`,
          before: result.before as unknown as Record<string, unknown> | null,
          after: result.zone as unknown as Record<string, unknown>,
          metadata: {
            source: 'bootstrap',
            key: result.zone.key,
          },
        });
      }
    }

    for (const definition of DEFAULT_SPONSORSHIP_PRODUCTS) {
      const result = await seedProduct(definition, profile.uid);
      productSummary[result.outcome] += 1;

      if (result.outcome !== 'unchanged') {
        await writeAdminAuditLog({
          actor,
          action: 'sponsorship_product.updated',
          entityType: 'sponsorship_product',
          entityId: result.product.id,
          summary: `${result.outcome === 'created' ? 'Bootstrapped' : 'Normalized'} sponsorship product ${result.product.name}.`,
          before: result.before as unknown as Record<string, unknown> | null,
          after: result.product as unknown as Record<string, unknown>,
          metadata: {
            source: 'bootstrap',
            code: result.product.code,
          },
        });
      }
    }

    return json(200, {
      ok: true,
      zones: zoneSummary,
      products: productSummary,
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
      return serviceUnavailable('Server-side placement bootstrap is not configured.');
    }

    return internalError(message);
  }
};
