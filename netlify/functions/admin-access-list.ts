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
import { normalizeUserProfile } from '../../utils/accessControl';

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

const compareAdmins = (
  left: ReturnType<typeof normalizeUserProfile> & { updatedAt: string | null },
  right: ReturnType<typeof normalizeUserProfile> & { updatedAt: string | null },
) => {
  if (left.isMasterAdmin !== right.isMasterAdmin) {
    return left.isMasterAdmin ? -1 : 1;
  }

  const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
  const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return (left.email ?? left.uid).localeCompare(right.email ?? right.uid);
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    await requireAdminPermission(event, 'admins.assign_permissions');
    const firestore = getAdminFirestore();
    const [roleSnapshot, typeSnapshot] = await Promise.all([
      firestore.collection('users').where('role', '==', 'admin').get(),
      firestore.collection('users').where('accountType', '==', 'admin').get(),
    ]);

    const docMap = new Map<string, DocumentData>();

    roleSnapshot.docs.forEach(doc => {
      docMap.set(doc.id, doc.data() ?? {});
    });

    typeSnapshot.docs.forEach(doc => {
      if (!docMap.has(doc.id)) {
        docMap.set(doc.id, doc.data() ?? {});
      }
    });

    const admins = Array.from(docMap.entries())
      .map(([uid, rawProfile]) => {
        const profile = normalizeUserProfile(
          {
            uid,
            email: typeof rawProfile.email === 'string' ? rawProfile.email : null,
          },
          rawProfile as Record<string, unknown>,
        );

        if ((profile.adminRoleIds?.length ?? 0) === 0) {
          return null;
        }

        return {
          uid: profile.uid,
          email: profile.email,
          displayName: typeof rawProfile.displayName === 'string' ? rawProfile.displayName : null,
          role: profile.role,
          accountType: profile.accountType ?? null,
          accountStatus: profile.accountStatus ?? null,
          adminRoleIds: profile.adminRoleIds ?? [],
          directPermissions: profile.directPermissions ?? {},
          isMasterAdmin: profile.isMasterAdmin ?? false,
          dealerPlanId: profile.dealerPlanId ?? null,
          dealerSubscriptionStatus: profile.dealerSubscriptionStatus ?? null,
          updatedAt: serializeTimestamp(rawProfile.updatedAt),
        };
      })
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
      .sort(compareAdmins);

    return json(200, {
      ok: true,
      admins,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Missing required permission') || message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side admin roster is not configured.');
    }

    return internalError(message);
  }
};
