import type {
  AccountStatus,
  AccountType,
  AdminRoleId,
  DealerPlanDefinition,
  DealerPlanEntitlements,
  DealerPlanId,
  PermissionKey,
  PermissionOverrides,
  UserProfile,
  UserRole,
} from '../types';

type UserIdentityLike = {
  uid: string;
  email: string | null;
};

type UserProfileRecord = Partial<UserProfile> & Record<string, unknown>;

export const PERMISSION_KEYS = [
  'users.read',
  'users.edit',
  'users.suspend',
  'users.reactivate',
  'dealers.read',
  'dealers.edit',
  'dealers.approve',
  'dealers.manage_staff',
  'dealer_plans.read',
  'dealer_plans.assign',
  'dealer_plans.override',
  'listings.read',
  'listings.moderate',
  'listings.reassign',
  'models.read',
  'models.publish',
  'models.merge',
  'stations.read',
  'stations.edit',
  'stations.merge',
  'blog.read',
  'blog.publish',
  'blog.schedule',
  'placements.read',
  'placements.create',
  'placements.edit',
  'placements.assign',
  'placements.publish',
  'placements.pause',
  'placements.override',
  'placements.analytics_read',
  'placements.billing_read',
  'enquiries.read',
  'admins.invite',
  'admins.assign_permissions',
  'audit.view',
  'reports.read',
  'reports.export',
] as const satisfies readonly PermissionKey[];

const DEALER_READ_PERMISSIONS: PermissionKey[] = [
  'dealers.read',
  'listings.read',
  'models.read',
  'enquiries.read',
];

const READ_ONLY_PERMISSIONS: PermissionKey[] = [
  'users.read',
  'dealers.read',
  'dealer_plans.read',
  'listings.read',
  'models.read',
  'stations.read',
  'blog.read',
  'placements.read',
  'placements.analytics_read',
  'enquiries.read',
  'audit.view',
  'reports.read',
];

export const ADMIN_ROLE_PRESETS: Readonly<
  Record<AdminRoleId, { label: string; description: string; permissions: readonly PermissionKey[] }>
> = {
  master_admin: {
    label: 'Master Admin',
    description: 'Full platform authority, including access governance and monetization controls.',
    permissions: PERMISSION_KEYS,
  },
  platform_ops_admin: {
    label: 'Platform Operations Admin',
    description: 'Broad operational control across users, dealers, plans, listings, and reporting.',
    permissions: [
      'users.read',
      'users.edit',
      'users.suspend',
      'users.reactivate',
      'dealers.read',
      'dealers.edit',
      'dealers.approve',
      'dealers.manage_staff',
      'dealer_plans.read',
      'dealer_plans.assign',
      'dealer_plans.override',
      'listings.read',
      'listings.moderate',
      'listings.reassign',
      'enquiries.read',
      'reports.read',
      'reports.export',
      'audit.view',
    ],
  },
  dealer_ops_admin: {
    label: 'Dealer Operations Admin',
    description: 'Dealer, listing, and plan operations without broader admin governance.',
    permissions: [
      'dealers.read',
      'dealers.edit',
      'dealers.approve',
      'dealers.manage_staff',
      'dealer_plans.read',
      'dealer_plans.assign',
      'listings.read',
      'listings.moderate',
      'listings.reassign',
      'enquiries.read',
      'reports.read',
    ],
  },
  user_support_admin: {
    label: 'User Support Admin',
    description: 'Support-focused access for accounts, suspensions, and operational visibility.',
    permissions: [
      'users.read',
      'users.edit',
      'users.suspend',
      'users.reactivate',
      'dealers.read',
      'enquiries.read',
      'reports.read',
      'audit.view',
    ],
  },
  catalog_admin: {
    label: 'Catalog Admin',
    description: 'Canonical EV model and data-quality management.',
    permissions: [
      'models.read',
      'models.publish',
      'models.merge',
      'stations.read',
      'reports.read',
      'audit.view',
    ],
  },
  charging_admin: {
    label: 'Charging Admin',
    description: 'Charging-station operations, verification, and cleanup.',
    permissions: ['stations.read', 'stations.edit', 'stations.merge', 'reports.read', 'audit.view'],
  },
  content_admin: {
    label: 'Content Admin',
    description: 'Editorial publishing and scheduling controls.',
    permissions: ['blog.read', 'blog.publish', 'blog.schedule', 'reports.read'],
  },
  analyst: {
    label: 'Analyst',
    description: 'Read-only operational visibility across the platform.',
    permissions: READ_ONLY_PERMISSIONS,
  },
};

