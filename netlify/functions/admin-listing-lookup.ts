import type { UserRecord } from 'firebase-admin/auth';
import type { DocumentData, DocumentSnapshot } from 'firebase-admin/firestore';
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
import { getAdminAuth, getAdminFirestore } from './_lib/firebaseAdmin';
import {
  listAdminEntityNotes,
  listRecentAdminAuditLogsForEntity,
  serializeTimestamp,
} from './_lib/adminEntityDetails';
import { hasPermission } from '../../utils/accessControl';
import { normalizeUserProfile } from '../../utils/accessControl';

interface AdminListingLookupBody {
  listingId?: string;
}

const isAuthUserNotFoundError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'auth/user-not-found';

const getOwnerAuthRecord = async (uid: string): Promise<UserRecord | null> => {
  try {
    return await getAdminAuth().getUser(uid);
  } catch (error) {
    if (isAuthUserNotFoundError(error)) {
      return null;
    }
    throw error;
  }
};

const getListingTitle = (data: DocumentData, fallbackId: string) => {
  if (typeof data.title === 'string' && data.title.trim()) {
    return data.title;
  }

  const brand = typeof data.make === 'string' ? data.make.trim() : '';
  const model = typeof data.model === 'string' ? data.model.trim() : '';
  const variant = typeof data.variant === 'string' ? data.variant.trim() : '';
  const fallback = [brand, model, variant].filter(Boolean).join(' ');

  return fallback || fallbackId;
};

const getStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : [];

const getListingModelProfileSnapshot = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const modelId = typeof record.modelId === 'string' ? record.modelId : null;
  if (!modelId) {
    return null;
  }

  return {
    modelId,
    brand: typeof record.brand === 'string' ? record.brand : null,
    modelName: typeof record.modelName === 'string' ? record.modelName : null,
    bodyType: typeof record.bodyType === 'string' ? record.bodyType : null,
    batteryCapacity: typeof record.batteryCapacity === 'number' ? record.batteryCapacity : null,
    rangeWltp: typeof record.rangeWltp === 'number' ? record.rangeWltp : null,
    capturedAt: typeof record.capturedAt === 'string' ? record.capturedAt : '',
  };
};

