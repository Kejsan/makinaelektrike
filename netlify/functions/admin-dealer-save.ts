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
import {
  getRequiredRecord,
  hasOwnField,
  parseOptionalBooleanField,
  parseOptionalNumberField,
  parseOptionalStringField,
  parseSocialLinksField,
  parseStringArrayField,
} from './_lib/adminFormPayloads';
import type {
  DealerDocument,
  DealerPlanId,
  DealerStatus,
  DealerSubscriptionStatus,
} from '../../types';

interface DealerSaveBody {
  dealerId?: string;
  values?: Record<string, unknown>;
}

const DEALER_STATUSES = ['pending', 'approved', 'rejected', 'deleted'] as const;
const DEALER_PLAN_IDS = ['free', 'paid'] as const;
const DEALER_SUBSCRIPTION_STATUSES = ['active', 'paused', 'expired', 'cancelled'] as const;

const buildDealerModelDocId = (dealerId: string, modelId: string) => `${dealerId}_${modelId}`;

const parseDealerValues = (value: unknown) => {
  const record = getRequiredRecord(value, 'values');
  const updates: Record<string, unknown> = {};

  const name = parseOptionalStringField(record, 'name', 200);
  if (name !== undefined) updates.name = name;

  const description = parseOptionalStringField(record, 'description', 5000);
  if (description !== undefined) updates.description = description;

  const companyName = parseOptionalStringField(record, 'companyName', 200);
  if (companyName !== undefined) updates.companyName = companyName;

  const contactName = parseOptionalStringField(record, 'contactName', 200);
  if (contactName !== undefined) updates.contactName = contactName;

  const address = parseOptionalStringField(record, 'address', 500);
  if (address !== undefined) updates.address = address;

  const city = parseOptionalStringField(record, 'city', 200);
  if (city !== undefined) updates.city = city;

  const lat = parseOptionalNumberField(record, 'lat');
  if (lat !== undefined) updates.lat = lat;

  const lng = parseOptionalNumberField(record, 'lng');
  if (lng !== undefined) updates.lng = lng;

  const phone = parseOptionalStringField(record, 'phone', 100);
  if (phone !== undefined) updates.phone = phone;

  const email = parseOptionalStringField(record, 'email', 254);
  if (email !== undefined) updates.email = email;

  const contactPhone = parseOptionalStringField(record, 'contact_phone', 100);
  if (contactPhone !== undefined) updates.contact_phone = contactPhone;

  const contactEmail = parseOptionalStringField(record, 'contact_email', 254);
  if (contactEmail !== undefined) updates.contact_email = contactEmail;

  const website = parseOptionalStringField(record, 'website', 1000);
  if (website !== undefined) updates.website = website;

  const socialLinks = parseSocialLinksField(record, 'social_links');
  if (socialLinks !== undefined) updates.social_links = socialLinks;

  const brands = parseStringArrayField(record, 'brands', 100, 120);
  if (brands !== undefined) updates.brands = brands;

  const languages = parseStringArrayField(record, 'languages', 50, 80);
  if (languages !== undefined) updates.languages = languages;

  const notes = parseOptionalStringField(record, 'notes', 5000);
  if (notes !== undefined) updates.notes = notes;

  const typeOfCars = parseOptionalStringField(record, 'typeOfCars', 200);
  if (typeOfCars !== undefined) updates.typeOfCars = typeOfCars;

  const priceRange = parseOptionalStringField(record, 'priceRange', 120);
  if (priceRange !== undefined) updates.priceRange = priceRange;

  const modelsAvailable = parseStringArrayField(record, 'modelsAvailable', 300, 200);
  if (modelsAvailable !== undefined) updates.modelsAvailable = modelsAvailable;

  const imageUrl = parseOptionalStringField(record, 'image_url', 2000);
  if (imageUrl !== undefined) updates.image_url = imageUrl;

  const logoUrl = parseOptionalStringField(record, 'logo_url', 2000, { allowNull: true });
  if (logoUrl !== undefined) updates.logo_url = logoUrl;

  const location = parseOptionalStringField(record, 'location', 500, { allowNull: true });
  if (location !== undefined) updates.location = location;

  const isActive = parseOptionalBooleanField(record, 'isActive');
  if (isActive !== undefined) updates.isActive = isActive;

  const isDeleted = parseOptionalBooleanField(record, 'isDeleted');
  if (isDeleted !== undefined) updates.isDeleted = isDeleted;

  const isFeatured = parseOptionalBooleanField(record, 'isFeatured');
  if (isFeatured !== undefined) updates.isFeatured = isFeatured;

  const imageGallery = parseStringArrayField(record, 'imageGallery', 3, 2000);
  if (imageGallery !== undefined) updates.imageGallery = imageGallery;

  if (hasOwnField(record, 'status') && record.status !== undefined && record.status !== null) {
    updates.status = getEnumValue(record.status, DEALER_STATUSES, 'status') as DealerStatus;
  }

  const approved = parseOptionalBooleanField(record, 'approved');
  if (approved !== undefined) updates.approved = approved;

  if (hasOwnField(record, 'planId') && record.planId !== undefined && record.planId !== null) {
    updates.planId = getEnumValue(record.planId, DEALER_PLAN_IDS, 'planId') as DealerPlanId;
  }

  if (
    hasOwnField(record, 'subscriptionStatus') &&
    record.subscriptionStatus !== undefined &&
    record.subscriptionStatus !== null
  ) {
    updates.subscriptionStatus = getEnumValue(
      record.subscriptionStatus,
      DEALER_SUBSCRIPTION_STATUSES,
      'subscriptionStatus',
    ) as DealerSubscriptionStatus;
  }

  const modelIds = parseStringArrayField(record, 'modelIds', 500, 128);

  return { updates, modelIds };
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'dealers.edit');
    const body = event.body ? (JSON.parse(event.body) as DealerSaveBody) : {};
    const dealerId =
      body.dealerId === undefined ? undefined : getRequiredString(body.dealerId, 'dealerId', 128);
    const isCreate = !dealerId;
    const { updates, modelIds } = parseDealerValues(body.values);

    if (!isCreate && Object.keys(updates).length === 0 && modelIds === undefined) {
      return badRequest('At least one dealer save field is required.');
    }

    const firestore = getAdminFirestore();
    let resolvedDealerId = dealerId ?? null;
    let previousData: Record<string, unknown> = {};

    if (dealerId) {
      const dealerRef = firestore.collection('dealers').doc(dealerId);
      const snapshot = await dealerRef.get();
      if (!snapshot.exists) {
        return json(404, { error: 'Dealer not found.' });
      }
      previousData = (snapshot.data() ?? {}) as Record<string, unknown>;

      const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: profile.uid,
      };

      if (!hasOwnField(updateData, 'contact_email') && typeof updateData.email === 'string') {
        updateData.contact_email = updateData.email;
      }

      if (!hasOwnField(updateData, 'contact_phone') && typeof updateData.phone === 'string') {
        updateData.contact_phone = updateData.phone;
      }

      if (!hasOwnField(updateData, 'logo_url') && typeof updateData.image_url === 'string') {
        updateData.logo_url = updateData.image_url;
      }

      if (typeof updateData.status === 'string' && !hasOwnField(updateData, 'approved')) {
        updateData.approved = updateData.status === 'approved';
      }

      if (updateData.isDeleted === true && !hasOwnField(updateData, 'deletedAt')) {
        updateData.deletedAt = FieldValue.serverTimestamp();
      }

      if (updateData.isDeleted === false) {
        updateData.deletedAt = null;
      }

      await dealerRef.update(updateData);
      resolvedDealerId = dealerId;
    } else {
      const name = typeof updates.name === 'string' ? updates.name : null;
      const address = typeof updates.address === 'string' ? updates.address : null;
      const city = typeof updates.city === 'string' ? updates.city : null;
      const lat = typeof updates.lat === 'number' ? updates.lat : null;
      const lng = typeof updates.lng === 'number' ? updates.lng : null;

      if (!name || !address || !city || lat === null || lng === null) {
        return badRequest('name, address, city, lat, and lng are required to create a dealer.');
      }

      const status = (updates.status as DealerStatus | undefined) ?? 'pending';
      const approved = (updates.approved as boolean | undefined) ?? status === 'approved';
      const isActive =
        (updates.isActive as boolean | undefined) ??
        (status === 'approved' && approved ? true : false);

      const createData: DealerDocument = {
        name,
        address,
        city,
        lat,
        lng,
        brands: (updates.brands as string[] | undefined) ?? [],
        languages: (updates.languages as string[] | undefined) ?? [],
        typeOfCars: (updates.typeOfCars as string | undefined) ?? 'Unknown',
        modelsAvailable: (updates.modelsAvailable as string[] | undefined) ?? [],
        ownerUid: profile.uid,
        createdBy: profile.uid,
        updatedBy: profile.uid,
        approved,
        status,
        isActive,
        planId: (updates.planId as DealerPlanId | undefined) ?? 'free',
        subscriptionStatus:
          (updates.subscriptionStatus as DealerSubscriptionStatus | undefined) ?? 'active',
        isDeleted: (updates.isDeleted as boolean | undefined) ?? false,
        deletedAt: null,
        ...(updates.description !== undefined ? { description: updates.description as string } : {}),
        ...(updates.companyName !== undefined ? { companyName: updates.companyName as string } : {}),
        ...(updates.contactName !== undefined ? { contactName: updates.contactName as string } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone as string } : {}),
        ...(updates.email !== undefined ? { email: updates.email as string } : {}),
        ...(updates.contact_phone !== undefined
          ? { contact_phone: updates.contact_phone as string }
          : updates.phone !== undefined
            ? { contact_phone: updates.phone as string }
            : {}),
        ...(updates.contact_email !== undefined
          ? { contact_email: updates.contact_email as string }
          : updates.email !== undefined
            ? { contact_email: updates.email as string }
            : {}),
        ...(updates.website !== undefined ? { website: updates.website as string } : {}),
        ...(updates.social_links !== undefined
          ? { social_links: updates.social_links as DealerDocument['social_links'] }
          : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes as string } : {}),
        ...(updates.priceRange !== undefined ? { priceRange: updates.priceRange as string } : {}),
        ...(updates.image_url !== undefined ? { image_url: updates.image_url as string } : {}),
        ...(updates.logo_url !== undefined
          ? { logo_url: updates.logo_url as string | null }
          : updates.image_url !== undefined
            ? { logo_url: updates.image_url as string }
            : {}),
        ...(updates.location !== undefined
          ? { location: updates.location as string | null }
          : { location: [address, city].filter(Boolean).join(', ') }),
        ...(updates.isFeatured !== undefined ? { isFeatured: updates.isFeatured as boolean } : {}),
        ...(updates.imageGallery !== undefined
          ? { imageGallery: updates.imageGallery as string[] }
          : {}),
      };

      const dealerRef = firestore.collection('dealers').doc();
      await dealerRef.set({
        ...createData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      resolvedDealerId = dealerRef.id;
    }

    if (!resolvedDealerId) {
      return internalError('Dealer id could not be resolved after save.');
    }

    let addedModelIds: string[] = [];
    let removedModelIds: string[] = [];
    if (modelIds !== undefined) {
      const dealerModelsCollection = firestore.collection('dealerModels');
      const currentLinksSnapshot = await dealerModelsCollection
        .where('dealer_id', '==', resolvedDealerId)
        .get();

      const currentModelIds = new Set(
        currentLinksSnapshot.docs
          .map(doc => doc.data().model_id)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      );
      const desiredModelIds = new Set(modelIds);

      addedModelIds = modelIds.filter(modelId => !currentModelIds.has(modelId));
      removedModelIds = Array.from(currentModelIds).filter(modelId => !desiredModelIds.has(modelId));

      await Promise.all(
        addedModelIds.map(modelId =>
          dealerModelsCollection.doc(buildDealerModelDocId(resolvedDealerId!, modelId)).set({
            dealer_id: resolvedDealerId,
            model_id: modelId,
            createdAt: FieldValue.serverTimestamp(),
            createdBy: profile.uid,
          }),
        ),
      );

      await Promise.all(
        removedModelIds.map(modelId =>
          dealerModelsCollection.doc(buildDealerModelDocId(resolvedDealerId!, modelId)).delete(),
        ),
      );
    }

    const savedSnapshot = await firestore.collection('dealers').doc(resolvedDealerId).get();
    const savedData = (savedSnapshot.data() ?? {}) as Record<string, unknown>;

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'dealer.updated',
      entityType: 'dealer',
      entityId: resolvedDealerId,
      target: {
        uid:
          typeof savedData.ownerUid === 'string'
            ? savedData.ownerUid
            : typeof previousData.ownerUid === 'string'
              ? previousData.ownerUid
              : null,
        email:
          typeof savedData.contact_email === 'string'
            ? savedData.contact_email
            : typeof previousData.contact_email === 'string'
              ? previousData.contact_email
              : null,
      },
      summary: isCreate
        ? `Created dealer ${resolvedDealerId}.`
        : `Updated dealer ${resolvedDealerId}.`,
      before: isCreate
        ? null
        : {
            name: previousData.name ?? null,
            city: previousData.city ?? null,
            status: previousData.status ?? null,
            isActive: previousData.isActive ?? null,
            isFeatured: previousData.isFeatured ?? null,
            planId: previousData.planId ?? null,
            subscriptionStatus: previousData.subscriptionStatus ?? null,
            image_url: previousData.image_url ?? null,
            imageGallery: previousData.imageGallery ?? [],
          },
      after: {
        name: savedData.name ?? null,
        city: savedData.city ?? null,
        status: savedData.status ?? null,
        isActive: savedData.isActive ?? null,
        isFeatured: savedData.isFeatured ?? null,
        planId: savedData.planId ?? null,
        subscriptionStatus: savedData.subscriptionStatus ?? null,
        image_url: savedData.image_url ?? null,
        imageGallery: savedData.imageGallery ?? [],
      },
      metadata: {
        operation: isCreate ? 'create' : 'update',
        modelIdsChanged: modelIds !== undefined,
        addedModelIds,
        removedModelIds,
      },
    });

    return json(200, {
      ok: true,
      dealerId: resolvedDealerId,
      dealer: {
        id: savedSnapshot.id,
        ...(savedData as Record<string, unknown>),
      },
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
      return serviceUnavailable('Server-side dealer saves are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be one of') ||
      message.includes('must be an object') ||
      message.includes('must be a string') ||
      message.includes('must be an array') ||
      message.includes('must be a valid number')
    ) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
