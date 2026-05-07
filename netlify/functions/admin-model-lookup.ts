import type { UserRecord } from 'firebase-admin/auth';
import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-admin/firestore';
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
import { hasPermission, normalizeUserProfile } from '../../utils/accessControl';

interface AdminModelLookupBody {
  modelId?: string;
}

interface ListingCounts {
  total: number;
  pending: number;
  approved: number;
  active: number;
  inactive: number;
  rejected: number;
  deleted: number;
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

const getStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];

const getSortTime = (value: unknown) => {
  const serialized = serializeTimestamp(value);
  return serialized ? Date.parse(serialized) : 0;
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

const buildListingCounts = (listingDocs: QueryDocumentSnapshot[]): ListingCounts => {
  const counts: ListingCounts = {
    total: 0,
    pending: 0,
    approved: 0,
    active: 0,
    inactive: 0,
    rejected: 0,
    deleted: 0,
  };

  listingDocs.forEach(doc => {
    const status = String((doc.data() as DocumentData).status ?? '');
    counts.total += 1;
    if (status === 'pending') counts.pending += 1;
    if (status === 'approved') counts.approved += 1;
    if (status === 'active') counts.active += 1;
    if (status === 'inactive') counts.inactive += 1;
    if (status === 'rejected') counts.rejected += 1;
    if (status === 'deleted') counts.deleted += 1;
  });

  return counts;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const canReadModels =
      hasPermission(profile, 'models.read') ||
      hasPermission(profile, 'models.publish') ||
      hasPermission(profile, 'models.merge');

    if (!canReadModels) {
      throw new Error('Missing required permission: models.read.');
    }

    const body = event.body ? (JSON.parse(event.body) as AdminModelLookupBody) : {};
    const modelId = getRequiredString(body.modelId, 'modelId', 128);
    const firestore = getAdminFirestore();
    const modelSnapshot = await firestore.collection('models').doc(modelId).get();

    if (!modelSnapshot.exists) {
      return json(404, { error: 'Model not found.' });
    }

    const modelData = (modelSnapshot.data() ?? {}) as DocumentData;
    const ownerDealerId = typeof modelData.ownerDealerId === 'string' ? modelData.ownerDealerId : null;

    const [
      ownerDealerSnapshot,
      dealerModelsSnapshot,
      listingSnapshot,
      adminNotes,
      recentAuditLogs,
    ] = await Promise.all([
      ownerDealerId
        ? firestore.collection('dealers').doc(ownerDealerId).get()
        : Promise.resolve<DocumentSnapshot | null>(null),
      firestore.collection('dealerModels').where('model_id', '==', modelId).get(),
      firestore.collection('listings').where('modelId', '==', modelId).get(),
      listAdminEntityNotes({ entityType: 'model', entityId: modelId, limit: 12 }),
      listRecentAdminAuditLogsForEntity({ entityType: 'model', entityId: modelId, limit: 10 }),
    ]);

    const ownerDealerData = (ownerDealerSnapshot?.data() ?? {}) as DocumentData;
    const ownerUid =
      typeof modelData.ownerUid === 'string'
        ? modelData.ownerUid
        : typeof ownerDealerData.ownerUid === 'string'
          ? ownerDealerData.ownerUid
          : null;

    const [ownerSnapshot, ownerAuthRecord] = await Promise.all([
      ownerUid ? firestore.collection('users').doc(ownerUid).get() : Promise.resolve<DocumentSnapshot | null>(null),
      ownerUid ? getOwnerAuthRecord(ownerUid) : Promise.resolve<UserRecord | null>(null),
    ]);

    const ownerProfile =
      ownerUid && ownerSnapshot?.exists
        ? normalizeUserProfile(
            {
              uid: ownerUid,
              email:
                ownerAuthRecord?.email ??
                (typeof ownerSnapshot.data()?.email === 'string'
                  ? (ownerSnapshot.data()?.email as string)
                  : null),
            },
            (ownerSnapshot.data() ?? {}) as Record<string, unknown>,
          )
        : null;

    const linkedDealerIds = Array.from(
      new Set(
        dealerModelsSnapshot.docs
          .map(doc => (doc.data() as DocumentData).dealer_id)
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
      ),
    );

    const linkedDealerSnapshots =
      linkedDealerIds.length > 0
        ? await Promise.all(linkedDealerIds.map(dealerId => firestore.collection('dealers').doc(dealerId).get()))
        : [];

    const linkedDealers = linkedDealerSnapshots
      .filter(snapshot => snapshot.exists)
      .map(snapshot => {
        const dealerData = (snapshot.data() ?? {}) as DocumentData;
        return {
          id: snapshot.id,
          name:
            typeof dealerData.name === 'string'
              ? dealerData.name
              : typeof dealerData.companyName === 'string'
                ? dealerData.companyName
                : snapshot.id,
          status: typeof dealerData.status === 'string' ? dealerData.status : null,
          isActive: dealerData.isActive !== false,
          isDeleted: dealerData.isDeleted === true || dealerData.status === 'deleted',
          planId: typeof dealerData.planId === 'string' ? dealerData.planId : null,
        };
      });

    const activeDealerCount = linkedDealers.filter(
      dealer => dealer.isDeleted !== true && dealer.isActive !== false && dealer.status !== 'rejected',
    ).length;

    const recentDealers = linkedDealers
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 8);

    const recentListings = listingSnapshot.docs
      .map(doc => ({ id: doc.id, data: doc.data() as DocumentData }))
      .sort(
        (left, right) =>
          getSortTime(right.data.updatedAt ?? right.data.createdAt) -
          getSortTime(left.data.updatedAt ?? left.data.createdAt),
      )
      .slice(0, 8)
      .map(entry => ({
        id: entry.id,
        title: getListingTitle(entry.data, entry.id),
        status: typeof entry.data.status === 'string' ? entry.data.status : null,
        dealerId: typeof entry.data.dealerId === 'string' ? entry.data.dealerId : null,
        dealerName:
          linkedDealers.find(dealer => dealer.id === entry.data.dealerId)?.name ?? null,
        ownerUid: typeof entry.data.ownerUid === 'string' ? entry.data.ownerUid : null,
        price:
          typeof entry.data.price === 'number'
            ? String(entry.data.price)
            : typeof entry.data.price === 'string'
              ? entry.data.price
              : null,
        createdAt: serializeTimestamp(entry.data.createdAt),
        updatedAt: serializeTimestamp(entry.data.updatedAt),
      }));

    const imageGallery = getStringArray(modelData.imageGallery);

    return json(200, {
      ok: true,
      model: {
        model: {
          id: modelId,
          brand: typeof modelData.brand === 'string' ? modelData.brand : null,
          modelName: typeof modelData.model_name === 'string' ? modelData.model_name : null,
          source: typeof modelData.source === 'string' ? modelData.source : null,
          ownerDealerId,
          ownerUid,
          isActive: modelData.isActive !== false,
          isFeatured: modelData.isFeatured === true,
          bodyType: typeof modelData.body_type === 'string' ? modelData.body_type : null,
          rangeWltp: typeof modelData.range_wltp === 'number' ? modelData.range_wltp : null,
          batteryCapacity:
            typeof modelData.battery_capacity === 'number' ? modelData.battery_capacity : null,
          powerKw: typeof modelData.power_kw === 'number' ? modelData.power_kw : null,
          seats: typeof modelData.seats === 'number' ? modelData.seats : null,
          chargePort: typeof modelData.charge_port === 'string' ? modelData.charge_port : null,
          imageCount: (typeof modelData.image_url === 'string' && modelData.image_url.trim() ? 1 : 0),
          galleryCount: imageGallery.length,
          heroImageUrl:
            typeof modelData.image_url === 'string' && modelData.image_url.trim().length > 0
              ? modelData.image_url
              : imageGallery[0] ?? null,
          notes: typeof modelData.notes === 'string' ? modelData.notes : null,
          createdAt: serializeTimestamp(modelData.createdAt),
          updatedAt: serializeTimestamp(modelData.updatedAt),
        },
        ownerDealer: ownerDealerSnapshot?.exists
          ? {
              id: ownerDealerSnapshot.id,
              name:
                typeof ownerDealerData.name === 'string'
                  ? ownerDealerData.name
                  : typeof ownerDealerData.companyName === 'string'
                    ? ownerDealerData.companyName
                    : ownerDealerSnapshot.id,
              status: typeof ownerDealerData.status === 'string' ? ownerDealerData.status : null,
              isActive: ownerDealerData.isActive !== false,
              isDeleted: ownerDealerData.isDeleted === true || ownerDealerData.status === 'deleted',
              planId: typeof ownerDealerData.planId === 'string' ? ownerDealerData.planId : null,
              subscriptionStatus:
                typeof ownerDealerData.subscriptionStatus === 'string'
                  ? ownerDealerData.subscriptionStatus
                  : null,
              ownerUid:
                typeof ownerDealerData.ownerUid === 'string' ? ownerDealerData.ownerUid : null,
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
        relationships: {
          dealerCount: linkedDealers.length,
          activeDealerCount,
          listingCounts: buildListingCounts(listingSnapshot.docs),
          recentDealers,
          recentListings,
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
      return serviceUnavailable('Server-side model control lookups are not configured.');
    }
    if (message.includes('required')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