const getLocationField = (location: unknown, field: 'address' | 'city') => {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return null;
  }

  const value = (location as Record<string, unknown>)[field];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const canReadListings =
      hasPermission(profile, 'listings.read') ||
      hasPermission(profile, 'listings.moderate') ||
      hasPermission(profile, 'listings.reassign');

    if (!canReadListings) {
      throw new Error('Missing required permission: listings.read.');
    }
    const body = event.body ? (JSON.parse(event.body) as AdminListingLookupBody) : {};
    const listingId = getRequiredString(body.listingId, 'listingId', 128);
    const firestore = getAdminFirestore();
    const listingSnapshot = await firestore.collection('listings').doc(listingId).get();

    if (!listingSnapshot.exists) {
      return json(404, { error: 'Listing not found.' });
    }

    const listingData = (listingSnapshot.data() ?? {}) as DocumentData;
    const dealerId = typeof listingData.dealerId === 'string' ? listingData.dealerId : null;
    const ownerUid = typeof listingData.ownerUid === 'string' ? listingData.ownerUid : null;
    const modelId = typeof listingData.modelId === 'string' ? listingData.modelId : null;

    const [
      dealerSnapshot,
      ownerSnapshot,
      ownerAuthRecord,
      modelSnapshot,
      enquirySnapshot,
      adminNotes,
      recentAuditLogs,
    ] = await Promise.all([
      dealerId ? firestore.collection('dealers').doc(dealerId).get() : Promise.resolve(null),
      ownerUid ? firestore.collection('users').doc(ownerUid).get() : Promise.resolve<DocumentSnapshot | null>(null),
      ownerUid ? getOwnerAuthRecord(ownerUid) : Promise.resolve<UserRecord | null>(null),
      modelId ? firestore.collection('models').doc(modelId).get() : Promise.resolve<DocumentSnapshot | null>(null),
      firestore.collection('enquiries').where('listingId', '==', listingId).get(),
      listAdminEntityNotes({ entityType: 'listing', entityId: listingId, limit: 12 }),
      listRecentAdminAuditLogsForEntity({ entityType: 'listing', entityId: listingId, limit: 10 }),
    ]);

    const ownerProfile =
      ownerUid && ownerSnapshot?.exists
        ? normalizeUserProfile(
            {
              uid: ownerUid,
              email:
                ownerAuthRecord?.email ??
                (typeof ownerSnapshot.data()?.email === 'string' ? (ownerSnapshot.data()?.email as string) : null),
            },
            (ownerSnapshot.data() ?? {}) as Record<string, unknown>,
          )
        : null;

    const dealerData = (dealerSnapshot?.data() ?? {}) as DocumentData;
    const modelData = (modelSnapshot?.data() ?? {}) as DocumentData;
    const imageUrls = getStringArray(listingData.images);
    const galleryUrls = getStringArray(listingData.imageGallery);
    const enquiryCounts = enquirySnapshot.docs.reduce(
      (counts, doc) => {
        const status = typeof doc.data().status === 'string' ? doc.data().status : 'new';
        counts.total += 1;
        if (status === 'new') counts.new += 1;
        if (status === 'read') counts.read += 1;
        if (status === 'replied') counts.replied += 1;
        if (status === 'archived') counts.archived += 1;
        return counts;
      },
      { total: 0, new: 0, read: 0, replied: 0, archived: 0 },
    );

    return json(200, {
      ok: true,
      listing: {
        listing: {
          id: listingId,
          title: getListingTitle(listingData, listingId),
          status: typeof listingData.status === 'string' ? listingData.status : null,
          dealerId,
          ownerUid,
          modelId,
          make: typeof listingData.make === 'string' ? listingData.make : null,
          model: typeof listingData.model === 'string' ? listingData.model : null,
          year: typeof listingData.year === 'number' ? listingData.year : null,
          mileage: typeof listingData.mileage === 'number' ? listingData.mileage : null,
          bodyType: typeof listingData.bodyType === 'string' ? listingData.bodyType : null,
          fuelType: typeof listingData.fuelType === 'string' ? listingData.fuelType : null,
          batteryCapacity:
            typeof listingData.batteryCapacity === 'number' ? listingData.batteryCapacity : null,
          range: typeof listingData.range === 'number' ? listingData.range : null,
          modelProfileChangeReason:
            typeof listingData.modelProfileChangeReason === 'string'
              ? listingData.modelProfileChangeReason
              : null,
          modelProfileChangeNotes:
            typeof listingData.modelProfileChangeNotes === 'string'
              ? listingData.modelProfileChangeNotes
              : null,
          modelProfileChangeFields: getStringArray(listingData.modelProfileChangeFields),
          modelProfileSnapshot: getListingModelProfileSnapshot(listingData.modelProfileSnapshot),
          price: typeof listingData.price === 'number' ? listingData.price : null,
          priceCurrency:
            typeof listingData.priceCurrency === 'string' ? listingData.priceCurrency : null,
          locationAddress: getLocationField(listingData.location, 'address'),
          locationCity: getLocationField(listingData.location, 'city'),
          imageCount: imageUrls.length,
          galleryCount: galleryUrls.length,
          primaryImageUrl: imageUrls[0] ?? galleryUrls[0] ?? null,
          videoUrl: typeof listingData.videoUrl === 'string' ? listingData.videoUrl : null,
          isFeatured: listingData.isFeatured === true,
          isForRent: listingData.isForRent === true,
          isForSubscription: listingData.isForSubscription === true,
          rejectionReason:
            typeof listingData.rejectionReason === 'string' ? listingData.rejectionReason : null,
          approvedAt: serializeTimestamp(listingData.approvedAt),
          rejectedAt: serializeTimestamp(listingData.rejectedAt),
          createdAt: serializeTimestamp(listingData.createdAt),
          updatedAt: serializeTimestamp(listingData.updatedAt),
        },
        dealer: dealerSnapshot?.exists
          ? {
              id: dealerSnapshot.id,
              name:
                typeof dealerData.name === 'string'
                  ? dealerData.name
                  : typeof dealerData.companyName === 'string'
                    ? dealerData.companyName
                    : dealerSnapshot.id,
              status: typeof dealerData.status === 'string' ? dealerData.status : null,
              isActive: dealerData.isActive !== false,
              isDeleted: dealerData.isDeleted === true || dealerData.status === 'deleted',
              planId: typeof dealerData.planId === 'string' ? dealerData.planId : null,
              subscriptionStatus:
                typeof dealerData.subscriptionStatus === 'string'
                  ? dealerData.subscriptionStatus
                  : null,
              ownerUid: typeof dealerData.ownerUid === 'string' ? dealerData.ownerUid : null,
              contactEmail:
                typeof dealerData.contact_email === 'string'
                  ? dealerData.contact_email
                  : typeof dealerData.email === 'string'
                    ? dealerData.email
                    : null,
              contactPhone:
                typeof dealerData.contact_phone === 'string'
                  ? dealerData.contact_phone
                  : typeof dealerData.phone === 'string'
                    ? dealerData.phone
                    : null,
            }
          : null,
        owner: ownerUid
          ? {
              uid: ownerUid,
              email: ownerProfile?.email ?? ownerAuthRecord?.email ?? null,
              displayName: ownerProfile?.displayName ?? ownerAuthRecord?.displayName ?? null,
              role: ownerProfile?.role ?? 'dealer',
              accountType: ownerProfile?.accountType ?? null,
              accountStatus: ownerProfile?.accountStatus ?? null,
              adminRoleIds: ownerProfile?.adminRoleIds ?? [],
              isMasterAdmin: ownerProfile?.isMasterAdmin ?? false,
              authDisabled: ownerAuthRecord?.disabled ?? false,
              emailVerified: ownerAuthRecord?.emailVerified ?? false,
              createdAt: ownerAuthRecord?.metadata.creationTime ?? null,
              lastSignInAt: ownerAuthRecord?.metadata.lastSignInTime ?? null,
            }
          : null,
        model: modelSnapshot?.exists
          ? {
              id: modelSnapshot.id,
              brand: typeof modelData.brand === 'string' ? modelData.brand : null,
              modelName:
                typeof modelData.model_name === 'string' ? modelData.model_name : null,
              isActive: modelData.isActive !== false,
            }
          : null,
        relationships: {
          enquiryCount: enquiryCounts.total,
          newEnquiryCount: enquiryCounts.new,
          readEnquiryCount: enquiryCounts.read,
          repliedEnquiryCount: enquiryCounts.replied,
          archivedEnquiryCount: enquiryCounts.archived,
        },
        adminNotes,
        recentAuditLogs,
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
      return serviceUnavailable('Server-side listing control lookups are not configured.');
    }
    if (message.includes('required')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