export const DEALER_PLAN_DEFINITIONS: Readonly<Record<DealerPlanId, DealerPlanDefinition>> = {
  free: {
    id: 'free',
    name: 'Free Dealer',
    description: 'Entry-level participation with basic profile, inventory, and lead features.',
    entitlements: {
      maxActiveListings: 5,
      maxStaffAccounts: 1,
      richProfileEnabled: false,
      richMediaEnabled: false,
      videoEnabled: false,
      advancedAnalyticsEnabled: false,
      promotionEligibility: false,
      campaignPurchaseEligibility: false,
      prioritySupport: false,
    },
  },
  paid: {
    id: 'paid',
    name: 'Paid Dealer',
    description: 'Growth tier with richer presentation, analytics, staff access, and promo eligibility.',
    entitlements: {
      maxActiveListings: null,
      maxStaffAccounts: 5,
      richProfileEnabled: true,
      richMediaEnabled: true,
      videoEnabled: true,
      advancedAnalyticsEnabled: true,
      promotionEligibility: true,
      campaignPurchaseEligibility: true,
      prioritySupport: true,
    },
  },
};

const ACCOUNT_TYPES = new Set<AccountType>(['admin', 'dealer', 'dealer_staff', 'user', 'pending']);
const ACCOUNT_STATUSES = new Set<AccountStatus>([
  'active',
  'pending',
  'approved',
  'suspended',
  'disabled',
  'archived',
  'rejected',
]);
const ADMIN_ROLES = new Set<AdminRoleId>([
  'master_admin',
  'platform_ops_admin',
  'dealer_ops_admin',
  'user_support_admin',
  'catalog_admin',
  'charging_admin',
  'content_admin',
  'analyst',
]);
const DEALER_PLANS = new Set<DealerPlanId>(['free', 'paid']);
const PERMISSIONS = new Set<PermissionKey>(PERMISSION_KEYS);
const LEGACY_ROLES = new Set<UserRole>(['admin', 'dealer', 'user', 'pending']);

const normalizeStringArray = <T extends string>(values: unknown, accepted: Set<T>): T[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(values.filter((value): value is T => typeof value === 'string' && accepted.has(value as T))),
  );
};

export const normalizeAccountType = (value: unknown): AccountType | null =>
  typeof value === 'string' && ACCOUNT_TYPES.has(value as AccountType) ? (value as AccountType) : null;

export const normalizeAccountStatus = (value: unknown): AccountStatus | null =>
  typeof value === 'string' && ACCOUNT_STATUSES.has(value as AccountStatus)
    ? (value as AccountStatus)
    : null;

export const normalizeLegacyRole = (value: unknown): UserRole | null =>
  typeof value === 'string' && LEGACY_ROLES.has(value as UserRole) ? (value as UserRole) : null;

export const normalizeDealerPlanId = (value: unknown): DealerPlanId | null =>
  typeof value === 'string' && DEALER_PLANS.has(value as DealerPlanId) ? (value as DealerPlanId) : null;

export const normalizePermissionOverrides = (value: unknown): PermissionOverrides => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<PermissionOverrides>((acc, [key, flag]) => {
    if (PERMISSIONS.has(key as PermissionKey) && typeof flag === 'boolean') {
      acc[key as PermissionKey] = flag;
    }
    return acc;
  }, {});
};

export const deriveAdminRoleIds = (profile: UserProfileRecord): AdminRoleId[] => {
  const explicitRoles = normalizeStringArray(profile.adminRoleIds, ADMIN_ROLES);
  if (explicitRoles.length > 0) {
    return explicitRoles;
  }

  if (profile.isMasterAdmin === true) {
    return ['master_admin'];
  }

  const legacyRole = normalizeLegacyRole(profile.role);
  const accountType = normalizeAccountType(profile.accountType);
  if (legacyRole === 'admin' || accountType === 'admin') {
    return ['master_admin'];
  }

  return [];
};

const resolveUserRole = (profile: UserProfileRecord, adminRoleIds: AdminRoleId[]): UserRole => {
  if (adminRoleIds.length > 0) {
    return 'admin';
  }

  const legacyRole = normalizeLegacyRole(profile.role);
  const accountType = normalizeAccountType(profile.accountType);
  const accountStatus = normalizeAccountStatus(profile.accountStatus ?? profile.status);

  if (legacyRole === 'pending') {
    return 'pending';
  }

  if (accountType === 'dealer' || accountType === 'dealer_staff' || legacyRole === 'dealer') {
    if (accountStatus === 'pending' || accountStatus === 'rejected') {
      return 'pending';
    }
    return 'dealer';
  }

  if (legacyRole) {
    return legacyRole;
  }

  if (accountType === 'pending') {
    return 'pending';
  }

  return 'user';
};

