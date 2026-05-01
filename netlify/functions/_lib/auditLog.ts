import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin';
import type { AdminRoleId, AuditAction, AuditEntityType, UserProfile } from '../../../types';

interface AuditActor {
  uid: string;
  email?: string | null;
  adminRoleIds?: AdminRoleId[];
}

interface AuditTarget {
  uid?: string | null;
  email?: string | null;
}

interface WriteAdminAuditLogInput {
  actor: AuditActor;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  target?: AuditTarget;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

const sanitizeAuditValue = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeAuditValue(item))
      .filter(item => item !== undefined);
  }

  if (typeof value === 'object') {
    if ('toDate' in (value as Record<string, unknown>) && typeof (value as { toDate?: unknown }).toDate === 'function') {
      try {
        const dateValue = (value as { toDate: () => Date }).toDate();
        return dateValue.toISOString();
      } catch {
        return undefined;
      }
    }

    const sanitizedEntries = Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, entryValue]) => {
        const sanitizedValue = sanitizeAuditValue(entryValue);
        if (sanitizedValue !== undefined) {
          acc[key] = sanitizedValue;
        }
        return acc;
      },
      {},
    );

    return Object.keys(sanitizedEntries).length > 0 ? sanitizedEntries : undefined;
  }

  return String(value);
};

const sanitizeAuditRecord = (value: Record<string, unknown> | null | undefined) => {
  if (!value) {
    return null;
  }

  const sanitized = sanitizeAuditValue(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return null;
  }

  return sanitized as Record<string, unknown>;
};

export const writeAdminAuditLog = async ({
  actor,
  action,
  entityType,
  entityId,
  summary,
  target,
  before,
  after,
  metadata,
}: WriteAdminAuditLogInput) => {
  await getAdminFirestore().collection('adminAuditLogs').add({
    action,
    entityType,
    entityId,
    actorUid: actor.uid,
    actorEmail: actor.email ?? null,
    actorAdminRoleIds: actor.adminRoleIds ?? [],
    targetUid: target?.uid ?? null,
    targetEmail: target?.email ?? null,
    summary,
    before: sanitizeAuditRecord(before),
    after: sanitizeAuditRecord(after),
    metadata: sanitizeAuditRecord(metadata),
    createdAt: FieldValue.serverTimestamp(),
  });
};

export const buildAuditActor = (profile: UserProfile): AuditActor => ({
  uid: profile.uid,
  email: profile.email,
  adminRoleIds: profile.adminRoleIds ?? [],
});
