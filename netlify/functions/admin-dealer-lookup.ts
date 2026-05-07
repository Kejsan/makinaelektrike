import type { UserRecord } from 'firebase-admin/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';
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
import { getDealerTeamCapacity, listDealerStaffUsers } from './_lib/dealerAccess';
import { serializeAccessInvite } from './_lib/invites';
import { normalizeUserProfile } from '../../utils/accessControl';

interface AdminDealerLookupBody {
  dealerId?: string;
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

const serializeTimestamp = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if ('toDate' in (value as Record<string, unknown>) && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }

  return null;
};

const getSortTime = (value: unknown) => {
  const serialized = serializeTimestamp(value);
  return serialized ? Date.parse(serialized) : 0;
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

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    await requireAdminPermission(event, 'dealers.read');
    const body = event.body ? (JSON.parse(event.body) as AdminDealerLookupBody) : {};
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const firestore = getAdminFirestore();
    const dealerSnapshot = await firestore.collection('dealers').doc(dealerId).get();

    if (!dealerSnapshot.exists) {
      return json(404, { error: 'Dealer not found.' });
    }

    const dealerData = (dealerSnapshot.data() ?? {}) as Record<string, unknown>;
    const ownerUid =
      typeof dealerData.ownerUid === 'string'
        ? dealerData.ownerUid
        : typeof dealerData.uid === 'string'
          ? dealerData.uid
          : null;

    const [ownerSnapshot, ownerAuthRecord, listingSnapshot, enquirySnapshot, dealerModelsSnapshot, staffMembers, capacity, inviteSnapshot] =
      await Promise.all([
        ownerUid ? firestore.collection('users').doc(ownerUid).get() : Promise.resolve(null),
        ownerUid ? getOwnerAuthRecord(ownerUid) : Promise.resolve(null),
        firestore.collection('listings').where('dealerId', '==', dealerId).get(),
        firestore.collection('enquiries').where('dealerId', '==', dealerId).get(),
        firestore.collection('dealerModels').where('dealer_id', '==', dealerId).get(),
        listDealerStaffUsers(dealerId),
        getDealerTeamCapacity(dealerId, dealerData),
        firestore
          .collection('accessInvites')
          .where('type', '==', 'dealer_staff')
          .where('dealerId', '==', dealerId)
          .get(),
      ]);

    const ownerProfile =
      ownerUid && ownerSnapshot?.exists
        ? normalizeUserProfile(
            { uid: ownerUid, email: ownerAuthRecord?.email ?? (typeof ownerSnapshot.data()?.email === 'string' ? (ownerSnapshot.data()?.email as string) : null) },
            (ownerSnapshot.data() ?? {}) as Record<string, unknown>,
          )
        : null;

    const invites = inviteSnapshot.docs
      .sort(
        (left, right) =>
          getSortTime((right.data() as DocumentData).createdAt) - getSortTime((left.data() as DocumentData).createdAt),
      )
      .slice(0, 50)
      .map(doc => serializeAccessInvite(doc.id, (doc.data() ?? {}) as Record<string, unknown>, event));

    return json(200, {
      ok: true,
      dealer: {
        dealer: {
          id: dealerId,
          name:
            typeof dealerData.name === 'string'
              ? dealerData.name
              : typeof dealerData.companyName === 'string'
                ? dealerData.companyName
                : dealerId,
          status: typeof dealerData.status === 'string' ? dealerData.status : null,
          isActive: dealerData.isActive !== false,
          isDeleted: dealerData.isDeleted === true || dealerData.status === 'deleted',
          planId: typeof dealerData.planId === 'string' ? dealerData.planId : null,
          subscriptionStatus:
            typeof dealerData.subscriptionStatus === 'string' ? dealerData.subscriptionStatus : null,
          ownerUid,
          ownerEmail:
            ownerProfile?.email ??
            (typeof dealerData.email === 'string'
              ? dealerData.email
              : typeof dealerData.contact_email === 'string'
                ? dealerData.contact_email
                : null),
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
          city: typeof dealerData.city === 'string' ? dealerData.city : null,
          address: typeof dealerData.address === 'string' ? dealerData.address : null,
          createdAt: serializeTimestamp(dealerData.createdAt),
          updatedAt: serializeTimestamp(dealerData.updatedAt),
        },
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
          listingCounts: buildListingCounts(listingSnapshot.docs),
          modelCount: dealerModelsSnapshot.size,
          enquiryCount: enquirySnapshot.size,
        },
        capacity,
        staffMembers: staffMembers.map(staffMember => ({
          ...staffMember,
          createdAt: serializeTimestamp(staffMember.createdAt),
          updatedAt: serializeTimestamp(staffMember.updatedAt),
        })),
        invites,
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
      return serviceUnavailable('Server-side dealer control lookups are not configured.');
    }
    if (message.includes('required')) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