const resolveAccountType = (profile: UserProfileRecord, role: UserRole, adminRoleIds: AdminRoleId[]): AccountType => {
  const explicitType = normalizeAccountType(profile.accountType);
  if (explicitType) {
    return explicitType;
  }

  if (adminRoleIds.length > 0 || role === 'admin') {
    return 'admin';
  }

  if (role === 'dealer' || role === 'pending') {
    return 'dealer';
  }

  return 'user';
};

const resolveAccountStatus = (profile: UserProfileRecord, role: UserRole): AccountStatus => {
  const explicitStatus = normalizeAccountStatus(profile.accountStatus);
  if (explicitStatus) {
    return explicitStatus;
  }

  const legacyStatus = normalizeAccountStatus(profile.status);
  if (legacyStatus) {
    return legacyStatus;
  }

  if (role === 'pending') {
    return 'pending';
  }

  if (role === 'dealer') {
    return 'active';
  }

  return 'active';
};

const resolveDealerPlanId = (profile: UserProfileRecord, role: UserRole, accountType: AccountType): DealerPlanId | null => {
  const explicitPlan = normalizeDealerPlanId(profile.dealerPlanId);
  if (explicitPlan) {
    return explicitPlan;
  }

  if (accountType === 'dealer' || accountType === 'dealer_staff' || role === 'dealer' || role === 'pending') {
    return 'free';
  }

  return null;
};

export const normalizeUserProfile = (identity: UserIdentityLike, profileData: UserProfileRecord): UserProfile => {
  const adminRoleIds = deriveAdminRoleIds(profileData);
  const role = resolveUserRole(profileData, adminRoleIds);
  const accountType = resolveAccountType(profileData, role, adminRoleIds);
  const accountStatus = resolveAccountStatus(profileData, role);
  const dealerPlanId = resolveDealerPlanId(profileData, role, accountType);
  const directPermissions = normalizePermissionOverrides(profileData.directPermissions);

  return {
    ...profileData,
    uid: identity.uid,
    email: identity.email,
    role,
    status: accountStatus,
    accountType,
    accountStatus,
    adminRoleIds,
    directPermissions,
    permissionScopes: Array.isArray(profileData.permissionScopes)
      ? (profileData.permissionScopes as UserProfile['permissionScopes'])
      : undefined,
    isMasterAdmin: adminRoleIds.includes('master_admin'),
    dealerPlanId,
    dealerSubscriptionStatus:
      typeof profileData.dealerSubscriptionStatus === 'string'
        ? (profileData.dealerSubscriptionStatus as UserProfile['dealerSubscriptionStatus'])
        : profileData.dealerSubscriptionStatus ?? null,
  };
};

export const isAdminProfile = (profile: UserProfile | null | undefined): boolean =>
  Boolean(profile && profile.adminRoleIds && profile.adminRoleIds.length > 0);

export const isMasterAdminProfile = (profile: UserProfile | null | undefined): boolean =>
  Boolean(profile?.isMasterAdmin || profile?.adminRoleIds?.includes('master_admin'));

export const getDealerPlanDefinition = (planId: DealerPlanId | null | undefined): DealerPlanDefinition | null =>
  planId ? DEALER_PLAN_DEFINITIONS[planId] ?? null : null;

export const getDealerPlanEntitlements = (
  planId: DealerPlanId | null | undefined,
): DealerPlanEntitlements | null => getDealerPlanDefinition(planId)?.entitlements ?? null;

export const getPermissionsForAdminRoles = (roleIds: readonly AdminRoleId[]): Set<PermissionKey> => {
  if (roleIds.includes('master_admin')) {
    return new Set(PERMISSION_KEYS);
  }

  return roleIds.reduce<Set<PermissionKey>>((acc, roleId) => {
    (ADMIN_ROLE_PRESETS[roleId]?.permissions ?? []).forEach(permission => acc.add(permission));
    return acc;
  }, new Set());
};

export const hasPermission = (
  profile: Pick<UserProfile, 'adminRoleIds' | 'directPermissions' | 'isMasterAdmin'> | null | undefined,
  permission: PermissionKey,
): boolean => {
  if (!profile) {
    return false;
  }

  if (profile.isMasterAdmin || profile.adminRoleIds?.includes('master_admin')) {
    return true;
  }

  const directFlag = profile.directPermissions?.[permission];
  if (directFlag === true) {
    return true;
  }
  if (directFlag === false) {
    return false;
  }

  const allowedPermissions = getPermissionsForAdminRoles(profile.adminRoleIds ?? []);
  return allowedPermissions.has(permission);
};

export const getDealerBasePermissions = (role: UserRole | null | undefined): PermissionKey[] =>
  role === 'dealer' ? DEALER_READ_PERMISSIONS : [];
