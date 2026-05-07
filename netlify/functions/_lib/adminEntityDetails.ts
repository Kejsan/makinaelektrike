import type { DocumentData } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin';
import type { AdminAuditLog, AdminEntityNote, AuditEntityType } from '../../../types';

const AUDIT_SCAN_LIMIT = 200;

export const serializeTimestamp = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }

  return null;
};

const getSortTime = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const buildAdminEntityKey = (entityType: AuditEntityType, entityId: string) =>
  `${entityType}:${entityId}`;

export const serializeAdminAuditLog = (id: string, data: DocumentData): AdminAuditLog => ({
  id,
  action: (typeof data.action === 'string' ? data.action : 'dealer.updated') as AdminAuditLog['action'],
  entityType: (typeof data.entityType === 'string' ? data.entityType : 'dealer') as AdminAuditLog['entityType'],
  entityId: typeof data.entityId === 'string' ? data.entityId : '',
  actorUid: typeof data.actorUid === 'string' ? data.actorUid : '',
  actorEmail: typeof data.actorEmail === 'string' ? data.actorEmail : null,
  actorAdminRoleIds: Array.isArray(data.actorAdminRoleIds) ? data.actorAdminRoleIds : [],
  targetUid: typeof data.targetUid === 'string' ? data.targetUid : null,
  targetEmail: typeof data.targetEmail === 'string' ? data.targetEmail : null,
  summary: typeof data.summary === 'string' ? data.summary : '',
  before:
    data.before && typeof data.before === 'object' && !Array.isArray(data.before) ? data.before : null,
  after:
    data.after && typeof data.after === 'object' && !Array.isArray(data.after) ? data.after : null,
  metadata:
    data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? data.metadata
      : null,
  createdAt: serializeTimestamp(data.createdAt),
});

export const serializeAdminEntityNote = (id: string, data: DocumentData): AdminEntityNote => ({
  id,
  entityType: (typeof data.entityType === 'string' ? data.entityType : 'user') as AdminEntityNote['entityType'],
  entityId: typeof data.entityId === 'string' ? data.entityId : '',
  body: typeof data.body === 'string' ? data.body : '',
  createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : '',
  createdByEmail: typeof data.createdByEmail === 'string' ? data.createdByEmail : null,
  createdAt: serializeTimestamp(data.createdAt),
});

export const listAdminEntityNotes = async (input: {
  entityType: AuditEntityType;
  entityId: string;
  limit?: number;
}) => {
  const snapshot = await getAdminFirestore()
    .collection('adminEntityNotes')
    .where('entityKey', '==', buildAdminEntityKey(input.entityType, input.entityId))
    .get();

  return snapshot.docs
    .map(doc => serializeAdminEntityNote(doc.id, doc.data() as DocumentData))
    .sort(
      (left, right) =>
        getSortTime(typeof right.createdAt === 'string' ? right.createdAt : null) -
        getSortTime(typeof left.createdAt === 'string' ? left.createdAt : null),
    )
    .slice(0, input.limit ?? 12);
};

export const listRecentAdminAuditLogsForEntity = async (input: {
  entityType: AuditEntityType;
  entityId: string;
  targetUid?: string | null;
  dealerId?: string | null;
  limit?: number;
}) => {
  const limit = Math.min(Math.max((input.limit ?? 10) * 6, 50), AUDIT_SCAN_LIMIT);
  const snapshot = await getAdminFirestore()
    .collection('adminAuditLogs')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs
    .map(doc => serializeAdminAuditLog(doc.id, doc.data() as DocumentData))
    .filter(log => {
      if (log.entityType === input.entityType && log.entityId === input.entityId) {
        return true;
      }

      if (input.targetUid && log.targetUid === input.targetUid) {
        return true;
      }

      if (
        input.dealerId &&
        log.metadata &&
        typeof log.metadata.dealerId === 'string' &&
        log.metadata.dealerId === input.dealerId
      ) {
        return true;
      }

      return false;
    })
    .slice(0, input.limit ?? 10);
};
