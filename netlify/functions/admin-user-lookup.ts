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
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminAuth, getAdminFirestore } from './_lib/firebaseAdmin';
import {
  listAdminEntityNotes,
  listRecentAdminAuditLogsForEntity,
  serializeTimestamp,
} from './_lib/adminEntityDetails';
import { normalizeUserProfile } from '../../utils/accessControl';

interface UserLookupBody {
  query?: string;
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

const getAuthRecordByQuery = async (rawQuery: string): Promise<UserRecord | null> => {
  const adminAuth = getAdminAuth();

  if (rawQuery.includes('@')) {
    const email = rawQuery.trim().toLowerCase();
    try {
      return await adminAuth.getUserByEmail(email);
    } catch (error) {
      if (isAuthUserNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  try {
    return await adminAuth.getUser(rawQuery.trim());
  } catch (error) {
    if (isAuthUserNotFoundError(error)) {
      return null;
    }
    throw error;
  }
};

const getFirestoreUserByQuery = async (rawQuery: string): Promise<DocumentSnapshot | null> => {
  const firestore = getAdminFirestore();

  if (rawQuery.includes('@')) {
    const candidates = Array.from(new Set([rawQuery.trim(), rawQuery.trim().toLowerCase()]));
    for (const email of candidates) {
      const querySnapshot = await firestore
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0] ?? null;
      }
    }
    return null;
  }

  const snapshot = await firestore.collection('users').doc(rawQuery.trim()).get();
  return snapshot.exists ? snapshot : null;
};

const dedupeDocSnapshots = (docs: Array<QueryDocumentSnapshot | DocumentSnapshot>) => {
  const entries = new Map<string, QueryDocumentSnapshot | DocumentSnapshot>();
  docs.forEach(doc => {
    if (doc.exists) {
      entries.set(doc.id, doc);
    }
  });
  return Array.from(entries.values());
};

const buildListingCounts = (listingDocs: Array<QueryDocumentSnapshot | DocumentSnapshot>): ListingCounts => {
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
    if (!doc.exists) {
      return;
    }

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

const getListingSortTime = (doc: QueryDocumentSnapshot | DocumentSnapshot) => {
  const data = (doc.data() ?? {}) as DocumentData;
  const updatedAt = serializeTimestamp(data.updatedAt);
  const createdAt = serializeTimestamp(data.createdAt);
  const parsed = Date.parse(updatedAt ?? createdAt ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildListingTitle = (doc: QueryDocumentSnapshot | DocumentSnapshot) => {
  const data = (doc.data() ?? {}) as DocumentData;

  if (typeof data.title === 'string' && data.title.trim()) {
    return data.title;
  }

  const brand = typeof data.brand === 'string' ? data.brand.trim() : '';
  const model = typeof data.model === 'string' ? data.model.trim() : '';
  const variant = typeof data.variant === 'string' ? data.variant.trim() : '';
  const fallback = [brand, model, variant].filter(Boolean).join(' ');

  return fallback || doc.id;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    await requireAdminPermission(event, 'users.read');
    const body = event.body ? (JSON.parse(event.body) as UserLookupBody) : {};
    const rawQuery = getRequiredString(body.query, 'query', 254);
    const authRecord = await getAuthRecordByQuery(rawQuery);
    const firestore = getAdminFirestore();
    const firestoreDoc = authRecord
      ? await firestore.collection('users').doc(authRecord.uid).get()
      : await getFirestoreUserByQuery(rawQuery);

    if (!authRecord && !firestoreDoc) {
      return json(404, { error: 'User account not found.' });
    }

    const uid = authRecord?.uid ?? firestoreDoc!.id;
    const email =
      authRecord?.email ??
      (typeof firestoreDoc?.data()?.email === 'string' ? (firestoreDoc.data()!.email as string) : null);
    const rawProfileData = (firestoreDoc?.data() ?? {}) as Record<string, unknown>;
    const profile = normalizeUserProfile({ uid, email }, rawProfileData);
    const dealerStaffRole =
      typeof rawProfileData.dealerStaffRole === 'string' ? rawProfileData.dealerStaffRole : null;

    const dealerSnapshots = await firestore.collection('dealers').where('ownerUid', '==', uid).get();
    const scopedDealerId =
      typeof rawProfileData.dealerId === 'string' && rawProfileData.dealerId.trim()
        ? rawProfileData.dealerId.trim()
        : null;
    const dealerDocs = dedupeDocSnapshots([
      ...dealerSnapshots.docs,
      await firestore.collection('dealers').doc(uid).get(),
      ...(scopedDealerId ? [await firestore.collection('dealers').doc(scopedDealerId).get()] : []),
    ]);
    const linkedDealers = dealerDocs.map(doc => {
      const data = doc.data() as DocumentData;
      return {
        id: doc.id,
        name: String(data.name ?? data.companyName ?? doc.id),
        status: typeof data.status === 'string' ? data.status : null,
        isActive: data.isActive !== false,
        isDeleted: data.isDeleted === true,
        planId: typeof data.planId === 'string' ? data.planId : null,
        subscriptionStatus: typeof data.subscriptionStatus === 'string' ? data.subscriptionStatus : null,
        isOwner: typeof data.ownerUid === 'string' ? data.ownerUid === uid : doc.id === uid,
        staffRole: scopedDealerId === doc.id ? dealerStaffRole : null,
      };
    });
    const linkedDealerIds = linkedDealers.map(dealer => dealer.id);

    const listingDocs = dedupeDocSnapshots([
      ...(await firestore.collection('listings').where('ownerUid', '==', uid).get()).docs,
      ...(
        await Promise.all(
          linkedDealerIds.map(dealerId => firestore.collection('listings').where('dealerId', '==', dealerId).get()),
        )
      ).flatMap(snapshot => snapshot.docs),
    ]);
    const listingCounts = buildListingCounts(listingDocs);

    const recentListingDocs = listingDocs
      .filter(doc => doc.exists)
      .sort((left, right) => getListingSortTime(right) - getListingSortTime(left))
      .slice(0, 8);
    const dealerNameById = new Map(linkedDealers.map(dealer => [dealer.id, dealer.name]));
    const missingDealerIds = Array.from(
      new Set(
        recentListingDocs
          .map(doc => {
            const data = (doc.data() ?? {}) as DocumentData;
            return typeof data.dealerId === 'string' ? data.dealerId : null;
          })
          .filter((dealerId): dealerId is string => Boolean(dealerId && !dealerNameById.has(dealerId))),
      ),
    );

    if (missingDealerIds.length > 0) {
      const missingDealerSnapshots = await Promise.all(
        missingDealerIds.map(dealerId => firestore.collection('dealers').doc(dealerId).get()),
      );
      missingDealerSnapshots.forEach(snapshot => {
        if (!snapshot.exists) {
          return;
        }
        const data = snapshot.data() as DocumentData;
        dealerNameById.set(
          snapshot.id,
          typeof data.name === 'string'
            ? data.name
            : typeof data.companyName === 'string'
              ? data.companyName
              : snapshot.id,
        );
      });
    }

    const [modelSnapshot, enquirySnapshots, favouriteSnapshot, adminNotes, recentAuditLogs] = await Promise.all([
      firestore.collection('models').where('ownerUid', '==', uid).get(),
      Promise.all(
        linkedDealerIds.map(dealerId => firestore.collection('enquiries').where('dealerId', '==', dealerId).get()),
      ),
      firestore.collection('users').doc(uid).collection('favourites').get(),
      listAdminEntityNotes({ entityType: 'user', entityId: uid, limit: 12 }),
      listRecentAdminAuditLogsForEntity({ entityType: 'user', entityId: uid, targetUid: uid, limit: 10 }),
    ]);

    const modelCount = modelSnapshot.size;
    const enquiryCount = enquirySnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0);
    const favouriteCount = favouriteSnapshot.size;
    const recentListings = recentListingDocs.map(doc => {
      const data = (doc.data() ?? {}) as DocumentData;
      const dealerId = typeof data.dealerId === 'string' ? data.dealerId : null;
      return {
        id: doc.id,
        title: buildListingTitle(doc),
        status: typeof data.status === 'string' ? data.status : null,
        dealerId,
        dealerName: dealerId ? dealerNameById.get(dealerId) ?? null : null,
        ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : null,
        price: typeof data.price === 'string' ? data.price : null,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
      };
    });

    return json(200, {
      ok: true,
      user: {
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName ?? authRecord?.displayName ?? null,
        role: profile.role,
        accountType: profile.accountType ?? null,
        accountStatus: profile.accountStatus ?? null,
        adminRoleIds: profile.adminRoleIds ?? [],
        directPermissions: profile.directPermissions ?? {},
        isMasterAdmin: profile.isMasterAdmin ?? false,
        dealerPlanId: profile.dealerPlanId ?? null,
        dealerSubscriptionStatus: profile.dealerSubscriptionStatus ?? null,
        authDisabled: authRecord?.disabled ?? false,
        emailVerified: authRecord?.emailVerified ?? false,
        createdAt: authRecord?.metadata.creationTime ?? null,
        lastSignInAt: authRecord?.metadata.lastSignInTime ?? null,
        relationships: {
          linkedDealers,
          listingCounts,
          recentListings,
          modelCount,
          favouriteCount,
          enquiryCount,
          hasDealerAccount:
            profile.accountType === 'dealer' ||
            profile.accountType === 'dealer_staff' ||
            profile.role === 'dealer' ||
            profile.role === 'pending' ||
            linkedDealers.length > 0,
          isPlatformAdmin: (profile.adminRoleIds?.length ?? 0) > 0,
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
      return serviceUnavailable('Server-side user lookups are not configured.');
    }
    if (message.includes('required')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
