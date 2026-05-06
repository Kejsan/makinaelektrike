import { randomBytes } from 'node:crypto';
import type {
  AccessInvite,
  AccessInviteStatus,
  AccessInviteType,
  AdminRoleId,
  DealerStaffRole,
  PermissionOverrides,
} from '../../../types';
import type { FunctionEvent } from './http';

export const ACCESS_INVITE_TYPES = ['platform_admin', 'dealer_staff'] as const satisfies readonly AccessInviteType[];
export const ACCESS_INVITE_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const satisfies readonly AccessInviteStatus[];
export const DEALER_STAFF_ROLES = ['owner', 'manager', 'editor'] as const satisfies readonly DealerStaffRole[];

const isTimestampLike = (value: unknown): value is { toDate: () => Date } =>
  typeof value === 'object' &&
  value !== null &&
  'toDate' in value &&
  typeof (value as { toDate?: unknown }).toDate === 'function';

const toDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (isTimestampLike(value)) {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }

  return null;
};

const toIsoString = (value: unknown) => toDate(value)?.toISOString() ?? null;

const normalizeBaseUrl = (value: string | undefined | null) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

const resolveRequestOrigin = (event: FunctionEvent) => {
  const headers = event.headers ?? {};
  const explicitOrigin =
    headers.origin ??
    headers.Origin ??
    process.env.URL ??
    process.env.DEPLOY_PRIME_URL ??
    process.env.SITE_URL;

  const normalizedExplicitOrigin = normalizeBaseUrl(explicitOrigin);
  if (normalizedExplicitOrigin) {
    return normalizedExplicitOrigin;
  }

  const protocol =
    headers['x-forwarded-proto'] ??
    headers['X-Forwarded-Proto'] ??
    (headers.host?.includes('localhost') ? 'http' : 'https');
  const host = headers['x-forwarded-host'] ?? headers['X-Forwarded-Host'] ?? headers.host ?? headers.Host;
  if (host) {
    return `${protocol}://${host}`;
  }

  return 'http://localhost:8888';
};

export const buildAccessInviteCode = () => randomBytes(24).toString('hex');

export const buildAccessInviteUrl = (event: FunctionEvent, inviteCode: string) =>
  `${resolveRequestOrigin(event)}/accept-invite?code=${encodeURIComponent(inviteCode)}`;

export const buildInviteExpiryDate = (days = 7) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

export const isInviteExpired = (invite: Pick<AccessInvite, 'status' | 'expiresAt'> | Record<string, unknown>) => {
  const expiresAt = toDate(invite.expiresAt);
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() <= Date.now();
};

export const resolveInviteStatus = (
  invite: Pick<AccessInvite, 'status' | 'expiresAt'> | Record<string, unknown>,
): AccessInviteStatus => {
  const rawStatus = typeof invite.status === 'string' ? (invite.status as AccessInviteStatus) : 'pending';
  if (rawStatus === 'pending' && isInviteExpired(invite)) {
    return 'expired';
  }
  return rawStatus;
};

export const serializeAccessInvite = (
  inviteId: string,
  rawInvite: Record<string, unknown>,
  event?: FunctionEvent,
): AccessInvite => ({
  id: inviteId,
  type: (typeof rawInvite.type === 'string' ? rawInvite.type : 'dealer_staff') as AccessInviteType,
  status: resolveInviteStatus(rawInvite),
  email: typeof rawInvite.email === 'string' ? rawInvite.email : '',
  dealerId: typeof rawInvite.dealerId === 'string' ? rawInvite.dealerId : null,
  dealerName: typeof rawInvite.dealerName === 'string' ? rawInvite.dealerName : null,
  adminRoleIds: Array.isArray(rawInvite.adminRoleIds)
    ? (rawInvite.adminRoleIds as AdminRoleId[])
    : [],
  directPermissions:
    rawInvite.directPermissions && typeof rawInvite.directPermissions === 'object'
      ? (rawInvite.directPermissions as PermissionOverrides)
      : {},
  dealerStaffRole:
    typeof rawInvite.dealerStaffRole === 'string'
      ? (rawInvite.dealerStaffRole as DealerStaffRole)
      : null,
  createdBy: typeof rawInvite.createdBy === 'string' ? rawInvite.createdBy : null,
  updatedBy: typeof rawInvite.updatedBy === 'string' ? rawInvite.updatedBy : null,
  revokedBy: typeof rawInvite.revokedBy === 'string' ? rawInvite.revokedBy : null,
  acceptedBy: typeof rawInvite.acceptedBy === 'string' ? rawInvite.acceptedBy : null,
  createdAt: toIsoString(rawInvite.createdAt),
  updatedAt: toIsoString(rawInvite.updatedAt),
  expiresAt: toIsoString(rawInvite.expiresAt),
  acceptedAt: toIsoString(rawInvite.acceptedAt),
  revokedAt: toIsoString(rawInvite.revokedAt),
  ...(event ? { inviteUrl: buildAccessInviteUrl(event, inviteId) } : {}),
});
