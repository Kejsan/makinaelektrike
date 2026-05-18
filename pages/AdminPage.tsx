import React, { Suspense, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Shield,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  XCircle,
  Loader2,
  Upload,
  ClipboardList,
  Power,
  RefreshCcw,
  UserPlus,
  Key,
  CheckCircle,
  Home,
  ExternalLink,
  Search,
  Download,
  Eye,
  EyeOff,
  ImageIcon,
  MapPin,
  MessageSquare,
  Megaphone,
  Receipt,
  CreditCard,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DataContext } from '../contexts/DataContext';
import {
  AdminAuditLog,
  AccessInvite,
  AccountStatus,
  AdminRoleId,
  Dealer,
  DealerPlanId,
  DealerStatus,
  DealerSubscriptionStatus,
  Listing,
  Model,
  PlacementAnalyticsFilters,
  PlacementAnalyticsDailyBucket,
  PlacementCampaignAnalyticsSummary,
  PlacementAnalyticsZoneSummary,
  PlacementEntityType,
  PlacementZoneAvailabilitySummary,
  PlacementZoneStatus,
  PlacementZone,
  PlacementZoneFormValues,
  PublicSiteSettings,
  PromotionalCampaign,
  PromotionalCampaignFormValues,
  BlogPost,
  ChargingStation,
  PermissionKey,
  PermissionOverrides,
  SponsorshipOrder,
  SponsorshipOrderFormValues,
  SponsorshipProductStatus,
  SponsorshipProduct,
  SponsorshipProductFormValues,
  AdminNotification,
} from '../types';
import DealerForm, { DealerFormValues } from '../components/admin/DealerForm';
import type { ModelFormValues } from '../components/admin/ModelForm';
import BlogPostForm, { BlogPostFormValues } from '../components/admin/BlogPostForm';
import ChargingStationForm from '../components/admin/ChargingStationForm';
import PlacementZoneForm from '../components/admin/PlacementZoneForm';
import SponsorshipProductForm from '../components/admin/SponsorshipProductForm';
import SponsorshipOrderForm from '../components/admin/SponsorshipOrderForm';
import PromotionalCampaignForm from '../components/admin/PromotionalCampaignForm';
import VisitorEngagementTab from '../components/admin/VisitorEngagementTab';
import type { BulkImportEntity } from '../components/admin/BulkImportModal';
import BlogTextImportModal from '../components/admin/BlogTextImportModal';
import OfflineQueuePanel from '../components/admin/OfflineQueuePanel';
import {
  fetchChargingStations,
} from '../services/chargingStations';
import {
  listAdminAccessRoster,
  lookupAdminAccess,
  updateAdminAccess,
  type AdminAccessLookupResult,
  type AdminAccessRosterItem,
} from '../services/adminAccess';
import {
  createAdminInvite,
  listAdminInvites,
  revokeAdminInvite,
} from '../services/adminInvites';
import { listAdminAuditLogs } from '../services/adminAudit';
import {
  lookupAdminUser,
  updateAdminUserStatus,
  type AdminUserLookupResult,
} from '../services/adminUsers';
import {
  updateAdminBlog,
  updateAdminDealerStatus,
  updateAdminListing,
  updateAdminModel,
  updateAdminStation,
} from '../services/adminModeration';
import {
  saveAdminBlogPost,
  saveAdminDealer,
  saveAdminModel,
} from '../services/adminContent';
import { activateAdminDealerAccount } from '../services/adminDealerAccounts';
import { updateDealerPlan as updateDealerPlanAssignment } from '../services/adminDealerPlans';
import {
  lookupAdminDealer,
  updateAdminDealerOwner,
  type AdminDealerLookupResult,
} from '../services/adminDealers';
import {
  lookupAdminListing,
  type AdminListingLookupResult,
} from '../services/adminListings';
import {
  lookupAdminModel,
  type AdminModelLookupResult,
} from '../services/adminModels';
import {
  bootstrapAdminPlacements,
  listAdminPlacementAnalytics,
  listAdminPlacements,
  saveSponsorshipOrder,
  savePlacementZone,
  savePromotionalCampaign,
  saveSponsorshipProduct,
} from '../services/adminPlacements';
import { listAdminNotifications } from '../services/adminNotifications';
import {
  getAdminSiteSettings,
  saveAdminSiteSettings,
} from '../services/adminSiteSettings';
import { isFunctionQuotaExceededError } from '../services/serverFunctions';
import {
  lookupAdminStation,
  type AdminStationLookupResult,
} from '../services/adminStations';
import { createAdminEntityNote } from '../services/adminNotes';
import {
  removeDealerStaffMember as removeDealerTeamMember,
  revokeDealerStaffInvite as revokeDealerTeamInvite,
} from '../services/dealerStaff';
import type { ChargingStationFormValues } from '../types';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import { listOfflineMutations, OFFLINE_QUEUE_EVENT } from '../services/offlineQueue';
import {
  uploadDealerGalleryImage,
  uploadDealerHeroImage,
  uploadModelGalleryImage,
  uploadModelHeroImage,
  uploadSiteHeroBackgroundImage,
} from '../services/storage';
import ModalLayout from '../components/ModalLayout';
import DashboardInfoTooltip from '../components/DashboardInfoTooltip';
import {
  ADMIN_ROLE_PRESETS,
  PERMISSION_KEYS,
  getEffectivePermissions,
} from '../utils/accessControl';
import {
  formatPlacementEntityTypeLabel,
  isPromotionalCampaignPubliclyResolvable,
} from '../utils/placements';
import { DEFAULT_SITE_SETTINGS } from '../constants/siteSettings';

const ModelForm = lazy(() => import('../components/admin/ModelForm'));
const BulkImportModal = lazy(() => import('../components/admin/BulkImportModal'));
const AdminListingsTab = lazy(() => import('../components/admin/AdminListingsTab'));
const MigrationTool = lazy(() =>
  import('../components/admin/MigrationTool').then(module => ({ default: module.MigrationTool })),
);

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const AdminLazyFallback: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-sm text-gray-300">
    <Loader2 className="h-4 w-4 animate-spin text-gray-cyan" />
    <span>{label ?? 'Loading...'}</span>
  </div>
);

const AdminModal: React.FC<ModalProps> = ({ title, onClose, children }) => {
  return (
    <ModalLayout isOpen onClose={onClose} title={title} maxWidthClass="max-w-3xl">
      {children}
    </ModalLayout>
  );
};

type FormState<T> = { mode: 'create' | 'edit'; entity?: T } | null;

type TabKey =
  | 'overview'
  | 'dealers'
  | 'users'
  | 'models'
  | 'listings'
  | 'blog'
  | 'settings'
  | 'engagement'
  | 'stations'
  | 'placements'
  | 'reports'
  | 'access'
  | 'audit'
  | 'migration';
type DealerFilterKey = 'active' | 'inactive' | 'pending' | 'deleted';
const TAB_KEYS: readonly TabKey[] = [
  'overview',
  'dealers',
  'users',
  'models',
  'listings',
  'blog',
  'settings',
  'engagement',
  'stations',
  'placements',
  'reports',
  'access',
  'audit',
  'migration',
] as const;
const DEALER_FILTER_KEYS: readonly DealerFilterKey[] = ['active', 'inactive', 'pending', 'deleted'];
const MODEL_FILTER_KEYS = ['all', 'featured', 'visible', 'hidden'] as const;
const BLOG_FILTER_KEYS = ['all', 'published', 'draft'] as const;
const STATION_FILTER_KEYS = ['all', 'active', 'inactive'] as const;

const isTabKey = (value: string | null): value is TabKey =>
  !!value && (TAB_KEYS as readonly string[]).includes(value);
type DealerPlanDraft = {
  planId: DealerPlanId;
  subscriptionStatus: DealerSubscriptionStatus;
};

const DEALER_PLAN_IDS: DealerPlanId[] = ['free', 'paid'];
const DEALER_SUBSCRIPTION_STATUSES: DealerSubscriptionStatus[] = [
  'active',
  'paused',
  'expired',
  'cancelled',
];
const ADMIN_ACCOUNT_STATUSES: AccountStatus[] = ['active', 'suspended', 'disabled', 'archived'];
const PLACEMENT_ANALYTICS_RANGE_OPTIONS = [7, 14, 30, 90] as const;

const formatDate = (value: Dealer['createdAt']) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    try {
      return value.toDate().toLocaleDateString();
    } catch (error) {
      console.error('Failed to format timestamp', error);
    }
  }

  return null;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const coerceDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      try {
        const parsed = (value as { toDate: () => Date }).toDate();
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      } catch (error) {
        console.error('Failed to coerce timestamp via toDate()', error);
      }
    }

    if ('seconds' in value && typeof (value as { seconds?: number }).seconds === 'number') {
      const parsed = new Date((value as { seconds: number }).seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
};

const toPlacementFormDate = (value: unknown) => {
  const parsed = coerceDate(value);
  return parsed ? parsed.toISOString() : '';
};

const toDayKey = (value: Date) => value.toISOString().slice(0, 10);

const formatJsonBlock = (value: Record<string, unknown> | null | undefined) => {
  if (!value || Object.keys(value).length === 0) {
    return null;
  }

  return JSON.stringify(value, null, 2);
};

const escapeCsvValue = (value: string | number | null | undefined) => {
  const rawValue = value == null ? '' : String(value);
  if (rawValue.includes(',') || rawValue.includes('"') || rawValue.includes('\n')) {
    return `"${rawValue.replace(/"/g, '""')}"`;
  }

  return rawValue;
};

const formatAuditActionLabel = (action: string) =>
  action
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());

const PERMISSION_OVERRIDE_OPTIONS = ['inherit', 'allow', 'deny'] as const;
type PermissionOverrideOption = (typeof PERMISSION_OVERRIDE_OPTIONS)[number];

const PERMISSION_GROUP_LABELS: Record<string, string> = {
  users: 'Users',
  dealers: 'Dealers',
  dealer_plans: 'Dealer plans',
  listings: 'Listings',
  models: 'EV models',
  stations: 'Charging stations',
  blog: 'Blog',
  placements: 'Placements',
  enquiries: 'Enquiries',
  admins: 'Admins',
  audit: 'Audit',
  reports: 'Reports',
};

const formatPermissionGroupLabel = (group: string) =>
  PERMISSION_GROUP_LABELS[group] ??
  group
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatPermissionActionLabel = (permission: PermissionKey) => {
  const [, action = permission] = permission.split('.');

  return action
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const normalizeSiteSettingsDraft = (settings: PublicSiteSettings): PublicSiteSettings => ({
  socialLinks: {
    ...DEFAULT_SITE_SETTINGS.socialLinks,
    ...settings.socialLinks,
  },
  homeHeroImages: settings.homeHeroImages ?? [],
  updatedAt: settings.updatedAt ?? null,
});

const AdminPage: React.FC = () => {
  const { logout, user, role, hasPermission, isMasterAdmin } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const notificationKnownIdsRef = useRef<Set<string>>(new Set());
  const notificationInitialLoadRef = useRef(false);

  const [activationModalDealer, setActivationModalDealer] = useState<Dealer | null>(null);
  const [activationPassword, setActivationPassword] = useState('');
  const [activationEmail, setActivationEmail] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [dealerControlDealer, setDealerControlDealer] = useState<Dealer | null>(null);
  const [dealerControlDetail, setDealerControlDetail] = useState<AdminDealerLookupResult | null>(null);
  const [dealerControlLoading, setDealerControlLoading] = useState(false);
  const [dealerControlError, setDealerControlError] = useState<string | null>(null);
  const [dealerOwnerDraftQuery, setDealerOwnerDraftQuery] = useState('');
  const [dealerOwnerUpdating, setDealerOwnerUpdating] = useState(false);
  const [dealerControlInviteRevokingId, setDealerControlInviteRevokingId] = useState<string | null>(null);
  const [dealerControlStaffRemovingId, setDealerControlStaffRemovingId] = useState<string | null>(null);
  const [dealerControlNoteDraft, setDealerControlNoteDraft] = useState('');
  const [dealerControlNoteSaving, setDealerControlNoteSaving] = useState(false);
  const [listingControlListing, setListingControlListing] = useState<Listing | null>(null);
  const [listingControlDetail, setListingControlDetail] = useState<AdminListingLookupResult | null>(null);
  const [listingControlLoading, setListingControlLoading] = useState(false);
  const [listingControlError, setListingControlError] = useState<string | null>(null);
  const [listingControlNoteDraft, setListingControlNoteDraft] = useState('');
  const [listingControlNoteSaving, setListingControlNoteSaving] = useState(false);
  const [modelControlModel, setModelControlModel] = useState<Model | null>(null);
  const [modelControlDetail, setModelControlDetail] = useState<AdminModelLookupResult | null>(null);
  const [modelControlLoading, setModelControlLoading] = useState(false);
  const [modelControlError, setModelControlError] = useState<string | null>(null);
  const [modelControlNoteDraft, setModelControlNoteDraft] = useState('');
  const [modelControlNoteSaving, setModelControlNoteSaving] = useState(false);
  const [stationControlStation, setStationControlStation] = useState<ChargingStation | null>(null);
  const [stationControlDetail, setStationControlDetail] = useState<AdminStationLookupResult | null>(null);
  const [stationControlLoading, setStationControlLoading] = useState(false);
  const [stationControlError, setStationControlError] = useState<string | null>(null);
  const [stationControlNoteDraft, setStationControlNoteDraft] = useState('');
  const [stationControlNoteSaving, setStationControlNoteSaving] = useState(false);
  const [placementZones, setPlacementZones] = useState<PlacementZone[]>([]);
  const [sponsorshipProducts, setSponsorshipProducts] = useState<SponsorshipProduct[]>([]);
  const [sponsorshipOrders, setSponsorshipOrders] = useState<SponsorshipOrder[]>([]);
  const [placementAvailability, setPlacementAvailability] = useState<PlacementZoneAvailabilitySummary[]>([]);
  const [promotionalCampaigns, setPromotionalCampaigns] = useState<PromotionalCampaign[]>([]);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [placementsLoaded, setPlacementsLoaded] = useState(false);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [placementAnalyticsFilters, setPlacementAnalyticsFilters] =
    useState<PlacementAnalyticsFilters>({ days: 14, zoneKey: null });
  const [placementAnalytics, setPlacementAnalytics] = useState<PlacementCampaignAnalyticsSummary[]>([]);
  const [placementZoneAnalytics, setPlacementZoneAnalytics] = useState<PlacementAnalyticsZoneSummary[]>([]);
  const [placementDailyAnalytics, setPlacementDailyAnalytics] = useState<PlacementAnalyticsDailyBucket[]>([]);
  const [placementAnalyticsLoading, setPlacementAnalyticsLoading] = useState(false);
  const [placementAnalyticsLoaded, setPlacementAnalyticsLoaded] = useState(false);
  const [placementAnalyticsError, setPlacementAnalyticsError] = useState<string | null>(null);
  const [placementAnalyticsExporting, setPlacementAnalyticsExporting] = useState(false);
  const [placementSaving, setPlacementSaving] = useState(false);
  const [placementBootstrapLoading, setPlacementBootstrapLoading] = useState(false);
  const [placementZoneFormState, setPlacementZoneFormState] = useState<FormState<PlacementZone>>(null);
  const [sponsorshipProductFormState, setSponsorshipProductFormState] =
    useState<FormState<SponsorshipProduct>>(null);
  const [sponsorshipOrderFormState, setSponsorshipOrderFormState] =
    useState<FormState<SponsorshipOrder>>(null);
  const [promotionalCampaignFormState, setPromotionalCampaignFormState] =
    useState<FormState<PromotionalCampaign>>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const {
    dealers,
    models,
    listings,
    blogPosts,
    loading,
    loadError,
    dealerMutations,
    modelMutations,
    blogPostMutations,
  } = useContext(DataContext);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [siteSettingsDraft, setSiteSettingsDraft] =
    useState<PublicSiteSettings>(DEFAULT_SITE_SETTINGS);
  const [siteSettingsLoaded, setSiteSettingsLoaded] = useState(false);
  const [siteSettingsLoading, setSiteSettingsLoading] = useState(false);
  const [siteSettingsSaving, setSiteSettingsSaving] = useState(false);
  const [siteHeroUploadTarget, setSiteHeroUploadTarget] = useState<{
    id: string;
    slot: 'desktop' | 'mobile';
  } | null>(null);
  const [siteSettingsError, setSiteSettingsError] = useState<string | null>(null);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [adminNotificationsLoading, setAdminNotificationsLoading] = useState(false);
  const [adminNotificationsError, setAdminNotificationsError] = useState<string | null>(null);
  const [adminNotificationsPausedUntil, setAdminNotificationsPausedUntil] = useState<number | null>(null);
  const [adminNotificationsOpen, setAdminNotificationsOpen] = useState(false);
  const [browserNotificationEnabled, setBrowserNotificationEnabled] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem('adminBrowserNotifications') === 'enabled',
  );
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(true);
  const [dealerFormState, setDealerFormState] = useState<FormState<Dealer>>(null);
  const [modelFormState, setModelFormState] = useState<FormState<Model>>(null);
  const [blogFormState, setBlogFormState] = useState<FormState<BlogPost>>(null);
  const [stationFormState, setStationFormState] = useState<FormState<ChargingStation>>(null);
  const [bulkEntity, setBulkEntity] = useState<BulkImportEntity | null>(null);
  const [dealerSubmitting, setDealerSubmitting] = useState(false);
  const [modelSubmitting, setModelSubmitting] = useState(false);
  const [blogSubmitting, setBlogSubmitting] = useState(false);
  const [blogTextImportOpen, setBlogTextImportOpen] = useState(false);
  const [stationSubmitting, setStationSubmitting] = useState(false);
  const [dealerAction, setDealerAction] = useState<
    { id: string; type: 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'delete' } | null
  >(null);
  const [modelAction, setModelAction] = useState<
    { id: string; type: 'toggleVisibility' | 'toggleFeatured' | 'approveReview' | 'rejectReview' | 'delete' } | null
  >(null);
  const [blogAction, setBlogAction] = useState<
    { id: string; type: 'toggleStatus' | 'delete' } | null
  >(null);
  const [stationAction, setStationAction] = useState<
    { id: string; type: 'toggleVisibility' | 'delete' } | null
  >(null);
  const [dealerFilter, setDealerFilter] = useState<DealerFilterKey>('pending');
  const [modelFilter, setModelFilter] = useState<'all' | 'featured' | 'visible' | 'hidden'>('all');
  const [blogFilter, setBlogFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [stationFilter, setStationFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [offlineQueueOpen, setOfflineQueueOpen] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(() =>
    typeof window !== 'undefined' ? listOfflineMutations().length : 0,
  );
  const [stations, setStations] = useState<ChargingStation[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [dealerPlanDrafts, setDealerPlanDrafts] = useState<Record<string, DealerPlanDraft>>({});
  const [dealerPlanUpdatingId, setDealerPlanUpdatingId] = useState<string | null>(null);
  const [adminAccessQuery, setAdminAccessQuery] = useState('');
  const [adminAccessLookupLoading, setAdminAccessLookupLoading] = useState(false);
  const [adminAccessSaving, setAdminAccessSaving] = useState(false);
  const [adminAccessLookupError, setAdminAccessLookupError] = useState<string | null>(null);
  const [adminAccessResult, setAdminAccessResult] = useState<AdminAccessLookupResult | null>(null);
  const [adminAccessRoleDraftIds, setAdminAccessRoleDraftIds] = useState<AdminRoleId[]>([]);
  const [adminAccessStatusDraft, setAdminAccessStatusDraft] = useState<AccountStatus>('active');
  const [adminAccessDirectPermissionDraft, setAdminAccessDirectPermissionDraft] = useState<PermissionOverrides>({});
  const [adminRoster, setAdminRoster] = useState<AdminAccessRosterItem[]>([]);
  const [adminRosterLoading, setAdminRosterLoading] = useState(false);
  const [adminRosterLoaded, setAdminRosterLoaded] = useState(false);
  const [adminRosterError, setAdminRosterError] = useState<string | null>(null);
  const [adminInviteEmail, setAdminInviteEmail] = useState('');
  const [adminInviteRoleDraftIds, setAdminInviteRoleDraftIds] = useState<AdminRoleId[]>([]);
  const [adminInviteError, setAdminInviteError] = useState<string | null>(null);
  const [adminInviteCreating, setAdminInviteCreating] = useState(false);
  const [adminInviteRevokingId, setAdminInviteRevokingId] = useState<string | null>(null);
  const [adminInvites, setAdminInvites] = useState<AccessInvite[]>([]);
  const [adminInvitesLoading, setAdminInvitesLoading] = useState(false);
  const [adminInvitesLoaded, setAdminInvitesLoaded] = useState(false);
  const [userAdminQuery, setUserAdminQuery] = useState('');
  const [userAdminLookupLoading, setUserAdminLookupLoading] = useState(false);
  const [userAdminActionLoading, setUserAdminActionLoading] = useState(false);
  const [userAdminLookupError, setUserAdminLookupError] = useState<string | null>(null);
  const [userAdminResult, setUserAdminResult] = useState<AdminUserLookupResult | null>(null);
  const [userAdminNoteDraft, setUserAdminNoteDraft] = useState('');
  const [userAdminNoteSaving, setUserAdminNoteSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Search and Selection States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const canManageAdminAccess = hasPermission('admins.assign_permissions');
  const canInviteAdmins = hasPermission('admins.invite');
  const canReadDealers =
    hasPermission('dealers.read') ||
    hasPermission('dealers.edit') ||
    hasPermission('dealers.approve') ||
    hasPermission('dealers.manage_staff');
  const canEditDealers = hasPermission('dealers.edit');
  const canManageDealerTeam =
    hasPermission('dealers.manage_staff') ||
    hasPermission('dealers.edit') ||
    hasPermission('dealers.approve');
  const canReadUsers = hasPermission('users.read') || hasPermission('users.edit') || hasPermission('users.suspend') || hasPermission('users.reactivate');
  const canSuspendUsers = hasPermission('users.suspend');
  const canReactivateUsers = hasPermission('users.reactivate');
  const canReadListings =
    hasPermission('listings.read') ||
    hasPermission('listings.moderate') ||
    hasPermission('listings.reassign');
  const canModerateListings = hasPermission('listings.moderate');
  const canReadModels =
    hasPermission('models.read') ||
    hasPermission('models.publish') ||
    hasPermission('models.merge');
  const canManageModels =
    hasPermission('models.publish') ||
    hasPermission('models.merge');
  const canReadStations =
    hasPermission('stations.read') ||
    hasPermission('stations.edit') ||
    hasPermission('stations.merge');
  const canManageStations =
    hasPermission('stations.edit') ||
    hasPermission('stations.merge');
  const canReadPlacements =
    hasPermission('placements.read') ||
    hasPermission('placements.create') ||
    hasPermission('placements.edit') ||
    hasPermission('placements.assign') ||
    hasPermission('placements.publish') ||
    hasPermission('placements.pause') ||
    hasPermission('placements.override');
  const canManagePlacements =
    hasPermission('placements.create') ||
    hasPermission('placements.edit') ||
    hasPermission('placements.assign') ||
    hasPermission('placements.publish') ||
    hasPermission('placements.pause') ||
    hasPermission('placements.override');
  const canOverridePlacements = hasPermission('placements.override');
  const canReadPlacementAnalytics = hasPermission('placements.analytics_read');
  const canReadAnnouncements =
    hasPermission('announcements.read') ||
    hasPermission('announcements.create') ||
    hasPermission('announcements.edit') ||
    hasPermission('announcements.publish') ||
    hasPermission('announcements.analytics_read');
  const canReadBlog =
    hasPermission('blog.read') ||
    hasPermission('blog.publish') ||
    hasPermission('blog.schedule');
  const canManageSiteSettings = isMasterAdmin || hasPermission('blog.publish');
  const canViewAudit = hasPermission('audit.view');
  const canViewReports =
    hasPermission('reports.export') ||
    canReadPlacementAnalytics ||
    hasPermission('announcements.analytics_read') ||
    canViewAudit;
  const canExportReports = hasPermission('reports.export');
  const canReadAdminNotifications =
    canReadDealers ||
    canReadUsers ||
    canReadListings ||
    canReadModels ||
    canReadStations ||
    canReadPlacements ||
    canReadAnnouncements ||
    canReadBlog ||
    canManageAdminAccess ||
    canInviteAdmins ||
    hasPermission('enquiries.read');

  // Reset selection and search on tab/filter change
  useEffect(() => {
    setSelectedIds([]);
    setSearchQuery('');
  }, [activeTab, dealerFilter, modelFilter, blogFilter, stationFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (ids: string[]) => {
    if (selectedIds.length === ids.length && ids.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(ids);
    }
  };

  const confirmBulkDelete = () =>
    window.confirm(
      t('admin.bulkDeleteSelectedConfirm', {
        defaultValue: 'Are you sure you want to delete the selected items?',
      }),
    );

  const showBulkActionToast = (status: 'processing' | 'success' | 'failed') => {
    const variant = status === 'processing' ? 'info' : status === 'success' ? 'success' : 'error';
    const key =
      status === 'processing'
        ? 'admin.bulkActionInProgress'
        : status === 'success'
          ? 'admin.bulkActionSuccess'
          : 'admin.bulkActionFailed';

    const defaultValue =
      status === 'processing'
        ? 'Bulk update in progress...'
        : status === 'success'
          ? 'Bulk update completed successfully.'
          : 'Bulk update failed.';

    addToast(t(key, { defaultValue }), variant);
  };

  const handleBulkDealerAction = async (action: 'approve' | 'deactivate' | 'delete' | 'reactivate') => {
    if (!isAdmin || selectedIds.length === 0) return;
    if (action === 'delete' && !confirmBulkDelete()) return;

    showBulkActionToast('processing');
    try {
      await Promise.all(
        selectedIds.map(id =>
          updateAdminDealerStatus(
            id,
            action === 'approve'
              ? 'approve'
              : action === 'deactivate'
                ? 'deactivate'
                : action === 'delete'
                  ? 'delete'
                  : 'reactivate',
          ),
        ),
      );
      showBulkActionToast('success');
      setSelectedIds([]);
    } catch (error) {
      console.error(`Bulk ${action} failed:`, error);
      showBulkActionToast('failed');
    }
  };

  const handleBulkModelAction = async (action: 'delete' | 'toggleFeatured' | 'toggleVisibility') => {
    if (!isAdmin || selectedIds.length === 0) return;
    if (action === 'delete' && !confirmBulkDelete()) return;

    // Use current filter to determine explicit action if it's toggleVisibility
    const explicitAction = action === 'toggleVisibility' 
      ? (modelFilter === 'hidden' ? 'show' : 'hide') 
      : action;

    showBulkActionToast('processing');
    try {
      await Promise.all(selectedIds.map(id => {
        if (action === 'delete') return updateAdminModel({ modelId: id, delete: true });
        const model = models.find(m => m.id === id);
        if (!model) return Promise.resolve();
        
        if (action === 'toggleFeatured') {
          return updateAdminModel({ modelId: id, isFeatured: !model.isFeatured });
        }
        if (action === 'toggleVisibility') {
          // Explicitly set based on current filter state if possible, or just toggle
          const targetVisibility = modelFilter === 'hidden' ? true : (modelFilter === 'visible' ? false : !model.isActive);
          return updateAdminModel({ modelId: id, isActive: targetVisibility });
        }
        return Promise.resolve();
      }));
      showBulkActionToast('success');
      setSelectedIds([]);
    } catch (error) {
      console.error(`Bulk ${explicitAction} failed:`, error);
      showBulkActionToast('failed');
    }
  };

  const handleBulkListingAction = async (action: 'approve' | 'reject' | 'hide' | 'delete') => {
    if (!isAdmin || selectedIds.length === 0) return;
    if (action === 'delete' && !confirmBulkDelete()) return;

    showBulkActionToast('processing');
    try {
      await Promise.all(selectedIds.map(id => {
        if (action === 'delete') return updateAdminListing({ listingId: id, status: 'deleted' });
        if (action === 'approve') return updateAdminListing({ listingId: id, status: 'active' });
        if (action === 'reject') return updateAdminListing({ listingId: id, status: 'rejected' });
        if (action === 'hide') return updateAdminListing({ listingId: id, status: 'inactive' });
        return Promise.resolve();
      }));
      showBulkActionToast('success');
      setSelectedIds([]);
    } catch (error) {
      console.error(`Bulk ${action} failed:`, error);
      showBulkActionToast('failed');
    }
  };

  const handleBulkBlogAction = async (action: 'publish' | 'draft' | 'delete') => {
    if (!isAdmin || selectedIds.length === 0) return;
    if (action === 'delete' && !confirmBulkDelete()) return;

    showBulkActionToast('processing');
    try {
      await Promise.all(selectedIds.map(id => {
        if (action === 'delete') return updateAdminBlog({ postId: id, delete: true });
        if (action === 'publish' || action === 'draft') {
          return updateAdminBlog({ postId: id, status: action === 'publish' ? 'published' : 'draft' });
        }
        return Promise.resolve();
      }));
      showBulkActionToast('success');
      setSelectedIds([]);
    } catch (error) {
      console.error(`Bulk ${action} failed:`, error);
      showBulkActionToast('failed');
    }
  };

  const refreshStationsData = useCallback(async () => {
    const data = await fetchChargingStations();
    setStations(data);
    return data;
  }, []);

  const handleBulkStationAction = async (action: 'delete' | 'toggleActive') => {
    if (!isAdmin || selectedIds.length === 0) return;
    if (action === 'delete' && !confirmBulkDelete()) return;

    const explicitAction = action === 'toggleActive' 
      ? (stationFilter === 'inactive' ? 'show' : 'hide') 
      : action;

    showBulkActionToast('processing');
    try {
      await Promise.all(selectedIds.map(async (id) => {
        const station = stations.find(s => s.id === id);
        if (action === 'delete') {
          return updateAdminStation({ action: 'delete', stationId: id });
        }
        if (action === 'toggleActive' && station) {
          const targetVisibility = stationFilter === 'inactive' ? true : (stationFilter === 'active' ? false : !station.isActive);
          return updateAdminStation({
            action: 'update',
            stationId: id,
            values: {
              address: station.address,
              plugTypes: station.plugTypes,
              chargingSpeedKw: station.chargingSpeedKw,
              operator: station.operator || '',
              pricingDetails: station.pricingDetails || '',
              googleMapsLink: station.googleMapsLink || '',
              latitude: station.latitude ?? '',
              longitude: station.longitude ?? '',
              isActive: targetVisibility,
            },
          });
        }
        return Promise.resolve();
      }));
      const data = await refreshStationsData();
      if (stationControlStation && selectedIds.includes(stationControlStation.id)) {
        if (action === 'delete') {
          closeStationControlCenter();
        } else {
          const refreshedStation = data.find(station => station.id === stationControlStation.id) ?? null;
          setStationControlStation(refreshedStation);
          if (refreshedStation) {
            await loadStationControlDetail(refreshedStation.id);
          } else {
            closeStationControlCenter();
          }
        }
      }
      showBulkActionToast('success');
      setSelectedIds([]);
    } catch (error) {
      console.error(`Bulk ${explicitAction} failed:`, error);
      showBulkActionToast('failed');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateCount = () => setOfflineQueueCount(listOfflineMutations().length);
    window.addEventListener(OFFLINE_QUEUE_EVENT, updateCount);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_EVENT, updateCount);
    };
  }, []);

  const tabs = useMemo(
    () => [
      {
        id: 'overview' as TabKey,
        label: t('admin.overviewTab', { defaultValue: 'Overview' }),
        description: t('admin.tooltips.overviewTab', {
          defaultValue: 'High-level operations snapshot: pending queues, platform health, recent activity, and quick triage signals.',
        }),
      },
      {
        id: 'dealers' as TabKey,
        label: t('admin.manageDealers'),
        description: t('admin.tooltips.dealersTab', {
          defaultValue: 'Approve, edit, deactivate, restore, plan-manage, and inspect dealer profiles, owners, staff, listings, and notes.',
        }),
      },
      ...(canReadUsers
        ? [{
            id: 'users' as TabKey,
            label: t('admin.manageUsers', { defaultValue: 'Users' }),
            description: t('admin.tooltips.usersTab', {
              defaultValue: 'Look up user accounts, inspect relationships, add notes, and suspend or reactivate access where permitted.',
            }),
          }]
        : []),
      {
        id: 'models' as TabKey,
        label: t('admin.manageModels'),
        description: t('admin.tooltips.modelsTab', {
          defaultValue: 'Manage canonical EV model cards, media, visibility, featured status, and dealer-submitted model reviews.',
        }),
      },
      {
        id: 'listings' as TabKey,
        label: t('admin.listingsTab', { defaultValue: 'Listings' }),
        description: t('admin.tooltips.listingsTab', {
          defaultValue: 'Moderate dealer inventory, inspect model-card override reasons, and approve, hide, reject, or delete listings.',
        }),
      },
      {
        id: 'blog' as TabKey,
        label: t('admin.manageBlog'),
        description: t('admin.tooltips.blogTab', {
          defaultValue: 'Create, edit, draft, publish, import, and manage blog content, SEO metadata, and editorial quality.',
        }),
      },
      ...(canManageSiteSettings
        ? [
            {
              id: 'settings' as TabKey,
              label: t('admin.siteSettingsTab', { defaultValue: 'Site settings' }),
              description: t('admin.tooltips.siteSettingsTab', {
                defaultValue: 'Edit public footer social links and homepage hero background images.',
              }),
            },
          ]
        : []),
      ...(canReadAnnouncements
        ? [
            {
              id: 'engagement' as TabKey,
              label: t('admin.visitorEngagementTab', { defaultValue: 'Visitor engagement' }),
              description: t('admin.tooltips.visitorEngagementTab', {
                defaultValue: 'Publish public platform updates, review announcement drafts, manage engagement modules, and monitor visitor notification analytics.',
              }),
            },
          ]
        : []),
      {
        id: 'stations' as TabKey,
        label: t('admin.manageStations', { defaultValue: 'Charging stations' }),
        description: t('admin.tooltips.stationsTab', {
          defaultValue: 'Manage public charging station data, coordinates, operator details, active state, audit history, and notes.',
        }),
      },
      ...(canReadPlacements
        ? [
            {
              id: 'placements' as TabKey,
              label: t('admin.placementsTab', { defaultValue: 'Placements' }),
              description: t('admin.tooltips.placementsTab', {
                defaultValue: 'Control monetized placement zones, sponsorship products, dealer orders, campaigns, billing state, and analytics.',
              }),
            },
          ]
        : []),
      ...(canViewReports
        ? [
            {
              id: 'reports' as TabKey,
              label: t('admin.reportsTab', { defaultValue: 'Reports' }),
              description: t('admin.tooltips.reportsTab', {
                defaultValue: 'Review platform health, quality gaps, activity trends, placement analytics, and exportable operational data.',
              }),
            },
          ]
        : []),
      ...(canManageAdminAccess
        ? [
            {
              id: 'access' as TabKey,
              label: t('admin.accessControlTab', { defaultValue: 'Access control' }),
              description: t('admin.tooltips.accessTab', {
                defaultValue: 'Invite platform admins, assign role presets, grant or deny permissions, and review effective access.',
              }),
            },
          ]
        : []),
      ...(canViewAudit
        ? [
            {
              id: 'audit' as TabKey,
              label: t('admin.auditLogTab', { defaultValue: 'Audit log' }),
              description: t('admin.tooltips.auditTab', {
                defaultValue: 'Inspect trusted backend audit entries for privileged actions, actors, targets, before/after state, and metadata.',
              }),
            },
          ]
        : []),
      {
        id: 'migration' as TabKey,
        label: t('admin.migrationTab', { defaultValue: 'Data migration' }),
        description: t('admin.tooltips.migrationTab', {
          defaultValue: 'Run controlled maintenance, migration, import, backfill, and recovery tools. Use only when you understand the data impact.',
        }),
      },
    ],
    [
      canManageAdminAccess,
      canManageSiteSettings,
      canReadAnnouncements,
      canReadPlacements,
      canReadUsers,
      canViewAudit,
      canViewReports,
      t,
    ]
  );

  const tabGroups = useMemo(
    () => [
      {
        label: 'Dashboard',
        ids: ['overview'] as TabKey[],
      },
      {
        label: 'Marketplace',
        ids: ['dealers', 'users', 'models', 'listings'] as TabKey[],
      },
      {
        label: 'Content and growth',
        ids: ['blog', 'settings', 'engagement', 'stations', 'placements', 'reports'] as TabKey[],
      },
      {
        label: 'Governance',
        ids: ['access', 'audit', 'migration'] as TabKey[],
      },
    ].map(group => ({
      ...group,
      tabs: group.ids
        .map(id => tabs.find(tab => tab.id === id))
        .filter((tab): tab is (typeof tabs)[number] => Boolean(tab)),
    })).filter(group => group.tabs.length > 0),
    [tabs],
  );

  const getAdminLoadErrorMessage = useCallback(
    (error: unknown, fallbackKey: string, defaultValue: string) => {
      if (isFunctionQuotaExceededError(error)) {
        return t('admin.firestoreQuotaExceeded', {
          defaultValue:
            'Firebase quota is currently exhausted, so live admin data cannot be loaded. Retry after the quota resets or increase the Firebase quota.',
        });
      }

      return error instanceof Error ? error.message : t(fallbackKey, { defaultValue });
    },
    [t],
  );

  const loadSiteSettings = useCallback(
    async (force = false) => {
      if (!canManageSiteSettings || siteSettingsLoading || (siteSettingsLoaded && !force)) {
        return;
      }

      setSiteSettingsLoading(true);
      setSiteSettingsError(null);
      try {
        const response = await getAdminSiteSettings();
        setSiteSettingsDraft(normalizeSiteSettingsDraft(response.settings));
        setSiteSettingsLoaded(true);
      } catch (error) {
        console.error('Failed to load site settings', error);
        setSiteSettingsError(getAdminLoadErrorMessage(
          error,
          'admin.siteSettingsLoadFailed',
          'Failed to load site settings.',
        ));
      } finally {
        setSiteSettingsLoading(false);
      }
    },
    [
      canManageSiteSettings,
      getAdminLoadErrorMessage,
      siteSettingsLoaded,
      siteSettingsLoading,
    ],
  );

  const updateSiteSocialLink = useCallback(
    (key: keyof PublicSiteSettings['socialLinks'], value: string) => {
      setSiteSettingsDraft(prev => ({
        ...prev,
        socialLinks: {
          ...prev.socialLinks,
          [key]: value,
        },
      }));
    },
    [],
  );

  const updateSiteHeroImage = useCallback(
    (id: string, field: keyof Pick<PublicSiteSettings['homeHeroImages'][number], 'imageUrl' | 'mobileImageUrl' | 'alt'>, value: string) => {
      setSiteSettingsDraft(prev => ({
        ...prev,
        homeHeroImages: prev.homeHeroImages.map(image =>
          image.id === id ? { ...image, [field]: value } : image,
        ),
      }));
    },
    [],
  );

  const handleSiteHeroImageUpload = useCallback(
    async (
      id: string,
      slot: 'desktop' | 'mobile',
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setSiteHeroUploadTarget({ id, slot });
      setSiteSettingsError(null);
      try {
        const imageUrl = await uploadSiteHeroBackgroundImage(slot, file);
        updateSiteHeroImage(
          id,
          slot === 'desktop' ? 'imageUrl' : 'mobileImageUrl',
          imageUrl,
        );
        addToast(
          t('admin.siteHeroImageUploaded', {
            defaultValue: 'Image uploaded. Save settings to publish it.',
          }),
          'success',
        );
      } catch (error) {
        console.error('Failed to upload homepage hero image', error);
        const message = error instanceof Error
          ? error.message
          : t('admin.siteHeroImageUploadFailed', {
              defaultValue: 'Image upload failed. Please try again.',
            });
        setSiteSettingsError(message);
        addToast(message, 'error');
      } finally {
        setSiteHeroUploadTarget(null);
        event.target.value = '';
      }
    },
    [addToast, t, updateSiteHeroImage],
  );

  const addSiteHeroImage = useCallback(() => {
    const id = `hero-${Date.now()}`;
    setSiteSettingsDraft(prev => ({
      ...prev,
      homeHeroImages: [
        ...prev.homeHeroImages,
        {
          id,
          imageUrl: '',
          mobileImageUrl: '',
          alt: '',
        },
      ],
    }));
  }, []);

  const removeSiteHeroImage = useCallback((id: string) => {
    setSiteSettingsDraft(prev => ({
      ...prev,
      homeHeroImages: prev.homeHeroImages.filter(image => image.id !== id),
    }));
  }, []);

  const handleSaveSiteSettings = useCallback(async () => {
    if (!canManageSiteSettings) {
      return;
    }

    setSiteSettingsSaving(true);
    setSiteSettingsError(null);
    try {
      const response = await saveAdminSiteSettings({
        ...siteSettingsDraft,
        homeHeroImages: siteSettingsDraft.homeHeroImages
          .map(image => ({
            ...image,
            imageUrl: image.imageUrl.trim(),
            mobileImageUrl: image.mobileImageUrl?.trim() ?? '',
            alt: image.alt?.trim() ?? '',
          }))
          .filter(image => image.imageUrl),
      });
      setSiteSettingsDraft(normalizeSiteSettingsDraft(response.settings));
      setSiteSettingsLoaded(true);
      addToast(
        t('admin.siteSettingsSaved', { defaultValue: 'Site settings saved.' }),
        'success',
      );
    } catch (error) {
      console.error('Failed to save site settings', error);
      const message = getAdminLoadErrorMessage(
        error,
        'admin.siteSettingsSaveFailed',
        'Failed to save site settings.',
      );
      setSiteSettingsError(message);
      addToast(message, 'error');
    } finally {
      setSiteSettingsSaving(false);
    }
  }, [
    addToast,
    canManageSiteSettings,
    getAdminLoadErrorMessage,
    siteSettingsDraft,
    t,
  ]);

  const navigateToAdminTab = useCallback(
    (tabId: TabKey) => {
      setActiveTab(tabId);
      const nextParams = new URLSearchParams(searchParams);
      if (tabId === 'overview') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', tabId);
      }
      nextParams.delete('focus');
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const showBrowserNotification = useCallback((notification: AdminNotification) => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    const browserNotification = new Notification(notification.title, {
      body: notification.message,
      tag: notification.id,
    });
    browserNotification.onclick = () => {
      window.focus();
      navigate(notification.href);
      browserNotification.close();
    };
  }, [navigate]);

  const loadAdminNotificationFeed = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!canReadAdminNotifications) {
        return;
      }

      if (
        adminNotificationsPausedUntil &&
        Date.now() < adminNotificationsPausedUntil
      ) {
        return;
      }

      if (!silent) {
        setAdminNotificationsLoading(true);
      }
      setAdminNotificationsError(null);

      try {
        const response = await listAdminNotifications();
        setAdminNotificationsPausedUntil(null);
        const previousIds = notificationKnownIdsRef.current;
        const incomingIds = new Set(response.notifications.map(notification => notification.id));
        const newNotifications = response.notifications.filter(notification => !previousIds.has(notification.id));

        setAdminNotifications(response.notifications);
        notificationKnownIdsRef.current = incomingIds;

        if (notificationInitialLoadRef.current && browserNotificationEnabled) {
          newNotifications.slice(0, 3).forEach(showBrowserNotification);
        }

        notificationInitialLoadRef.current = true;
      } catch (error) {
        if (isFunctionQuotaExceededError(error)) {
          console.warn('Admin notification loading paused because Firestore quota is exhausted.', error);
          setAdminNotificationsPausedUntil(Date.now() + 15 * 60 * 1000);
        } else {
          console.error('Failed to load admin notifications:', error);
        }
        setAdminNotificationsError(getAdminLoadErrorMessage(
          error,
          'admin.notificationsLoadFailed',
          'Failed to load admin notifications.',
        ));
      } finally {
        setAdminNotificationsLoading(false);
      }
    },
    [
      adminNotificationsPausedUntil,
      browserNotificationEnabled,
      canReadAdminNotifications,
      getAdminLoadErrorMessage,
      showBrowserNotification,
    ],
  );

  const requestBrowserNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      addToast(
        t('admin.browserNotificationsUnsupported', {
          defaultValue: 'This browser does not support browser notifications.',
        }),
        'error',
      );
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      window.localStorage.setItem('adminBrowserNotifications', 'enabled');
      setBrowserNotificationEnabled(true);
      addToast(
        t('admin.browserNotificationsEnabled', {
          defaultValue: 'Browser notifications are enabled while this dashboard is open.',
        }),
        'success',
      );
      return;
    }

    window.localStorage.removeItem('adminBrowserNotifications');
    setBrowserNotificationEnabled(false);
    addToast(
      t('admin.browserNotificationsDenied', {
        defaultValue: 'Browser notifications were not enabled.',
      }),
      'info',
    );
  }, [addToast, t]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const visibleTabIds = new Set(tabs.map(tab => tab.id));
    if (isTabKey(requestedTab) && visibleTabIds.has(requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }

    const requestedDealerFilter = searchParams.get('dealerFilter');
    if (
      requestedDealerFilter &&
      (DEALER_FILTER_KEYS as readonly string[]).includes(requestedDealerFilter)
    ) {
      setDealerFilter(requestedDealerFilter as DealerFilterKey);
    }

    const requestedModelFilter = searchParams.get('modelFilter');
    if (
      requestedModelFilter &&
      (MODEL_FILTER_KEYS as readonly string[]).includes(requestedModelFilter)
    ) {
      setModelFilter(requestedModelFilter as (typeof MODEL_FILTER_KEYS)[number]);
    }

    const requestedBlogFilter = searchParams.get('blogFilter');
    if (
      requestedBlogFilter &&
      (BLOG_FILTER_KEYS as readonly string[]).includes(requestedBlogFilter)
    ) {
      setBlogFilter(requestedBlogFilter as (typeof BLOG_FILTER_KEYS)[number]);
    }

    const requestedStationFilter = searchParams.get('stationFilter');
    if (
      requestedStationFilter &&
      (STATION_FILTER_KEYS as readonly string[]).includes(requestedStationFilter)
    ) {
      setStationFilter(requestedStationFilter as (typeof STATION_FILTER_KEYS)[number]);
    }
  }, [activeTab, searchParams, tabs]);

  useEffect(() => {
    if (!canReadAdminNotifications) {
      return;
    }

    void loadAdminNotificationFeed();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadAdminNotificationFeed({ silent: true });
      }
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [canReadAdminNotifications, loadAdminNotificationFeed]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to logout', error);
    }
  };

  const closeAllModals = () => {
    setDealerFormState(null);
    setModelFormState(null);
    setBlogFormState(null);
    setStationFormState(null);
    setPlacementZoneFormState(null);
    setSponsorshipProductFormState(null);
    setSponsorshipOrderFormState(null);
    setPromotionalCampaignFormState(null);
  };

  const loadPlacementsCatalog = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!canReadPlacements) {
        return;
      }

      if (!silent) {
        setPlacementsLoading(true);
      }
      setPlacementsError(null);
      try {
        const response = await listAdminPlacements();
        setPlacementZones(response.zones);
        setSponsorshipProducts(response.products);
        setSponsorshipOrders(response.orders);
        setPlacementAvailability(response.availability);
        setPromotionalCampaigns(response.campaigns);
        setPlacementsLoaded(true);
      } catch (error) {
        if (isFunctionQuotaExceededError(error)) {
          console.warn('Placements catalog could not load because Firestore quota is exhausted.', error);
        } else {
          console.error('Failed to load placements catalog', error);
        }
        setPlacementsError(getAdminLoadErrorMessage(
          error,
          'admin.placementsLoadFailed',
          'Failed to load placements management data.',
        ));
      } finally {
        if (!silent) {
          setPlacementsLoading(false);
        }
      }
    },
    [canReadPlacements, getAdminLoadErrorMessage],
  );

  const loadPlacementAnalytics = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!canReadPlacementAnalytics) {
        return;
      }

      if (!silent) {
        setPlacementAnalyticsLoading(true);
      }
      setPlacementAnalyticsError(null);
      try {
        const response = await listAdminPlacementAnalytics({
          days: placementAnalyticsFilters.days,
          zoneKey: placementAnalyticsFilters.zoneKey ?? undefined,
        });
        setPlacementAnalytics(response.analytics);
        setPlacementZoneAnalytics(response.zones);
        setPlacementDailyAnalytics(response.daily);
        setPlacementAnalyticsFilters(response.filters);
        setPlacementAnalyticsLoaded(true);
      } catch (error) {
        if (isFunctionQuotaExceededError(error)) {
          console.warn('Placement analytics could not load because Firestore quota is exhausted.', error);
        } else {
          console.error('Failed to load placement analytics', error);
        }
        setPlacementAnalyticsError(getAdminLoadErrorMessage(
          error,
          'admin.placementsAnalyticsLoadFailed',
          'Failed to load placement analytics.',
        ));
      } finally {
        if (!silent) {
          setPlacementAnalyticsLoading(false);
        }
      }
    },
    [
      canReadPlacementAnalytics,
      getAdminLoadErrorMessage,
      placementAnalyticsFilters.days,
      placementAnalyticsFilters.zoneKey,
    ],
  );

  const handlePlacementBootstrap = useCallback(async () => {
    if (!canOverridePlacements) {
      return;
    }

    setPlacementBootstrapLoading(true);
    setPlacementsError(null);
    try {
      const response = await bootstrapAdminPlacements();
      await Promise.all([
        loadPlacementsCatalog({ silent: true }),
        loadPlacementAnalytics({ silent: true }),
      ]);
      addToast(
        t('admin.placementsBootstrapSuccess', {
          defaultValue:
            'Placement inventory initialized. Zones: {{zonesCreated}} created, {{zonesUpdated}} updated. Products: {{productsCreated}} created, {{productsUpdated}} updated.',
          zonesCreated: response.zones.created,
          zonesUpdated: response.zones.updated,
          productsCreated: response.products.created,
          productsUpdated: response.products.updated,
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to bootstrap placements inventory', error);
      const message =
        error instanceof Error
          ? error.message
          : t('admin.placementsBootstrapFailed', {
              defaultValue: 'Failed to initialize the placements inventory.',
            });
      setPlacementsError(message);
      addToast(message, 'error');
    } finally {
      setPlacementBootstrapLoading(false);
    }
  }, [addToast, canOverridePlacements, loadPlacementAnalytics, loadPlacementsCatalog, t]);

  const handleRefreshPlacements = useCallback(async () => {
    await Promise.all([
      loadPlacementsCatalog(),
      loadPlacementAnalytics(),
    ]);
  }, [loadPlacementAnalytics, loadPlacementsCatalog]);

  const handlePlacementAnalyticsFilterChange = useCallback(
    (updates: Partial<PlacementAnalyticsFilters>) => {
      setPlacementAnalyticsFilters(prev => ({
        days: typeof updates.days === 'number' ? updates.days : prev.days,
        zoneKey: updates.zoneKey === undefined ? prev.zoneKey ?? null : updates.zoneKey,
      }));
      setPlacementAnalyticsError(null);
      setPlacementAnalyticsLoaded(false);
    },
    [],
  );

  const handlePlacementAnalyticsExport = useCallback(() => {
    if (!canReadPlacementAnalytics) {
      return;
    }

    if (!placementAnalytics.length) {
      addToast(
        t('admin.noPlacementAnalyticsToExport', {
          defaultValue: 'There is no placement analytics data to export for the current view.',
        }),
        'error',
      );
      return;
    }

    setPlacementAnalyticsExporting(true);
    try {
      const zoneNameById = placementZones.reduce<Record<string, string>>((acc, zone) => {
        acc[zone.id] = zone.name;
        return acc;
      }, {});
      const selectedZoneName = placementAnalyticsFilters.zoneKey
        ? placementZones.find(zone => zone.key === placementAnalyticsFilters.zoneKey)?.name ??
          placementAnalyticsFilters.zoneKey
        : t('admin.allZonesLabel', { defaultValue: 'All zones' });
      const headers = [
        'Campaign Name',
        'Campaign ID',
        'Promotion Type',
        'Status',
        'Range Days',
        'Zone Filter',
        'Assigned Zones',
        'Impressions',
        'Clicks',
        'CTR',
        'Last Impression',
        'Last Click',
      ];
      const campaignById = promotionalCampaigns.reduce<Record<string, PromotionalCampaign>>(
        (acc, campaign) => {
          acc[campaign.id] = campaign;
          return acc;
        },
        {},
      );
      const lines = [
        headers.map(escapeCsvValue).join(','),
        ...placementAnalytics.map(entry => {
          const campaign = campaignById[entry.campaignId];
          const assignedZones = campaign?.zoneIds
            ?.map(zoneId => zoneNameById[zoneId] ?? zoneId)
            .join(' | ') ?? '';

          return [
            campaign?.name ?? entry.campaignId,
            entry.campaignId,
            campaign?.promotionType ?? '',
            campaign?.status ?? '',
            placementAnalyticsFilters.days,
            selectedZoneName,
            assignedZones,
            entry.impressions,
            entry.clicks,
            entry.ctr.toFixed(2),
            entry.lastImpressionAt ?? '',
            entry.lastClickAt ?? '',
          ]
            .map(escapeCsvValue)
            .join(',');
        }),
      ];

      const blob = new Blob([lines.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const safeZoneKey = (placementAnalyticsFilters.zoneKey ?? 'all-zones').replace(/[^a-z0-9_-]+/gi, '-');
      const fileName = `placement-analytics-${placementAnalyticsFilters.days}d-${safeZoneKey}.csv`;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      addToast(
        t('admin.placementAnalyticsExportSuccess', {
          defaultValue: 'Placement analytics export prepared for download.',
        }),
        'success',
      );
    } finally {
      setPlacementAnalyticsExporting(false);
    }
  }, [
    addToast,
    canReadPlacementAnalytics,
    placementAnalytics,
    placementAnalyticsFilters.days,
    placementAnalyticsFilters.zoneKey,
    placementZones,
    promotionalCampaigns,
    t,
  ]);

  const getBulkModalTitle = (entity: BulkImportEntity) => {
    switch (entity) {
      case 'dealers':
        return t('admin.bulkUploadDealers', { defaultValue: 'Bulk upload dealers' });
      case 'models':
        return t('admin.bulkUploadModels', { defaultValue: 'Bulk upload models' });
      case 'blog':
      default:
        return t('admin.bulkUploadPosts', { defaultValue: 'Bulk upload blog posts' });
    }
  };

  const deriveStatus = useCallback(
    (dealer: Dealer): DealerStatus => {
      if (dealer.status === 'approved' || (dealer.status as string) === 'active') {
        return 'approved';
      }
      if (dealer.status) {
        return dealer.status;
      }
      if (dealer.approved === false) {
        return dealer.rejectedAt ? 'rejected' : 'pending';
      }
      return 'approved';
    },
    [],
  );

  const dealerStatusBuckets = useMemo<Record<DealerFilterKey, Dealer[]>>(() => {
    return dealers.reduce(
      (acc, dealer) => {
        const status = deriveStatus(dealer);
        const isDeleted = dealer.isDeleted === true;
        const isActive = dealer.isActive !== false;

        if (isDeleted) {
          acc.deleted.push(dealer);
          return acc;
        }

        if (status === 'pending') {
          acc.pending.push(dealer);
          return acc;
        }

        if (status === 'approved' && isActive) {
          acc.active.push(dealer);
          return acc;
        }

        acc.inactive.push(dealer);
        return acc;
      },
      {
        active: [],
        inactive: [],
        pending: [],
        deleted: [],
      } as Record<DealerFilterKey, Dealer[]>,
    );
  }, [dealers, deriveStatus]);

  const dealerCounts = useMemo(
    () => ({
      active: dealerStatusBuckets.active.length,
      inactive: dealerStatusBuckets.inactive.length,
      pending: dealerStatusBuckets.pending.length,
      deleted: dealerStatusBuckets.deleted.length,
    }),
    [dealerStatusBuckets],
  );

  const filteredDealers = useMemo(() => {
    const q = String(searchQuery || '').toLowerCase();
    return dealerStatusBuckets[dealerFilter]
      .filter(dealer => 
        String(dealer.name || '').toLowerCase().includes(q) ||
        String(dealer.email || '').toLowerCase().includes(q)
      )
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [dealerFilter, dealerStatusBuckets, searchQuery]);

  const filteredModels = useMemo(() => {
    const q = String(searchQuery || '').toLowerCase();
    return models
      .filter(model => {
        const matchesSearch = 
          String(model.model_name || '').toLowerCase().includes(q) ||
          String(model.brand || '').toLowerCase().includes(q);
        
        let matchesFilter = true;
        if (modelFilter === 'featured') matchesFilter = model.isFeatured;
        else if (modelFilter === 'visible') matchesFilter = model.isActive !== false;
        else if (modelFilter === 'hidden') matchesFilter = model.isActive === false;

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [models, searchQuery, modelFilter]);

  const filteredBlogPosts = useMemo(() => {
    const q = String(searchQuery || '').toLowerCase();
    return blogPosts
      .filter(post => {
        // Use String() coercion to guard against object-valued fields (e.g., multilingual title stored as {en, it})
        const title = typeof post.title === 'string' ? post.title : String(post.title ?? '');
        const author = typeof post.author === 'string' ? post.author : String(post.author ?? '');
        const excerpt = typeof post.excerpt === 'string' ? post.excerpt : String(post.excerpt ?? '');
        const matchesSearch = 
          title.toLowerCase().includes(q) ||
          author.toLowerCase().includes(q) ||
          excerpt.toLowerCase().includes(q);
        
        let matchesFilter = true;
        if (blogFilter === 'published') matchesFilter = post.status === 'published';
        else if (blogFilter === 'draft') matchesFilter = post.status === 'draft';

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        // Simple sort by createdAt if available
        const getSeconds = (val: any) => {
          if (!val) return 0;
          if (val.seconds) return val.seconds;
          if (val instanceof Date) return val.getTime() / 1000;
          return 0;
        };
        return getSeconds(b.createdAt) - getSeconds(a.createdAt);
      });
  }, [blogPosts, searchQuery, blogFilter]);

  const filteredStations = useMemo(() => {
    const q = String(searchQuery || '').toLowerCase();
    return stations.filter((station) => {
      const matchesSearch =
        String(station.address || '').toLowerCase().includes(q) ||
        String(station.operator || '').toLowerCase().includes(q);
      
      let matchesFilter = true;
      if (stationFilter === 'active') matchesFilter = station.isActive !== false;
      else if (stationFilter === 'inactive') matchesFilter = station.isActive === false;

      return matchesSearch && matchesFilter;
    })
      .sort((a, b) => String(a.address || '').localeCompare(String(b.address || '')));
  }, [stations, searchQuery, stationFilter]);

  const listingCounts = useMemo(() => {
    const counts = {
      total: listings.length,
      pending: 0,
      approved: 0,
      active: 0,
      inactive: 0,
      rejected: 0,
      deleted: 0,
      featured: 0,
      withGallery: 0,
    };

    for (const listing of listings) {
      counts[listing.status] += 1;
      if (listing.isFeatured) {
        counts.featured += 1;
      }
      if ((listing.imageGallery ?? []).filter(Boolean).length > 0) {
        counts.withGallery += 1;
      }
    }

    return counts;
  }, [listings]);

  const modelCounts = useMemo(() => {
    const counts = {
      total: models.length,
      active: 0,
      hidden: 0,
      featured: 0,
      missingHero: 0,
      missingGallery: 0,
    };

    for (const model of models) {
      if (model.isActive === false) {
        counts.hidden += 1;
      } else {
        counts.active += 1;
      }
      if (model.isFeatured) {
        counts.featured += 1;
      }
      if (!String(model.image_url ?? '').trim()) {
        counts.missingHero += 1;
      }
      if ((model.imageGallery ?? []).filter(Boolean).length === 0) {
        counts.missingGallery += 1;
      }
    }

    return counts;
  }, [models]);

  const blogCounts = useMemo(() => {
    const counts = {
      total: blogPosts.length,
      published: 0,
      draft: 0,
      missingImage: 0,
      missingMetaDescription: 0,
    };

    for (const post of blogPosts) {
      if (post.status === 'published') {
        counts.published += 1;
      } else {
        counts.draft += 1;
      }
      if (!String(post.imageUrl ?? '').trim()) {
        counts.missingImage += 1;
      }
      if (!String(post.metaDescription ?? '').trim()) {
        counts.missingMetaDescription += 1;
      }
    }

    return counts;
  }, [blogPosts]);

  const stationCounts = useMemo(() => {
    const counts = {
      total: stations.length,
      active: 0,
      inactive: 0,
      missingCoordinates: 0,
      missingMapLinks: 0,
    };

    for (const station of stations) {
      if (station.isActive === false) {
        counts.inactive += 1;
      } else {
        counts.active += 1;
      }
      if (station.latitude == null || station.longitude == null) {
        counts.missingCoordinates += 1;
      }
      if (!String(station.googleMapsLink ?? '').trim()) {
        counts.missingMapLinks += 1;
      }
    }

    return counts;
  }, [stations]);

  const dealerPlanCounts = useMemo(() => {
    const counts = {
      free: 0,
      paid: 0,
      paused: 0,
      expired: 0,
      cancelled: 0,
      featured: 0,
      missingMedia: 0,
    };

    for (const dealer of dealers) {
      if ((dealer.planId ?? 'free') === 'paid') {
        counts.paid += 1;
      } else {
        counts.free += 1;
      }

      if (dealer.subscriptionStatus === 'paused') {
        counts.paused += 1;
      } else if (dealer.subscriptionStatus === 'expired') {
        counts.expired += 1;
      } else if (dealer.subscriptionStatus === 'cancelled') {
        counts.cancelled += 1;
      }

      if (dealer.isFeatured) {
        counts.featured += 1;
      }
      if (!String(dealer.logo_url ?? dealer.image_url ?? '').trim()) {
        counts.missingMedia += 1;
      }
    }

    return counts;
  }, [dealers]);

  const placementCounts = useMemo(
    () => ({
      zones: placementZones.length,
      activeZones: placementZones.filter(zone => zone.status === 'active').length,
      products: sponsorshipProducts.length,
      activeProducts: sponsorshipProducts.filter(product => product.status === 'active').length,
      orders: sponsorshipOrders.length,
      reservedOrders: sponsorshipOrders.filter(order => order.status === 'reserved').length,
      activeOrders: sponsorshipOrders.filter(order => order.status === 'active').length,
      campaigns: promotionalCampaigns.length,
      liveCampaigns: promotionalCampaigns.filter(isPromotionalCampaignPubliclyResolvable).length,
      blockedZones: placementAvailability.filter(
        summary => summary.blockingCampaignIds.length > 0 || summary.blockingOrderIds.length > 0,
      ).length,
    }),
    [placementAvailability, placementZones, promotionalCampaigns, sponsorshipOrders, sponsorshipProducts],
  );

  const topDealerCities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const dealer of dealers) {
      const city = String(dealer.city ?? '').trim();
      if (!city) {
        continue;
      }
      counts.set(city, (counts.get(city) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [dealers]);

  const topStationOperators = useMemo(() => {
    const counts = new Map<string, number>();
    for (const station of stations) {
      const operator = String(station.operator ?? '').trim() || 'Unassigned';
      counts.set(operator, (counts.get(operator) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [stations]);

  const reportTrendDays = 14;
  const reportTrendBuckets = useMemo(() => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (reportTrendDays - 1));

    const buckets = Array.from({ length: reportTrendDays }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return {
        dateKey: toDayKey(date),
        label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        dealers: 0,
        listings: 0,
        blogPosts: 0,
        audit: 0,
      };
    });

    const bucketByKey = new Map(buckets.map(bucket => [bucket.dateKey, bucket]));
    const bump = (value: unknown, field: 'dealers' | 'listings' | 'blogPosts' | 'audit') => {
      const date = coerceDate(value);
      if (!date) {
        return;
      }
      const bucket = bucketByKey.get(toDayKey(date));
      if (!bucket) {
        return;
      }
      bucket[field] += 1;
    };

    dealers.forEach(item => bump(item.createdAt, 'dealers'));
    listings.forEach(item => bump(item.createdAt, 'listings'));
    blogPosts.forEach(item => bump(item.createdAt, 'blogPosts'));
    auditLogs.forEach(item => bump(item.createdAt, 'audit'));

    return buckets;
  }, [auditLogs, blogPosts, dealers, listings]);

  const reportQualityHighlights = useMemo(
    () => [
      {
        key: 'dealerMedia',
        label: t('admin.reportQualityDealerMedia', { defaultValue: 'Dealers missing profile media' }),
        value: dealerPlanCounts.missingMedia,
        supporting: t('admin.reportQualityDealerMediaHint', {
          defaultValue: '{{count}} dealer profiles still need a hero or logo image.',
          count: dealerPlanCounts.missingMedia,
        }),
      },
      {
        key: 'modelHero',
        label: t('admin.reportQualityModelHero', { defaultValue: 'Models missing hero image' }),
        value: modelCounts.missingHero,
        supporting: t('admin.reportQualityModelHeroHint', {
          defaultValue: '{{count}} model records still need a primary image.',
          count: modelCounts.missingHero,
        }),
      },
      {
        key: 'listingGallery',
        label: t('admin.reportQualityListingGallery', { defaultValue: 'Listings without gallery images' }),
        value: Math.max(0, listingCounts.total - listingCounts.withGallery),
        supporting: t('admin.reportQualityListingGalleryHint', {
          defaultValue: '{{count}} live or draft listings still have no gallery media.',
          count: Math.max(0, listingCounts.total - listingCounts.withGallery),
        }),
      },
      {
        key: 'blogMeta',
        label: t('admin.reportQualityBlogMeta', { defaultValue: 'Blog posts missing metadata' }),
        value: blogCounts.missingMetaDescription,
        supporting: t('admin.reportQualityBlogMetaHint', {
          defaultValue: '{{count}} blog entries are missing a meta description.',
          count: blogCounts.missingMetaDescription,
        }),
      },
      {
        key: 'stationCoords',
        label: t('admin.reportQualityStationCoords', { defaultValue: 'Stations missing coordinates' }),
        value: stationCounts.missingCoordinates,
        supporting: t('admin.reportQualityStationCoordsHint', {
          defaultValue: '{{count}} charging stations still need latitude/longitude.',
          count: stationCounts.missingCoordinates,
        }),
      },
    ],
    [blogCounts.missingMetaDescription, dealerPlanCounts.missingMedia, listingCounts.total, listingCounts.withGallery, modelCounts.missingHero, stationCounts.missingCoordinates, t],
  );

  const recentAuditHighlights = useMemo(() => auditLogs.slice(0, 8), [auditLogs]);
  const adminNotificationCount = adminNotifications.length;

  const isAdmin = role === 'admin';
  const canAssignDealerPlans =
    hasPermission('dealer_plans.assign') || hasPermission('dealer_plans.override');
  const adminRoleOptions = useMemo(
    () =>
      (Object.entries(ADMIN_ROLE_PRESETS) as Array<
        [AdminRoleId, (typeof ADMIN_ROLE_PRESETS)[AdminRoleId]]
      >).filter(([roleId]) => isMasterAdmin || roleId !== 'master_admin'),
    [isMasterAdmin],
  );
  const permissionGroups = useMemo(() => {
    const grouped = PERMISSION_KEYS.reduce<Record<string, PermissionKey[]>>((acc, permission) => {
      const [group] = permission.split('.');
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(permission);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([left], [right]) => formatPermissionGroupLabel(left).localeCompare(formatPermissionGroupLabel(right)))
      .map(([group, permissions]) => ({
        group,
        label: formatPermissionGroupLabel(group),
        permissions,
      }));
  }, []);

  useEffect(() => {
    if (!canReadUsers && activeTab === 'users') {
      setActiveTab('overview');
    }
  }, [activeTab, canReadUsers]);

  useEffect(() => {
    if (!canReadListings && activeTab === 'listings') {
      setActiveTab('overview');
    }
  }, [activeTab, canReadListings]);

  useEffect(() => {
    if (!canManageAdminAccess && activeTab === 'access') {
      setActiveTab('overview');
    }
  }, [activeTab, canManageAdminAccess]);

  useEffect(() => {
    if (!canViewAudit && activeTab === 'audit') {
      setActiveTab('overview');
    }
  }, [activeTab, canViewAudit]);

  useEffect(() => {
    if (!canViewReports && activeTab === 'reports') {
      setActiveTab('overview');
    }
  }, [activeTab, canViewReports]);

  useEffect(() => {
    if (!canManageSiteSettings && activeTab === 'settings') {
      setActiveTab('overview');
    }
  }, [activeTab, canManageSiteSettings]);

  useEffect(() => {
    if (!canReadAnnouncements && activeTab === 'engagement') {
      setActiveTab('overview');
    }
  }, [activeTab, canReadAnnouncements]);

  const getDealerPlanDraft = useCallback(
    (dealer: Dealer): DealerPlanDraft => ({
      planId: dealer.planId ?? 'free',
      subscriptionStatus: dealer.subscriptionStatus ?? 'active',
    }),
    [],
  );

  const updateDealerPlanDraft = useCallback(
    (dealer: Dealer, updates: Partial<DealerPlanDraft>) => {
      setDealerPlanDrafts(prev => ({
        ...prev,
        [dealer.id]: {
          ...getDealerPlanDraft(dealer),
          ...prev[dealer.id],
          ...updates,
        },
      }));
    },
    [getDealerPlanDraft],
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('admin.dashboardMetaTitle'),
    description: t('admin.dashboardMetaDescription'),
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    url: `${BASE_URL}/admin/`,
  };

  const handleDealerStatusAction = async (
    dealerId: string,
    action: 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'delete',
  ) => {
    if (!isAdmin) {
      return;
    }

    setDealerAction({ id: dealerId, type: action });
    try {
      await updateAdminDealerStatus(dealerId, action);
    } catch (error) {
      console.error(`Failed to ${action} dealer`, error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.dealerStatusUpdateFailed', {
              defaultValue: 'Failed to update dealer status.',
            });
      addToast(errorMessage, 'error');
    } finally {
      setDealerAction(null);
    }
  };

  const handleApproveDealer = async (dealerId: string) => {
    await handleDealerStatusAction(dealerId, 'approve');
  };

  const handleDealerPlanUpdate = useCallback(
    async (dealer: Dealer) => {
      if (!canAssignDealerPlans) {
        addToast(
          t('admin.dealerPlanPermissionDenied', {
            defaultValue: 'You do not have permission to assign dealer plans.',
          }),
          'error',
        );
        return;
      }

      const dealerPlanDraft = dealerPlanDrafts[dealer.id] ?? getDealerPlanDraft(dealer);
      const currentPlanId = dealer.planId ?? 'free';
      const currentSubscriptionStatus = dealer.subscriptionStatus ?? 'active';
      const isDirty =
        dealerPlanDraft.planId !== currentPlanId ||
        dealerPlanDraft.subscriptionStatus !== currentSubscriptionStatus;

      if (!isDirty) {
        addToast(
          t('admin.dealerPlanNoChanges', {
            defaultValue: 'No dealer plan changes to save.',
          }),
          'info',
        );
        return;
      }

      setDealerPlanUpdatingId(dealer.id);
      try {
        await updateDealerPlanAssignment({
          dealerId: dealer.id,
          planId: dealerPlanDraft.planId,
          subscriptionStatus: dealerPlanDraft.subscriptionStatus,
        });
        setDealerPlanDrafts(prev => {
          const next = { ...prev };
          delete next[dealer.id];
          return next;
        });
        addToast(
          t('admin.dealerPlanUpdated', {
            defaultValue: 'Dealer plan updated successfully.',
          }),
          'success',
        );
      } catch (error) {
        console.error('Failed to update dealer plan', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.dealerPlanUpdateFailed', {
                defaultValue: 'Failed to update dealer plan.',
              });
        addToast(errorMessage, 'error');
      } finally {
        setDealerPlanUpdatingId(null);
      }
    },
    [addToast, canAssignDealerPlans, dealerPlanDrafts, getDealerPlanDraft, t],
  );

  const handleUserAdminLookup = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();

      if (!canReadUsers) {
        addToast(
          t('admin.userLookupPermissionDenied', {
            defaultValue: 'You do not have permission to read user accounts.',
          }),
          'error',
        );
        return;
      }

      const query = userAdminQuery.trim();
      if (!query) {
        setUserAdminLookupError(
          t('admin.userLookupRequired', {
            defaultValue: 'Enter a user email or UID to continue.',
          }),
        );
        setUserAdminResult(null);
        return;
      }

      setUserAdminLookupLoading(true);
      setUserAdminLookupError(null);
      try {
        const result = await lookupAdminUser(query);
        setUserAdminResult(result);
        setUserAdminNoteDraft('');
      } catch (error) {
        console.error('Failed to look up user account', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.userLookupFailed', {
                defaultValue: 'Failed to look up the requested user account.',
              });
        setUserAdminLookupError(errorMessage);
        setUserAdminResult(null);
      } finally {
        setUserAdminLookupLoading(false);
      }
    },
    [addToast, canReadUsers, t, userAdminQuery],
  );

  const refreshUserAdminResult = useCallback(
    async (uid: string) => {
      const refreshed = await lookupAdminUser(uid);
      setUserAdminResult(refreshed);
      return refreshed;
    },
    [],
  );

  const handleUserStatusChange = useCallback(
    async (accountStatus: 'active' | 'suspended') => {
      if (!userAdminResult) {
        return;
      }

      const permissionAllowed =
        accountStatus === 'suspended' ? canSuspendUsers : canReactivateUsers;
      if (!permissionAllowed) {
        addToast(
          t('admin.userStatusPermissionDenied', {
            defaultValue: 'You do not have permission to change this account status.',
          }),
          'error',
        );
        return;
      }

      setUserAdminActionLoading(true);
      try {
        await updateAdminUserStatus(userAdminResult.uid, accountStatus);
        await refreshUserAdminResult(userAdminResult.uid);
        addToast(
          t(
            accountStatus === 'suspended'
              ? 'admin.userSuspended'
              : 'admin.userReactivated',
            {
              defaultValue:
                accountStatus === 'suspended'
                  ? 'User account suspended successfully.'
                  : 'User account reactivated successfully.',
            },
          ),
          'success',
        );
      } catch (error) {
        console.error('Failed to update user status', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.userStatusUpdateFailed', {
                defaultValue: 'Failed to update the account status.',
              });
        addToast(errorMessage, 'error');
      } finally {
        setUserAdminActionLoading(false);
      }
    },
    [addToast, canReactivateUsers, canSuspendUsers, refreshUserAdminResult, t, userAdminResult],
  );

  const loadAuditLogs = useCallback(
    async (force = false) => {
      if (!canViewAudit) {
        return;
      }

      if (auditLoading) {
        return;
      }

      if (auditLoaded && !force) {
        return;
      }

      if (auditError && !force) {
        return;
      }

      setAuditLoading(true);
      setAuditError(null);
      try {
        const logs = await listAdminAuditLogs(50);
        setAuditLogs(logs);
        setAuditLoaded(true);
      } catch (error) {
        if (isFunctionQuotaExceededError(error)) {
          console.warn('Audit logs could not load because Firestore quota is exhausted.', error);
        } else {
          console.error('Failed to load admin audit logs', error);
        }
        setAuditError(getAdminLoadErrorMessage(
          error,
          'admin.auditLogLoadFailed',
          'Failed to load the audit log.',
        ));
      } finally {
        setAuditLoading(false);
      }
    },
    [auditError, auditLoaded, auditLoading, canViewAudit, getAdminLoadErrorMessage],
  );

  useEffect(() => {
    if ((activeTab === 'audit' || activeTab === 'overview' || activeTab === 'reports') && canViewAudit) {
      void loadAuditLogs();
    }
  }, [activeTab, canViewAudit, loadAuditLogs]);

  useEffect(() => {
    if (activeTab === 'settings' && canManageSiteSettings) {
      void loadSiteSettings();
    }
  }, [activeTab, canManageSiteSettings, loadSiteSettings]);

  const hydrateAdminAccessDraft = useCallback((result: AdminAccessLookupResult) => {
    setAdminAccessRoleDraftIds(result.adminRoleIds ?? []);
    setAdminAccessStatusDraft(result.accountStatus ?? 'active');
    setAdminAccessDirectPermissionDraft(result.directPermissions ?? {});
  }, []);

  const selectAdminAccessTarget = useCallback(
    (result: AdminAccessLookupResult) => {
      setAdminAccessResult(result);
      setAdminAccessQuery(result.email ?? result.uid);
      setAdminAccessLookupError(null);
      hydrateAdminAccessDraft(result);
    },
    [hydrateAdminAccessDraft],
  );

  const loadAdminAccessRoster = useCallback(
    async (force = false) => {
      if (!canManageAdminAccess) {
        return;
      }

      if (adminRosterLoading || (!force && adminRosterLoaded)) {
        return;
      }

      setAdminRosterLoading(true);
      setAdminRosterError(null);
      try {
        const admins = await listAdminAccessRoster();
        setAdminRoster(admins);
        setAdminRosterLoaded(true);
      } catch (error) {
        console.error('Failed to load admin roster', error);
        setAdminRosterError(
          error instanceof Error
            ? error.message
            : t('admin.adminRosterLoadFailed', {
                defaultValue: 'Failed to load platform admins.',
              }),
        );
      } finally {
        setAdminRosterLoading(false);
      }
    },
    [adminRosterLoaded, adminRosterLoading, canManageAdminAccess, t],
  );

  const handleAdminAccessLookup = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();

      if (!canManageAdminAccess) {
        addToast(
          t('admin.adminAccessPermissionDenied', {
            defaultValue: 'You do not have permission to manage platform admin access.',
          }),
          'error',
        );
        return;
      }

      const query = adminAccessQuery.trim();
      if (!query) {
        setAdminAccessLookupError(
          t('admin.adminAccessLookupRequired', {
            defaultValue: 'Enter a user email or UID to continue.',
          }),
        );
        setAdminAccessResult(null);
        return;
      }

      setAdminAccessLookupLoading(true);
      setAdminAccessLookupError(null);
      try {
        const result = await lookupAdminAccess(query);
        selectAdminAccessTarget(result);
      } catch (error) {
        console.error('Failed to look up admin access target', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.adminAccessLookupFailed', {
                defaultValue: 'Failed to look up the requested account.',
              });
        setAdminAccessLookupError(errorMessage);
        setAdminAccessResult(null);
      } finally {
        setAdminAccessLookupLoading(false);
      }
    },
    [addToast, adminAccessQuery, canManageAdminAccess, selectAdminAccessTarget, t],
  );

  const toggleAdminAccessRoleDraft = useCallback(
    (roleId: AdminRoleId) => {
      if (roleId === 'master_admin' && !isMasterAdmin) {
        return;
      }

      setAdminAccessRoleDraftIds(prev =>
        prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId],
      );
    },
    [isMasterAdmin],
  );

  const setAdminAccessDirectPermissionOverride = useCallback(
    (permission: PermissionKey, nextValue: PermissionOverrideOption) => {
      if (!isMasterAdmin) {
        return;
      }

      setAdminAccessDirectPermissionDraft(prev => {
        const nextDraft = { ...prev };

        if (nextValue === 'inherit') {
          delete nextDraft[permission];
        } else {
          nextDraft[permission] = nextValue === 'allow';
        }

        return nextDraft;
      });
    },
    [isMasterAdmin],
  );

  const handleAdminAccessSave = useCallback(async () => {
    if (!canManageAdminAccess || !adminAccessResult) {
      return;
    }

    setAdminAccessSaving(true);
    try {
      await updateAdminAccess({
        uid: adminAccessResult.uid,
        adminRoleIds: adminAccessRoleDraftIds,
        accountStatus: adminAccessStatusDraft,
        ...(isMasterAdmin ? { directPermissions: adminAccessDirectPermissionDraft } : {}),
      });
      const refreshed = await lookupAdminAccess(adminAccessResult.uid);
      selectAdminAccessTarget(refreshed);
      void loadAdminAccessRoster(true);
      addToast(
        t('admin.adminAccessUpdated', {
          defaultValue: 'Platform admin access updated successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to update admin access', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.adminAccessUpdateFailed', {
              defaultValue: 'Failed to update platform admin access.',
            });
      addToast(errorMessage, 'error');
    } finally {
      setAdminAccessSaving(false);
    }
  }, [
    addToast,
    adminAccessDirectPermissionDraft,
    adminAccessResult,
    adminAccessRoleDraftIds,
    adminAccessStatusDraft,
    canManageAdminAccess,
    isMasterAdmin,
    loadAdminAccessRoster,
    selectAdminAccessTarget,
    t,
  ]);

  const handleAdminAccessRevoke = useCallback(async () => {
    if (!canManageAdminAccess || !adminAccessResult) {
      return;
    }

    const confirmed = window.confirm(
      t('admin.removeAdminAccessConfirm', {
        defaultValue:
          'Remove all platform-admin access from this account? The user will keep their underlying account but lose platform-admin permissions.',
      }),
    );
    if (!confirmed) {
      return;
    }

    setAdminAccessSaving(true);
    try {
      await updateAdminAccess({
        uid: adminAccessResult.uid,
        adminRoleIds: [],
        accountStatus: adminAccessStatusDraft,
        ...(isMasterAdmin ? { directPermissions: {} } : {}),
      });
      const refreshed = await lookupAdminAccess(adminAccessResult.uid);
      selectAdminAccessTarget(refreshed);
      void loadAdminAccessRoster(true);
      addToast(
        t('admin.adminAccessRevoked', {
          defaultValue: 'Platform admin access removed successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to revoke admin access', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.adminAccessRevokeFailed', {
              defaultValue: 'Failed to remove platform admin access.',
            });
      addToast(errorMessage, 'error');
    } finally {
      setAdminAccessSaving(false);
    }
  }, [
    addToast,
    adminAccessResult,
    adminAccessStatusDraft,
    canManageAdminAccess,
    isMasterAdmin,
    loadAdminAccessRoster,
    selectAdminAccessTarget,
    t,
  ]);

  const loadAdminInvites = useCallback(
    async (force = false) => {
      if (!canInviteAdmins) {
        return;
      }

      if (adminInvitesLoading || (!force && adminInvitesLoaded)) {
        return;
      }

      setAdminInvitesLoading(true);
      setAdminInviteError(null);
      try {
        const invites = await listAdminInvites();
        setAdminInvites(invites);
        setAdminInvitesLoaded(true);
      } catch (error) {
        console.error('Failed to load admin invites', error);
        setAdminInviteError(
          error instanceof Error
            ? error.message
            : t('admin.adminInviteListFailed', {
                defaultValue: 'Failed to load platform admin invites.',
              }),
        );
      } finally {
        setAdminInvitesLoading(false);
      }
    },
    [adminInvitesLoaded, adminInvitesLoading, canInviteAdmins, t],
  );

  useEffect(() => {
    if (activeTab === 'access' && canManageAdminAccess) {
      void loadAdminAccessRoster();
    }
  }, [activeTab, canManageAdminAccess, loadAdminAccessRoster]);

  useEffect(() => {
    if (activeTab === 'access' && canInviteAdmins) {
      void loadAdminInvites();
    }
  }, [activeTab, canInviteAdmins, loadAdminInvites]);

  const toggleAdminInviteRoleDraft = useCallback(
    (roleId: AdminRoleId) => {
      if (roleId === 'master_admin' && !isMasterAdmin) {
        return;
      }

      setAdminInviteRoleDraftIds(prev =>
        prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId],
      );
    },
    [isMasterAdmin],
  );

  const handleCreateAdminInvite = useCallback(async () => {
    if (!canInviteAdmins) {
      setAdminInviteError(
        t('admin.adminInvitePermissionDenied', {
          defaultValue: 'You do not have permission to invite platform admins.',
        }),
      );
      return;
    }

    const email = adminInviteEmail.trim();
    if (!email) {
      setAdminInviteError(
        t('admin.adminInviteEmailRequired', {
          defaultValue: 'Enter an email address before creating an invite.',
        }),
      );
      return;
    }

    if (adminInviteRoleDraftIds.length === 0) {
      setAdminInviteError(
        t('admin.adminInviteRolesRequired', {
          defaultValue: 'Select at least one admin preset for the invite.',
        }),
      );
      return;
    }

    setAdminInviteCreating(true);
    setAdminInviteError(null);
    try {
      const invite = await createAdminInvite({
        email,
        adminRoleIds: adminInviteRoleDraftIds,
      });
      setAdminInvites(prev => [invite, ...prev.filter(entry => entry.id !== invite.id)]);
      setAdminInvitesLoaded(true);
      setAdminInviteEmail('');
      setAdminInviteRoleDraftIds([]);
      addToast(
        t('admin.adminInviteCreated', {
          defaultValue: 'Platform admin invite created successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to create admin invite', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.adminInviteCreateFailed', {
              defaultValue: 'Failed to create the platform admin invite.',
            });
      setAdminInviteError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setAdminInviteCreating(false);
    }
  }, [addToast, adminInviteEmail, adminInviteRoleDraftIds, canInviteAdmins, t]);

  const handleRevokeAdminInvite = useCallback(
    async (inviteId: string) => {
      if (!canInviteAdmins) {
        return;
      }

      setAdminInviteRevokingId(inviteId);
      setAdminInviteError(null);
      try {
        const invite = await revokeAdminInvite(inviteId);
        setAdminInvites(prev => prev.map(entry => (entry.id === invite.id ? invite : entry)));
        addToast(
          t('admin.adminInviteRevoked', {
            defaultValue: 'Platform admin invite revoked.',
          }),
          'success',
        );
      } catch (error) {
        console.error('Failed to revoke admin invite', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.adminInviteRevokeFailed', {
                defaultValue: 'Failed to revoke the platform admin invite.',
              });
        setAdminInviteError(errorMessage);
        addToast(errorMessage, 'error');
      } finally {
        setAdminInviteRevokingId(null);
      }
    },
    [addToast, canInviteAdmins, t],
  );

  const handleCopyInviteLink = useCallback(
    async (invite: AccessInvite) => {
      if (!invite.inviteUrl) {
        return;
      }

      try {
        await navigator.clipboard.writeText(invite.inviteUrl);
        addToast(
          t('admin.inviteLinkCopied', {
            defaultValue: 'Invite link copied.',
          }),
          'success',
        );
      } catch (error) {
        console.error('Failed to copy invite link', error);
        addToast(
          t('admin.inviteLinkCopyFailed', {
            defaultValue: 'Failed to copy the invite link.',
          }),
          'error',
        );
      }
    },
    [addToast, t],
  );

  const handleActivateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activationModalDealer) return;

    const normalizedEmail = activationEmail.trim();
    if (!normalizedEmail) {
      setActivationError(
        t('admin.emailRequired', { defaultValue: 'Email is required.' }),
      );
      return;
    }

    if (activationPassword.length < 6) {
      setActivationError(t('admin.passwordTooShort', { defaultValue: 'Password must be at least 6 characters' }));
      return;
    }

    setIsActivating(true);
    setActivationError(null);

    try {
      await activateAdminDealerAccount({
        dealerId: activationModalDealer.id,
        email: normalizedEmail,
        password: activationPassword,
      });

      addToast(t('admin.activationSuccess', { defaultValue: 'Account activated successfully!' }), 'success');
      setActivationModalDealer(null);
      setActivationPassword('');
      setActivationEmail('');
    } catch (error: unknown) {
      console.error('Failed to activate dealer account:', error);
      let errorMsg =
        error instanceof Error
          ? error.message
          : 'Failed to create account. Please try again.';
      if (error instanceof Error && error.message.includes('already registered')) {
        errorMsg = t('admin.emailAlreadyInUse', { defaultValue: 'This email is already registered.' });
      }
      setActivationError(errorMsg);
    } finally {
      setIsActivating(false);
    }
  };

  const loadDealerControlDetail = useCallback(
    async (dealerId: string) => {
      if (!canReadDealers) {
        return;
      }

      setDealerControlLoading(true);
      setDealerControlError(null);
      try {
        const detail = await lookupAdminDealer(dealerId);
        setDealerControlDetail(detail);
      } catch (error) {
        console.error('Failed to load dealer control detail', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.dealerControlLoadFailed', {
                defaultValue: 'Failed to load the dealer control center.',
              });
        setDealerControlError(errorMessage);
      } finally {
        setDealerControlLoading(false);
      }
    },
    [canReadDealers, t],
  );

  const openDealerControlCenter = useCallback(
    (dealer: Dealer) => {
      setDealerControlDealer(dealer);
      setDealerControlDetail(null);
      setDealerControlError(null);
      setDealerOwnerDraftQuery('');
      setDealerControlInviteRevokingId(null);
      setDealerControlStaffRemovingId(null);
      setDealerControlNoteDraft('');
      void loadDealerControlDetail(dealer.id);
    },
    [loadDealerControlDetail],
  );

  const closeDealerControlCenter = useCallback(() => {
    setDealerControlDealer(null);
    setDealerControlDetail(null);
    setDealerControlError(null);
    setDealerOwnerDraftQuery('');
    setDealerOwnerUpdating(false);
    setDealerControlInviteRevokingId(null);
    setDealerControlStaffRemovingId(null);
    setDealerControlNoteDraft('');
    setDealerControlNoteSaving(false);
  }, []);

  const loadListingControlDetail = useCallback(
    async (listingId: string) => {
      if (!canReadListings) {
        return;
      }

      setListingControlLoading(true);
      setListingControlError(null);
      try {
        const detail = await lookupAdminListing(listingId);
        setListingControlDetail(detail);
      } catch (error) {
        console.error('Failed to load listing control detail', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.listingControlLoadFailed', {
                defaultValue: 'Failed to load the listing control center.',
              });
        setListingControlError(errorMessage);
      } finally {
        setListingControlLoading(false);
      }
    },
    [canReadListings, t],
  );

  const openListingControlCenter = useCallback(
    (listing: Listing) => {
      setListingControlListing(listing);
      setListingControlDetail(null);
      setListingControlError(null);
      setListingControlNoteDraft('');
      void loadListingControlDetail(listing.id);
    },
    [loadListingControlDetail],
  );

  const closeListingControlCenter = useCallback(() => {
    setListingControlListing(null);
    setListingControlDetail(null);
    setListingControlError(null);
    setListingControlNoteDraft('');
    setListingControlNoteSaving(false);
  }, []);

  const loadModelControlDetail = useCallback(
    async (modelId: string) => {
      if (!canReadModels) {
        return;
      }

      setModelControlLoading(true);
      setModelControlError(null);
      try {
        const detail = await lookupAdminModel(modelId);
        setModelControlDetail(detail);
      } catch (error) {
        console.error('Failed to load model control detail', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.modelControlLoadFailed', {
                defaultValue: 'Failed to load the model control center.',
              });
        setModelControlError(errorMessage);
      } finally {
        setModelControlLoading(false);
      }
    },
    [canReadModels, t],
  );

  const openModelControlCenter = useCallback(
    (model: Model) => {
      setModelControlModel(model);
      setModelControlDetail(null);
      setModelControlError(null);
      setModelControlNoteDraft('');
      void loadModelControlDetail(model.id);
    },
    [loadModelControlDetail],
  );

  const closeModelControlCenter = useCallback(() => {
    setModelControlModel(null);
    setModelControlDetail(null);
    setModelControlError(null);
    setModelControlNoteDraft('');
    setModelControlNoteSaving(false);
  }, []);

  const loadStationControlDetail = useCallback(
    async (stationId: string) => {
      if (!canReadStations) {
        return;
      }

      setStationControlLoading(true);
      setStationControlError(null);
      try {
        const detail = await lookupAdminStation(stationId);
        setStationControlDetail(detail);
      } catch (error) {
        console.error('Failed to load charging-station control detail', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.stationControlLoadFailed', {
                defaultValue: 'Failed to load the charging-station control center.',
              });
        setStationControlError(errorMessage);
      } finally {
        setStationControlLoading(false);
      }
    },
    [canReadStations, t],
  );

  const openStationControlCenter = useCallback(
    (station: ChargingStation) => {
      setStationControlStation(station);
      setStationControlDetail(null);
      setStationControlError(null);
      setStationControlNoteDraft('');
      void loadStationControlDetail(station.id);
    },
    [loadStationControlDetail],
  );

  const closeStationControlCenter = useCallback(() => {
    setStationControlStation(null);
    setStationControlDetail(null);
    setStationControlError(null);
    setStationControlNoteDraft('');
    setStationControlNoteSaving(false);
  }, []);

  const handleDealerOwnerReassign = useCallback(async () => {
    if (!dealerControlDealer || !canEditDealers) {
      return;
    }

    const query = dealerOwnerDraftQuery.trim();
    if (!query) {
      setDealerControlError(
        t('admin.dealerOwnerQueryRequired', {
          defaultValue: 'Enter the email or UID of the account that should become the dealer owner.',
        }),
      );
      return;
    }

    setDealerOwnerUpdating(true);
    setDealerControlError(null);
    try {
      await updateAdminDealerOwner({
        dealerId: dealerControlDealer.id,
        query,
      });
      await loadDealerControlDetail(dealerControlDealer.id);
      setDealerOwnerDraftQuery('');
      addToast(
        t('admin.dealerOwnerReassigned', {
          defaultValue: 'Dealer owner reassigned successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to reassign dealer owner', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.dealerOwnerReassignFailed', {
              defaultValue: 'Failed to reassign the dealer owner.',
            });
      setDealerControlError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setDealerOwnerUpdating(false);
    }
  }, [
    addToast,
    canEditDealers,
    dealerControlDealer,
    dealerOwnerDraftQuery,
    loadDealerControlDetail,
    t,
  ]);

  const handleDealerControlInviteRevoke = useCallback(
    async (inviteId: string) => {
      if (!dealerControlDealer || !canManageDealerTeam) {
        return;
      }

      setDealerControlInviteRevokingId(inviteId);
      setDealerControlError(null);
      try {
        await revokeDealerTeamInvite({
          dealerId: dealerControlDealer.id,
          inviteId,
        });
        await loadDealerControlDetail(dealerControlDealer.id);
        addToast(
          t('admin.dealerTeamInviteRevoked', {
            defaultValue: 'Dealer team invite revoked.',
          }),
          'success',
        );
      } catch (error) {
        console.error('Failed to revoke dealer team invite', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.dealerTeamInviteRevokeFailed', {
                defaultValue: 'Failed to revoke the dealer team invite.',
              });
        setDealerControlError(errorMessage);
        addToast(errorMessage, 'error');
      } finally {
        setDealerControlInviteRevokingId(null);
      }
    },
    [addToast, canManageDealerTeam, dealerControlDealer, loadDealerControlDetail, t],
  );

  const handleDealerControlStaffRemove = useCallback(
    async (userUid: string) => {
      if (!dealerControlDealer || !canManageDealerTeam) {
        return;
      }

      const confirmed = window.confirm(
        t('admin.dealerStaffRemoveConfirm', {
          defaultValue: 'Remove this staff member from the dealer team?',
        }),
      );
      if (!confirmed) {
        return;
      }

      setDealerControlStaffRemovingId(userUid);
      setDealerControlError(null);
      try {
        await removeDealerTeamMember({
          dealerId: dealerControlDealer.id,
          userUid,
        });
        await loadDealerControlDetail(dealerControlDealer.id);
        addToast(
          t('admin.dealerStaffRemoved', {
            defaultValue: 'Dealer staff member removed.',
          }),
          'success',
        );
      } catch (error) {
        console.error('Failed to remove dealer staff member', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.dealerStaffRemoveFailed', {
                defaultValue: 'Failed to remove the dealer staff member.',
              });
        setDealerControlError(errorMessage);
        addToast(errorMessage, 'error');
      } finally {
        setDealerControlStaffRemovingId(null);
      }
    },
    [addToast, canManageDealerTeam, dealerControlDealer, loadDealerControlDetail, t],
  );

  const handleUserAdminNoteCreate = useCallback(async () => {
    if (!userAdminResult) {
      return;
    }

    if (!hasPermission('users.edit')) {
      addToast(
        t('admin.userNotePermissionDenied', {
          defaultValue: 'You do not have permission to add internal notes to user accounts.',
        }),
        'error',
      );
      return;
    }

    const body = userAdminNoteDraft.trim();
    if (!body) {
      addToast(
        t('admin.userNoteRequired', {
          defaultValue: 'Enter a note before saving it.',
        }),
        'error',
      );
      return;
    }

    setUserAdminNoteSaving(true);
    try {
      await createAdminEntityNote({
        entityType: 'user',
        entityId: userAdminResult.uid,
        body,
      });
      await refreshUserAdminResult(userAdminResult.uid);
      setUserAdminNoteDraft('');
      addToast(
        t('admin.userNoteCreated', {
          defaultValue: 'Internal user note added successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to create user admin note', error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.userNoteCreateFailed', {
              defaultValue: 'Failed to add the internal user note.',
            }),
        'error',
      );
    } finally {
      setUserAdminNoteSaving(false);
    }
  }, [addToast, hasPermission, refreshUserAdminResult, t, userAdminNoteDraft, userAdminResult]);

  const handleDealerControlNoteCreate = useCallback(async () => {
    if (!dealerControlDealer) {
      return;
    }

    if (!canEditDealers) {
      addToast(
        t('admin.dealerNotePermissionDenied', {
          defaultValue: 'You do not have permission to add internal dealer notes.',
        }),
        'error',
      );
      return;
    }

    const body = dealerControlNoteDraft.trim();
    if (!body) {
      setDealerControlError(
        t('admin.dealerNoteRequired', {
          defaultValue: 'Enter a note before saving it.',
        }),
      );
      return;
    }

    setDealerControlNoteSaving(true);
    setDealerControlError(null);
    try {
      await createAdminEntityNote({
        entityType: 'dealer',
        entityId: dealerControlDealer.id,
        body,
      });
      await loadDealerControlDetail(dealerControlDealer.id);
      setDealerControlNoteDraft('');
      addToast(
        t('admin.dealerNoteCreated', {
          defaultValue: 'Internal dealer note added successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to create dealer admin note', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.dealerNoteCreateFailed', {
              defaultValue: 'Failed to add the internal dealer note.',
            });
      setDealerControlError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setDealerControlNoteSaving(false);
    }
  }, [addToast, canEditDealers, dealerControlDealer, dealerControlNoteDraft, loadDealerControlDetail, t]);

  const handleListingControlNoteCreate = useCallback(async () => {
    if (!listingControlListing) {
      return;
    }

    if (!canModerateListings) {
      addToast(
        t('admin.listingNotePermissionDenied', {
          defaultValue: 'You do not have permission to add internal listing notes.',
        }),
        'error',
      );
      return;
    }

    const body = listingControlNoteDraft.trim();
    if (!body) {
      setListingControlError(
        t('admin.listingNoteRequired', {
          defaultValue: 'Enter a note before saving it.',
        }),
      );
      return;
    }

    setListingControlNoteSaving(true);
    setListingControlError(null);
    try {
      await createAdminEntityNote({
        entityType: 'listing',
        entityId: listingControlListing.id,
        body,
      });
      await loadListingControlDetail(listingControlListing.id);
      setListingControlNoteDraft('');
      addToast(
        t('admin.listingNoteCreated', {
          defaultValue: 'Internal listing note added successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to create listing admin note', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.listingNoteCreateFailed', {
              defaultValue: 'Failed to add the internal listing note.',
            });
      setListingControlError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setListingControlNoteSaving(false);
    }
  }, [
    addToast,
    canModerateListings,
    listingControlListing,
    listingControlNoteDraft,
    loadListingControlDetail,
    t,
  ]);

  const handleModelControlNoteCreate = useCallback(async () => {
    if (!modelControlModel) {
      return;
    }

    if (!canManageModels) {
      addToast(
        t('admin.modelNotePermissionDenied', {
          defaultValue: 'You do not have permission to add internal model notes.',
        }),
        'error',
      );
      return;
    }

    const body = modelControlNoteDraft.trim();
    if (!body) {
      setModelControlError(
        t('admin.modelNoteRequired', {
          defaultValue: 'Enter a note before saving it.',
        }),
      );
      return;
    }

    setModelControlNoteSaving(true);
    setModelControlError(null);
    try {
      await createAdminEntityNote({
        entityType: 'model',
        entityId: modelControlModel.id,
        body,
      });
      await loadModelControlDetail(modelControlModel.id);
      setModelControlNoteDraft('');
      addToast(
        t('admin.modelNoteCreated', {
          defaultValue: 'Internal model note added successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to create model admin note', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.modelNoteCreateFailed', {
              defaultValue: 'Failed to add the internal model note.',
            });
      setModelControlError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setModelControlNoteSaving(false);
    }
  }, [
    addToast,
    canManageModels,
    loadModelControlDetail,
    modelControlModel,
    modelControlNoteDraft,
    t,
  ]);

  const handleStationControlNoteCreate = useCallback(async () => {
    if (!stationControlStation) {
      return;
    }

    if (!canManageStations) {
      addToast(
        t('admin.stationNotePermissionDenied', {
          defaultValue: 'You do not have permission to add internal charging-station notes.',
        }),
        'error',
      );
      return;
    }

    const body = stationControlNoteDraft.trim();
    if (!body) {
      setStationControlError(
        t('admin.stationNoteRequired', {
          defaultValue: 'Enter a note before saving it.',
        }),
      );
      return;
    }

    setStationControlNoteSaving(true);
    setStationControlError(null);
    try {
      await createAdminEntityNote({
        entityType: 'charging_station',
        entityId: stationControlStation.id,
        body,
      });
      await loadStationControlDetail(stationControlStation.id);
      setStationControlNoteDraft('');
      addToast(
        t('admin.stationNoteCreated', {
          defaultValue: 'Internal charging-station note added successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to create charging-station admin note', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.stationNoteCreateFailed', {
              defaultValue: 'Failed to add the internal charging-station note.',
            });
      setStationControlError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setStationControlNoteSaving(false);
    }
  }, [
    addToast,
    canManageStations,
    loadStationControlDetail,
    stationControlNoteDraft,
    stationControlStation,
    t,
  ]);

  const handleRejectDealer = async (dealerId: string) => {
    await handleDealerStatusAction(dealerId, 'reject');
  };

  const handleDeactivateDealer = async (dealerId: string) => {
    await handleDealerStatusAction(dealerId, 'deactivate');
  };

  const handleReactivateDealer = async (dealerId: string) => {
    await handleDealerStatusAction(dealerId, 'reactivate');
  };

  const handleDeleteDealer = async (dealerId: string) => {
    await handleDealerStatusAction(dealerId, 'delete');
  };

  const handleDealerSubmit = async (values: DealerFormValues) => {
    setDealerSubmitting(true);
    const mergeGallery = (existing: string[], additions: string[]) =>
      Array.from(new Set([...existing, ...additions].filter(Boolean))).slice(0, 3);

    try {
      const { imageFile, galleryFiles = [], imageGallery = [], modelIds = [], ...restValues } = values;
      const baseGallery = Array.isArray(imageGallery)
        ? imageGallery.filter(Boolean).slice(0, 3)
        : [];
      const normalizedRest = { ...restValues, imageGallery: baseGallery };
      const { id: _ignoredDealerId, ...dealerValues } = normalizedRest;
      const dealerResponse = await saveAdminDealer({
        dealerId: dealerFormState?.mode === 'edit' && dealerFormState.entity
          ? dealerFormState.entity.id
          : undefined,
        values: {
          ...dealerValues,
          modelIds,
        },
      });

      const dealerId = dealerResponse.dealerId;
      const followUpValues: Record<string, unknown> = {};

      if (imageFile) {
        const heroUrl = await uploadDealerHeroImage(dealerId, imageFile);
        followUpValues.image_url = heroUrl;
        followUpValues.logo_url = heroUrl;
      }

      if (galleryFiles.length > 0) {
        const uploadedGallery = await Promise.all(
          galleryFiles.map(file => uploadDealerGalleryImage(dealerId, file)),
        );
        followUpValues.imageGallery = mergeGallery(baseGallery, uploadedGallery);
      }

      if (Object.keys(followUpValues).length > 0) {
        await saveAdminDealer({
          dealerId,
          values: followUpValues,
        });
      }
      closeAllModals();
    } catch (error) {
      console.error(error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.dealerSaveFailed', {
              defaultValue: 'Failed to save the dealer profile.',
            }),
        'error',
      );
    } finally {
      setDealerSubmitting(false);
    }
  };

  const handleModelSubmit = async (values: ModelFormValues) => {
    setModelSubmitting(true);
    const mergeGallery = (existing: string[], additions: string[]) =>
      Array.from(new Set([...existing, ...additions].filter(Boolean))).slice(0, 3);

    try {
      const { imageFile, galleryFiles = [], imageGallery = [], ...restValues } = values;
      const baseGallery = Array.isArray(imageGallery)
        ? imageGallery.filter(Boolean).slice(0, 3)
        : [];
      const normalizedRest = { ...restValues, imageGallery: baseGallery };
      const { id: _ignoredModelId, ...modelValues } = normalizedRest;
      const modelResponse = await saveAdminModel({
        modelId: modelFormState?.mode === 'edit' && modelFormState.entity
          ? modelFormState.entity.id
          : undefined,
        values: modelValues,
      });

      const modelId = modelResponse.modelId;
      const followUpValues: Record<string, unknown> = {};

      if (imageFile) {
        const heroUrl = await uploadModelHeroImage(modelId, imageFile);
        followUpValues.image_url = heroUrl;
      }

      if (galleryFiles.length > 0) {
        const uploadedGallery = await Promise.all(
          galleryFiles.map(file => uploadModelGalleryImage(modelId, file)),
        );
        followUpValues.imageGallery = mergeGallery(baseGallery, uploadedGallery);
      }

      if (Object.keys(followUpValues).length > 0) {
        await saveAdminModel({
          modelId,
          values: followUpValues,
        });
      }

      setModelControlModel(current =>
        current && current.id === modelId
          ? {
              ...current,
              ...values,
              image_url:
                typeof followUpValues.image_url === 'string' ? followUpValues.image_url : current.image_url,
              imageGallery:
                Array.isArray(followUpValues.imageGallery)
                  ? (followUpValues.imageGallery as string[])
                  : current.imageGallery,
            }
          : current,
      );

      closeAllModals();
      if (modelControlModel?.id === modelId) {
        await loadModelControlDetail(modelId);
      }
    } catch (error) {
      console.error(error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.modelSaveFailed', {
              defaultValue: 'Failed to save the EV model.',
            }),
        'error',
      );
    } finally {
      setModelSubmitting(false);
    }
  };

  const handleBlogSubmit = async (values: BlogPostFormValues) => {
    setBlogSubmitting(true);
    try {
      const { id: _ignoredPostId, ...postValues } = values;
      await saveAdminBlogPost({
        postId: blogFormState?.mode === 'edit' && blogFormState.entity
          ? blogFormState.entity.id
          : undefined,
        values: postValues as unknown as Record<string, unknown>,
      });
      closeAllModals();
    } catch (error) {
      console.error(error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.blogSaveFailed', {
              defaultValue: 'Failed to save the blog post.',
            }),
        'error',
      );
    } finally {
      setBlogSubmitting(false);
    }
  };

  const handlePlacementZoneSubmit = async (values: PlacementZoneFormValues) => {
    setPlacementSaving(true);
    setPlacementsError(null);
    try {
      await savePlacementZone({
        id:
          placementZoneFormState?.mode === 'edit' && placementZoneFormState.entity
            ? placementZoneFormState.entity.id
            : undefined,
        values,
      });
      closeAllModals();
      await loadPlacementsCatalog({ silent: true });
      addToast(
        t('admin.placementZoneSaved', {
          defaultValue: 'Placement zone saved successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to save placement zone', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.placementZoneSaveFailed', {
              defaultValue: 'Failed to save the placement zone.',
            });
      setPlacementsError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setPlacementSaving(false);
    }
  };

  const handleSponsorshipProductSubmit = async (values: SponsorshipProductFormValues) => {
    setPlacementSaving(true);
    setPlacementsError(null);
    try {
      await saveSponsorshipProduct({
        id:
          sponsorshipProductFormState?.mode === 'edit' && sponsorshipProductFormState.entity
            ? sponsorshipProductFormState.entity.id
            : undefined,
        values,
      });
      closeAllModals();
      await loadPlacementsCatalog({ silent: true });
      addToast(
        t('admin.sponsorshipProductSaved', {
          defaultValue: 'Sponsorship product saved successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to save sponsorship product', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.sponsorshipProductSaveFailed', {
              defaultValue: 'Failed to save the sponsorship product.',
            });
      setPlacementsError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setPlacementSaving(false);
    }
  };

  const handleSponsorshipOrderSubmit = async (values: SponsorshipOrderFormValues) => {
    setPlacementSaving(true);
    setPlacementsError(null);
    try {
      await saveSponsorshipOrder({
        id:
          sponsorshipOrderFormState?.mode === 'edit' && sponsorshipOrderFormState.entity
            ? sponsorshipOrderFormState.entity.id
            : undefined,
        values,
      });
      closeAllModals();
      await loadPlacementsCatalog({ silent: true });
      addToast(
        t('admin.sponsorshipOrderSaved', {
          defaultValue: 'Sponsorship order saved successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to save sponsorship order', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.sponsorshipOrderSaveFailed', {
              defaultValue: 'Failed to save the sponsorship order.',
            });
      setPlacementsError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setPlacementSaving(false);
    }
  };

  const handlePromotionalCampaignSubmit = async (values: PromotionalCampaignFormValues) => {
    setPlacementSaving(true);
    setPlacementsError(null);
    try {
      await savePromotionalCampaign({
        id:
          promotionalCampaignFormState?.mode === 'edit' && promotionalCampaignFormState.entity
            ? promotionalCampaignFormState.entity.id
            : undefined,
        values,
      });
      closeAllModals();
      await loadPlacementsCatalog({ silent: true });
      addToast(
        t('admin.promotionalCampaignSaved', {
          defaultValue: 'Promotional campaign saved successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to save promotional campaign', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.promotionalCampaignSaveFailed', {
              defaultValue: 'Failed to save the promotional campaign.',
            });
      setPlacementsError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setPlacementSaving(false);
    }
  };

  const handlePlacementZoneStatusUpdate = async (
    zone: PlacementZone,
    status: PlacementZoneStatus,
  ) => {
    if (!canManagePlacements) {
      return;
    }

    setPlacementSaving(true);
    setPlacementsError(null);
    try {
      await savePlacementZone({
        id: zone.id,
        values: {
          key: zone.key,
          name: zone.name,
          description: zone.description ?? '',
          pageKey: zone.pageKey,
          slotKey: zone.slotKey,
          allowedEntityTypes: zone.allowedEntityTypes,
          allowHousePromotions: zone.allowHousePromotions,
          allowSponsoredPromotions: zone.allowSponsoredPromotions,
          maxAssignments: zone.maxAssignments,
          localeTargets: zone.localeTargets ?? [],
          status,
        },
      });
      await loadPlacementsCatalog({ silent: true });
      addToast(
        t('admin.placementZoneStatusUpdated', {
          defaultValue: 'Placement zone status updated.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to update placement zone status', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.placementZoneStatusUpdateFailed', {
              defaultValue: 'Failed to update the placement zone status.',
            });
      setPlacementsError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setPlacementSaving(false);
    }
  };

  const handleSponsorshipProductStatusUpdate = async (
    product: SponsorshipProduct,
    status: SponsorshipProductStatus,
  ) => {
    if (!canManagePlacements) {
      return;
    }

    setPlacementSaving(true);
    setPlacementsError(null);
    try {
      await saveSponsorshipProduct({
        id: product.id,
        values: {
          code: product.code,
          name: product.name,
          description: product.description ?? '',
          eligiblePlanIds: product.eligiblePlanIds,
          eligibleEntityTypes: product.eligibleEntityTypes,
          defaultDurationDays: product.defaultDurationDays ?? '',
          priceLabel: product.priceLabel ?? '',
          status,
        },
      });
      await loadPlacementsCatalog({ silent: true });
      addToast(
        t('admin.sponsorshipProductStatusUpdated', {
          defaultValue: 'Sponsorship product status updated.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to update sponsorship product status', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.sponsorshipProductStatusUpdateFailed', {
              defaultValue: 'Failed to update the sponsorship product status.',
            });
      setPlacementsError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setPlacementSaving(false);
    }
  };

  const handleSponsorshipOrderStatusUpdate = async (
    order: SponsorshipOrder,
    status: SponsorshipOrder['status'],
    overrides?: Partial<Pick<SponsorshipOrder, 'paymentStatus' | 'paidAt'>>,
  ) => {
    if (!canManagePlacements) {
      return;
    }

    setPlacementSaving(true);
    setPlacementsError(null);
    try {
      await saveSponsorshipOrder({
        id: order.id,
        values: {
          name: order.name,
          dealerId: order.dealerId,
          sponsorshipProductId: order.sponsorshipProductId,
          campaignId: order.campaignId ?? '',
          zoneIds: order.zoneIds,
          sponsoredEntityType: order.sponsoredEntityType ?? '',
          sponsoredEntityId: order.sponsoredEntityId ?? '',
          status,
          paymentStatus: overrides?.paymentStatus ?? order.paymentStatus,
          priceAmount: order.priceAmount ?? '',
          currency: order.currency ?? 'EUR',
          priceLabel: order.priceLabel ?? '',
          invoiceReference: order.invoiceReference ?? '',
          startAt: typeof order.startAt === 'string' ? order.startAt : '',
          endAt: typeof order.endAt === 'string' ? order.endAt : '',
          paidAt:
            typeof overrides?.paidAt === 'string'
              ? overrides.paidAt
              : typeof order.paidAt === 'string'
                ? order.paidAt
                : '',
          notes: order.notes ?? '',
          internalNotes: order.internalNotes ?? '',
        },
      });
      await loadPlacementsCatalog({ silent: true });
      addToast(
        t('admin.sponsorshipOrderStatusUpdated', {
          defaultValue: 'Sponsorship order status updated.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to update sponsorship order status', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.sponsorshipOrderStatusUpdateFailed', {
              defaultValue: 'Failed to update the sponsorship order status.',
            });
      setPlacementsError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setPlacementSaving(false);
    }
  };

  const handleCreateLinkedCampaignFromOrder = async (order: SponsorshipOrder) => {
    if (!canManagePlacements) {
      return;
    }

    const product = sponsorshipProducts.find(entry => entry.id === order.sponsorshipProductId);
    const sponsoredEntityType =
      order.sponsoredEntityType ??
      (product?.eligibleEntityTypes.includes('dealer')
        ? 'dealer'
        : product?.eligibleEntityTypes[0] ?? null);
    const sponsoredEntityId =
      order.sponsoredEntityId ?? (sponsoredEntityType === 'dealer' ? order.dealerId : null);
    const startAt = toPlacementFormDate(order.startAt);
    const endAt = toPlacementFormDate(order.endAt);

    if (!sponsoredEntityType || !sponsoredEntityId) {
      addToast(
        t('admin.linkedCampaignMissingEntity', {
          defaultValue:
            'Edit the order and choose the sponsored entity type and ID before creating a public campaign.',
        }),
        'error',
      );
      return;
    }

    if (!order.zoneIds.length || !startAt || !endAt) {
      addToast(
        t('admin.linkedCampaignMissingSchedule', {
          defaultValue:
            'The order needs placement zones plus start and end dates before it can become a public campaign.',
        }),
        'error',
      );
      return;
    }

    const dealer = dealers.find(entry => entry.id === order.dealerId);
    const targetStatus = order.status === 'active' ? 'active' : 'scheduled';
    const campaignValues: PromotionalCampaignFormValues = {
      name: order.name,
      description: order.notes ?? '',
      status: 'draft',
      promotionType: 'sponsored_promotion',
      sponsoredEntityType: sponsoredEntityType as PlacementEntityType,
      sponsoredEntityId,
      sponsorshipProductId: order.sponsorshipProductId,
      zoneIds: order.zoneIds,
      headline: dealer?.name ? `${dealer.name}` : order.name,
      supportingText: order.notes ?? '',
      imageUrl: '',
      ctaLabel: '',
      destinationUrl: '',
      localeTargets: [],
      startAt,
      endAt,
      priority: 0,
    };

    setPlacementSaving(true);
    setPlacementsError(null);
    try {
      const campaignResponse = await savePromotionalCampaign({
        values: campaignValues,
      });
      const createdCampaign = campaignResponse.entity;

      await saveSponsorshipOrder({
        id: order.id,
        values: {
          name: order.name,
          dealerId: order.dealerId,
          sponsorshipProductId: order.sponsorshipProductId,
          campaignId: createdCampaign.id,
          zoneIds: order.zoneIds,
          sponsoredEntityType: sponsoredEntityType as PlacementEntityType,
          sponsoredEntityId,
          status: order.status,
          paymentStatus: order.paymentStatus,
          priceAmount: order.priceAmount ?? '',
          currency: order.currency ?? 'EUR',
          priceLabel: order.priceLabel ?? '',
          invoiceReference: order.invoiceReference ?? '',
          startAt,
          endAt,
          paidAt: toPlacementFormDate(order.paidAt),
          notes: order.notes ?? '',
          internalNotes: order.internalNotes ?? '',
        },
      });

      await savePromotionalCampaign({
        id: createdCampaign.id,
        values: {
          ...campaignValues,
          status: targetStatus,
        },
      });

      await loadPlacementsCatalog({ silent: true });
      addToast(
        t('admin.linkedCampaignCreated', {
          defaultValue: 'Linked public campaign created and published from the sponsorship order.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to create linked campaign from sponsorship order', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.linkedCampaignCreateFailed', {
              defaultValue: 'Failed to create a linked public campaign from the sponsorship order.',
            });
      setPlacementsError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setPlacementSaving(false);
    }
  };

  const handlePromotionalCampaignStatusUpdate = async (
    campaign: PromotionalCampaign,
    status: PromotionalCampaign['status'],
  ) => {
    if (!canManagePlacements) {
      return;
    }

    setPlacementSaving(true);
    setPlacementsError(null);
    try {
      await savePromotionalCampaign({
        id: campaign.id,
        values: {
          name: campaign.name,
          description: campaign.description ?? '',
          status,
          promotionType: campaign.promotionType,
          sponsoredEntityType: campaign.sponsoredEntityType ?? '',
          sponsoredEntityId: campaign.sponsoredEntityId ?? '',
          sponsorshipProductId: campaign.sponsorshipProductId ?? '',
          zoneIds: campaign.zoneIds,
          headline: campaign.headline ?? '',
          supportingText: campaign.supportingText ?? '',
          imageUrl: campaign.imageUrl ?? '',
          ctaLabel: campaign.ctaLabel ?? '',
          destinationUrl: campaign.destinationUrl ?? '',
          localeTargets: campaign.localeTargets ?? [],
          startAt: typeof campaign.startAt === 'string' ? campaign.startAt : '',
          endAt: typeof campaign.endAt === 'string' ? campaign.endAt : '',
          priority: campaign.priority,
        },
      });
      await loadPlacementsCatalog({ silent: true });
      addToast(
        t('admin.promotionalCampaignStatusUpdated', {
          defaultValue: 'Promotional campaign status updated.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to update promotional campaign status', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.promotionalCampaignStatusUpdateFailed', {
              defaultValue: 'Failed to update the promotional campaign status.',
            });
      setPlacementsError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setPlacementSaving(false);
    }
  };

  const handleCreateDealerModel = useCallback(
    async (values: Pick<Model, 'brand' | 'model_name'>) => {
      const response = await saveAdminModel({
        values: values as unknown as Record<string, unknown>,
      });
      return response.model;
    },
    [],
  );

  const handleStationSubmit = async (values: ChargingStationFormValues) => {
    setStationSubmitting(true);
    try {
      const editedStationId =
        stationFormState?.mode === 'edit' && stationFormState.entity ? stationFormState.entity.id : null;
      if (stationFormState?.mode === 'edit' && stationFormState.entity) {
        await updateAdminStation({
          action: 'update',
          stationId: stationFormState.entity.id,
          values,
        });
      } else {
        await updateAdminStation({
          action: 'create',
          values,
        });
      }
      closeAllModals();
      const updatedStations = await refreshStationsData();
      if (editedStationId && stationControlStation?.id === editedStationId) {
        const refreshedStation = updatedStations.find(station => station.id === editedStationId) ?? null;
        setStationControlStation(refreshedStation);
        if (refreshedStation) {
          await loadStationControlDetail(refreshedStation.id);
        } else {
          closeStationControlCenter();
        }
      }
    } catch (error) {
      console.error('Failed to save charging station:', error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.stationSaveFailed', {
              defaultValue: 'Failed to save the charging station.',
            }),
        'error',
      );
    } finally {
      setStationSubmitting(false);
    }
  };

  const buildStationFormValues = (station: ChargingStation): ChargingStationFormValues => ({
    address: station.address,
    plugTypes: station.plugTypes,
    chargingSpeedKw: station.chargingSpeedKw,
    operator: station.operator || '',
    pricingDetails: station.pricingDetails || '',
    googleMapsLink: station.googleMapsLink || '',
    latitude: station.latitude ?? '',
    longitude: station.longitude ?? '',
    isActive: station.isActive !== false,
  });

  const handleDeleteStation = async (stationId: string) => {
    setStationAction({ id: stationId, type: 'delete' });
    try {
      await updateAdminStation({ action: 'delete', stationId });
      await refreshStationsData();
      if (stationControlStation?.id === stationId) {
        closeStationControlCenter();
      }
    } catch (error) {
      console.error('Failed to delete charging station:', error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.stationDeleteFailed', {
              defaultValue: 'Failed to delete the charging station.',
            }),
        'error',
      );
    } finally {
      setStationAction(null);
    }
  };

  const handleToggleStationVisibility = async (station: ChargingStation) => {
    setStationAction({ id: station.id, type: 'toggleVisibility' });
    try {
      await updateAdminStation({
        action: 'update',
        stationId: station.id,
        values: {
          ...buildStationFormValues(station),
          isActive: station.isActive === false,
        },
      });
      const updatedStations = await refreshStationsData();
      if (stationControlStation?.id === station.id) {
        const refreshedStation = updatedStations.find(entry => entry.id === station.id) ?? null;
        setStationControlStation(refreshedStation);
        if (refreshedStation) {
          await loadStationControlDetail(refreshedStation.id);
        } else {
          closeStationControlCenter();
        }
      }
    } catch (error) {
      console.error('Failed to update charging station visibility:', error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.stationVisibilityUpdateFailed', {
              defaultValue: 'Failed to update charging station visibility.',
            }),
        'error',
      );
    } finally {
      setStationAction(null);
    }
  };

  const handleToggleModelVisibility = async (model: Model) => {
    setModelAction({ id: model.id, type: 'toggleVisibility' });
    try {
      await updateAdminModel({
        modelId: model.id,
        isActive: model.isActive === false,
      });
      setModelControlModel(current =>
        current && current.id === model.id
          ? {
              ...current,
              isActive: model.isActive === false,
            }
          : current,
      );
      if (modelControlModel?.id === model.id) {
        await loadModelControlDetail(model.id);
      }
    } catch (error) {
      console.error('Failed to update model visibility:', error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.modelVisibilityUpdateFailed', {
              defaultValue: 'Failed to update model visibility.',
            }),
        'error',
      );
    } finally {
      setModelAction(null);
    }
  };

  const handleToggleModelFeatured = async (model: Model) => {
    setModelAction({ id: model.id, type: 'toggleFeatured' });
    try {
      await updateAdminModel({
        modelId: model.id,
        isFeatured: !model.isFeatured,
      });
      setModelControlModel(current =>
        current && current.id === model.id
          ? {
              ...current,
              isFeatured: !model.isFeatured,
            }
          : current,
      );
      if (modelControlModel?.id === model.id) {
        await loadModelControlDetail(model.id);
      }
    } catch (error) {
      console.error('Failed to update model featured flag:', error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.modelFeaturedUpdateFailed', {
              defaultValue: 'Failed to update the featured status for this model.',
            }),
        'error',
      );
    } finally {
      setModelAction(null);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    setModelAction({ id: modelId, type: 'delete' });
    try {
      await updateAdminModel({
        modelId,
        delete: true,
      });
      if (modelControlModel?.id === modelId) {
        closeModelControlCenter();
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.modelDeleteFailed', {
              defaultValue: 'Failed to delete the model.',
            }),
        'error',
      );
    } finally {
      setModelAction(null);
    }
  };

  const handleReviewModel = async (
    model: Model,
    reviewStatus: 'approved' | 'rejected',
    reviewNotes?: string | null,
  ) => {
    setModelAction({ id: model.id, type: reviewStatus === 'approved' ? 'approveReview' : 'rejectReview' });
    try {
      await updateAdminModel({
        modelId: model.id,
        reviewStatus,
        reviewNotes: reviewNotes ?? null,
      });
      setModelControlModel(current =>
        current && current.id === model.id
          ? {
              ...current,
              reviewStatus,
              isActive: reviewStatus === 'approved' ? true : false,
            }
          : current,
      );
      if (modelControlModel?.id === model.id) {
        await loadModelControlDetail(model.id);
      }
    } catch (error) {
      console.error('Failed to review model:', error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.modelReviewUpdateFailed', {
              defaultValue: 'Failed to update the model review state.',
            }),
        'error',
      );
    } finally {
      setModelAction(null);
    }
  };

  const handleToggleBlogStatus = async (post: BlogPost) => {
    setBlogAction({ id: post.id, type: 'toggleStatus' });
    try {
      await updateAdminBlog({
        postId: post.id,
        status: post.status === 'published' ? 'draft' : 'published',
      });
    } catch (error) {
      console.error('Failed to update blog post status:', error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.blogStatusUpdateFailed', {
              defaultValue: 'Failed to update the blog post status.',
            }),
        'error',
      );
    } finally {
      setBlogAction(null);
    }
  };

  const handleDeleteBlogPost = async (postId: string) => {
    setBlogAction({ id: postId, type: 'delete' });
    try {
      await updateAdminBlog({
        postId,
        delete: true,
      });
    } catch (error) {
      console.error('Failed to delete blog post:', error);
      addToast(
        error instanceof Error
          ? error.message
          : t('admin.blogDeleteFailed', {
              defaultValue: 'Failed to delete the blog post.',
            }),
        'error',
      );
    } finally {
      setBlogAction(null);
    }
  };

  // Fetch charging stations on mount
  useEffect(() => {
    const loadStations = async () => {
      setStationsLoading(true);
      setStationsError(null);
      try {
        await refreshStationsData();
      } catch (error) {
        console.error('Error loading charging stations:', error);
        setStationsError('Failed to load charging stations');
      } finally {
        setStationsLoading(false);
      }
    };

    void loadStations();
  }, [refreshStationsData]);

  useEffect(() => {
    if (
      (activeTab !== 'placements' && activeTab !== 'overview' && activeTab !== 'reports') ||
      placementsLoaded ||
      placementsLoading ||
      placementsError ||
      !canReadPlacements
    ) {
      return;
    }

    void loadPlacementsCatalog();
  }, [
    activeTab,
    canReadPlacements,
    loadPlacementsCatalog,
    placementsError,
    placementsLoaded,
    placementsLoading,
  ]);

  useEffect(() => {
    if (
      (activeTab !== 'placements' && activeTab !== 'overview' && activeTab !== 'reports') ||
      placementAnalyticsLoaded ||
      placementAnalyticsLoading ||
      placementAnalyticsError ||
      !canReadPlacementAnalytics
    ) {
      return;
    }

    void loadPlacementAnalytics();
  }, [
    activeTab,
    canReadPlacementAnalytics,
    loadPlacementAnalytics,
    placementAnalyticsError,
    placementAnalyticsLoaded,
    placementAnalyticsLoading,
  ]);


  const confirmAndDelete = async (action: () => Promise<void>) => {
    const confirmation = window.confirm(t('admin.deleteConfirm'));
    if (!confirmation) return;

    try {
      await action();
    } catch (error) {
      console.error(error);
    }
  };

  const renderEmptyState = (message: string) => (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-gray-300">
      {message}
    </div>
  );

  const renderLoadingState = () => (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 py-16 text-gray-300">
      <Loader2 className="h-8 w-8 animate-spin text-gray-cyan" />
      <p className="text-sm font-medium">{t('admin.loading')}</p>
    </div>
  );

  const renderErrorState = () => (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-10 text-center text-sm text-red-200">
      <p className="text-base font-semibold">{t('admin.errorTitle')}</p>
      {loadError && <p className="mt-2 text-sm text-red-100/80">{loadError}</p>}
      <button
        onClick={() => window.location.reload()}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-red-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-100 transition hover:bg-red-500/40"
      >
        {t('admin.tryAgain')}
      </button>
    </div>
  );

  const renderAdminNotificationsPanel = () => {
    if (!adminNotificationsOpen) {
      return null;
    }

    const severityClasses: Record<AdminNotification['severity'], string> = {
      urgent: 'border-red-500/30 bg-red-500/10 text-red-100',
      attention: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
      info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
    };

    return (
      <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
        <button
          type="button"
          aria-label={t('admin.closeNotifications', { defaultValue: 'Close notifications' })}
          className="absolute inset-0 h-full w-full cursor-default"
          onClick={() => setAdminNotificationsOpen(false)}
        />
        <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#07111f] shadow-2xl">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-cyan/80">
                  {t('admin.notificationCenterEyebrow', { defaultValue: 'Action center' })}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {t('admin.notificationCenterTitle', { defaultValue: 'Admin notifications' })}
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                  {t('admin.notificationCenterDescription', {
                    defaultValue:
                      'Actionable items that need review, approval, verification, payment handling, or follow-up.',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdminNotificationsOpen(false)}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadAdminNotificationFeed()}
                disabled={adminNotificationsLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adminNotificationsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw size={15} />
                )}
                <span>{t('admin.refreshNotifications', { defaultValue: 'Refresh' })}</span>
              </button>
              <button
                type="button"
                onClick={() => void requestBrowserNotifications()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-cyan/20 bg-gray-cyan/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-gray-cyan/20"
              >
                <Bell size={15} />
                <span>
                  {browserNotificationEnabled
                    ? t('admin.browserNotificationsOn', { defaultValue: 'Browser alerts on' })
                    : t('admin.enableBrowserNotifications', { defaultValue: 'Enable browser alerts' })}
                </span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {adminNotificationsError && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                {adminNotificationsError}
              </div>
            )}

            {adminNotificationsLoading && adminNotifications.length === 0 ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-sm text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin text-gray-cyan" />
                <span>{t('admin.loadingNotifications', { defaultValue: 'Loading notifications...' })}</span>
              </div>
            ) : adminNotifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-gray-300">
                {t('admin.noAdminNotifications', {
                  defaultValue: 'No pending admin actions are currently visible for your permissions.',
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {adminNotifications.map(notification => (
                  <article
                    key={notification.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${severityClasses[notification.severity]}`}
                        >
                          {notification.severity}
                        </span>
                        <h3 className="mt-3 text-base font-semibold text-white">{notification.title}</h3>
                      </div>
                      {notification.createdAt && (
                        <span className="shrink-0 text-xs text-gray-500">
                          {formatDateTime(notification.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-300">{notification.message}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminNotificationsOpen(false);
                        navigate(notification.href);
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-cyan px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-400"
                    >
                      <span>{notification.actionLabel}</span>
                      <ExternalLink size={14} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    );
  };

  const handleExportOperationalReport = useCallback(() => {
    if (!canExportReports || typeof window === 'undefined') {
      return;
    }

    const rows: Array<[string, string, string | number]> = [
      ['Overview', 'Pending dealer approvals', dealerCounts.pending],
      ['Overview', 'Inactive dealers', dealerCounts.inactive],
      ['Overview', 'Paid dealers', dealerPlanCounts.paid],
      ['Overview', 'Pending listings', listingCounts.pending],
      ['Overview', 'Active listings', listingCounts.active + listingCounts.approved],
      ['Overview', 'Draft blog posts', blogCounts.draft],
      ['Overview', 'Inactive charging stations', stationCounts.inactive],
      ['Placements', 'Live campaigns', placementCounts.liveCampaigns],
      ['Placements', 'Reserved orders', placementCounts.reservedOrders],
      ['Placements', 'Blocked zones', placementCounts.blockedZones],
    ];

    reportQualityHighlights.forEach(item => {
      rows.push(['Quality', item.label, item.value]);
    });

    const csv = [
      ['section', 'metric', 'value'],
      ...rows.map(([section, metric, value]) => [
        escapeCsvValue(section),
        escapeCsvValue(metric),
        escapeCsvValue(value),
      ]),
    ]
      .map(columns => columns.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-operations-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [
    blogCounts.draft,
    canExportReports,
    dealerCounts.inactive,
    dealerCounts.pending,
    dealerPlanCounts.paid,
    listingCounts.active,
    listingCounts.approved,
    listingCounts.pending,
    placementCounts.blockedZones,
    placementCounts.liveCampaigns,
    placementCounts.reservedOrders,
    reportQualityHighlights,
    stationCounts.inactive,
  ]);

  const renderOverviewPanel = () => {
    const overviewCards = [
      {
        label: t('admin.overviewPendingDealers', { defaultValue: 'Pending dealer approvals' }),
        value: dealerCounts.pending,
        hint: t('admin.overviewPendingDealersHint', {
          defaultValue: '{{active}} active / {{inactive}} inactive dealers already in circulation.',
          active: dealerCounts.active,
          inactive: dealerCounts.inactive,
        }),
      },
      {
        label: t('admin.overviewListingQueue', { defaultValue: 'Listings moderation queue' }),
        value: listingCounts.pending,
        hint: t('admin.overviewListingQueueHint', {
          defaultValue: '{{live}} live / {{hidden}} inactive / {{rejected}} rejected listings.',
          live: listingCounts.active + listingCounts.approved,
          hidden: listingCounts.inactive,
          rejected: listingCounts.rejected,
        }),
      },
      {
        label: t('admin.overviewPaidDealers', { defaultValue: 'Paid dealers' }),
        value: dealerPlanCounts.paid,
        hint: t('admin.overviewPaidDealersHint', {
          defaultValue: '{{free}} free dealers, {{paused}} paused subscriptions.',
          free: dealerPlanCounts.free,
          paused: dealerPlanCounts.paused,
        }),
      },
      {
        label: t('admin.overviewContentBacklog', { defaultValue: 'Content backlog' }),
        value: blogCounts.draft,
        hint: t('admin.overviewContentBacklogHint', {
          defaultValue: '{{published}} published posts and {{missing}} entries missing metadata.',
          published: blogCounts.published,
          missing: blogCounts.missingMetaDescription,
        }),
      },
      {
        label: t('admin.overviewStations', { defaultValue: 'Charging stations needing attention' }),
        value: stationCounts.inactive + stationCounts.missingCoordinates,
        hint: t('admin.overviewStationsHint', {
          defaultValue: '{{active}} active stations, {{missing}} without coordinates.',
          active: stationCounts.active,
          missing: stationCounts.missingCoordinates,
        }),
      },
      {
        label: t('admin.overviewOfflineQueue', { defaultValue: 'Offline queue items' }),
        value: offlineQueueCount,
        hint: t('admin.overviewOfflineQueueHint', {
          defaultValue: 'Local operational submissions still waiting to be replayed.',
        }),
      },
    ];

    const queueItems = [
      {
        label: t('admin.overviewQueueDealers', { defaultValue: 'Pending dealer approvals' }),
        value: dealerCounts.pending,
      },
      {
        label: t('admin.overviewQueueListings', { defaultValue: 'Pending listings' }),
        value: listingCounts.pending,
      },
      {
        label: t('admin.overviewQueueDrafts', { defaultValue: 'Draft blog posts' }),
        value: blogCounts.draft,
      },
      {
        label: t('admin.overviewQueueStations', { defaultValue: 'Inactive stations' }),
        value: stationCounts.inactive,
      },
      {
        label: t('admin.overviewQueueModelMedia', { defaultValue: 'Models missing hero image' }),
        value: modelCounts.missingHero,
      },
    ];

    return (
      <div className="space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-cyan/80">
                {t('admin.overviewEyebrow', { defaultValue: 'Control center' })}
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-white">
                {t('admin.overviewHeading', { defaultValue: 'Platform operations overview' })}
              </h2>
              <p className="mt-3 max-w-3xl text-sm text-gray-300">
                {t('admin.overviewDescription', {
                  defaultValue:
                    'Track queue pressure, paid-dealer health, content backlog, and recent admin activity from one place before diving into individual entity tabs.',
                })}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <p className="font-semibold">
                {t('admin.overviewSnapshotHeading', { defaultValue: 'Current live snapshot' })}
              </p>
              <p className="mt-1 text-emerald-50/80">
                {t('admin.overviewSnapshotHint', {
                  defaultValue: '{{dealers}} dealers, {{models}} EV models, {{listings}} listings, {{stations}} charging stations.',
                  dealers: dealers.length,
                  models: models.length,
                  listings: listings.length,
                  stations: stations.length,
                })}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overviewCards.map(card => (
            <article key={card.label} className="rounded-2xl border border-white/10 bg-[#081120] p-5 shadow-lg">
              <p className="text-sm font-medium text-gray-300">{card.label}</p>
              <p className="mt-3 text-4xl font-semibold text-white">{card.value}</p>
              <p className="mt-3 text-sm text-gray-400">{card.hint}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {t('admin.overviewQueuesHeading', { defaultValue: 'Operational queues' })}
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  {t('admin.overviewQueuesDescription', {
                    defaultValue: 'These are the highest-friction areas that still need operator attention.',
                  })}
                </p>
              </div>
              <ClipboardList className="h-5 w-5 text-gray-cyan" />
            </div>

            <div className="mt-6 space-y-3">
              {queueItems.map(item => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3"
                >
                  <span className="text-sm text-gray-200">{item.label}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {t('admin.overviewActivityHeading', { defaultValue: 'Recent admin activity' })}
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  {t('admin.overviewActivityDescription', {
                    defaultValue: 'Latest trusted backend actions recorded in the audit trail.',
                  })}
                </p>
              </div>
              <MessageSquare className="h-5 w-5 text-gray-cyan" />
            </div>

            {canViewAudit ? (
              recentAuditHighlights.length > 0 ? (
                <div className="mt-6 space-y-3">
                  {recentAuditHighlights.map(log => (
                    <div key={log.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{log.summary}</p>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-gray-300">
                          {formatAuditActionLabel(log.action)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">
                        {log.actorEmail ?? log.actorUid} • {formatDateTime(typeof log.createdAt === 'string' ? log.createdAt : null) ?? t('admin.unknownDate', { defaultValue: 'Unknown date' })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                renderEmptyState(
                  t('admin.overviewNoAuditData', {
                    defaultValue: 'No admin activity has been loaded yet.',
                  }),
                )
              )
            ) : (
              renderEmptyState(
                t('admin.overviewAuditUnavailable', {
                  defaultValue: 'Audit visibility is not enabled for this admin account.',
                }),
              )
            )}
          </div>
        </section>

        {(canReadPlacements || canReadPlacementAnalytics) && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {t('admin.overviewPlacementsHeading', { defaultValue: 'Placement and revenue pulse' })}
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  {t('admin.overviewPlacementsDescription', {
                    defaultValue: 'Track the current health of live campaigns, reserved inventory, and blocked promo zones.',
                  })}
                </p>
              </div>
              <CreditCard className="h-5 w-5 text-gray-cyan" />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-gray-300">{t('admin.overviewLiveCampaigns', { defaultValue: 'Live campaigns' })}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{placementCounts.liveCampaigns}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-gray-300">{t('admin.overviewReservedOrders', { defaultValue: 'Reserved sponsorship orders' })}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{placementCounts.reservedOrders}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-gray-300">{t('admin.overviewBlockedZones', { defaultValue: 'Blocked placement zones' })}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{placementCounts.blockedZones}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-gray-300">{t('admin.overviewTopCtr', { defaultValue: 'Best current CTR' })}</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {placementAnalytics[0] ? `${placementAnalytics[0].ctr.toFixed(1)}%` : '0.0%'}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    );
  };

  const renderReportsPanel = () => {
    const trendMax = Math.max(
      1,
      ...reportTrendBuckets.map(bucket => bucket.dealers + bucket.listings + bucket.blogPosts + bucket.audit),
    );

    return (
      <div className="space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-cyan/80">
                {t('admin.reportsEyebrow', { defaultValue: 'Analytics and reporting' })}
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-white">
                {t('admin.reportsHeading', { defaultValue: 'Operational reports' })}
              </h2>
              <p className="mt-3 max-w-3xl text-sm text-gray-300">
                {t('admin.reportsDescription', {
                  defaultValue:
                    'Use these summaries to monitor growth, spot data-quality debt, and understand where admin effort is currently going.',
                })}
              </p>
            </div>
            {canExportReports && (
              <button
                type="button"
                onClick={handleExportOperationalReport}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-gray-cyan/60 hover:text-gray-cyan"
              >
                <Download className="h-4 w-4" />
                {t('admin.reportsExportButton', { defaultValue: 'Export snapshot CSV' })}
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-white">
                {t('admin.reportsTrendHeading', { defaultValue: '14-day activity trend' })}
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                {t('admin.reportsTrendDescription', {
                  defaultValue: 'Daily stacked activity across newly created dealers, listings, blog entries, and admin audit events.',
                })}
              </p>
            </div>
            <Receipt className="h-5 w-5 text-gray-cyan" />
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="flex min-w-[760px] items-end gap-3">
              {reportTrendBuckets.map(bucket => {
                const total = bucket.dealers + bucket.listings + bucket.blogPosts + bucket.audit;
                return (
                  <div key={bucket.dateKey} className="flex w-12 flex-col items-center gap-2">
                    <span className="text-xs text-gray-500">{total}</span>
                    <div className="flex h-36 w-full items-end rounded-2xl border border-white/10 bg-black/10 p-1">
                      <div className="flex h-full w-full flex-col justify-end overflow-hidden rounded-xl">
                        <div
                          className="bg-cyan-400/80"
                          style={{ height: `${(bucket.audit / trendMax) * 100}%` }}
                        />
                        <div
                          className="bg-amber-400/80"
                          style={{ height: `${(bucket.blogPosts / trendMax) * 100}%` }}
                        />
                        <div
                          className="bg-emerald-400/80"
                          style={{ height: `${(bucket.listings / trendMax) * 100}%` }}
                        />
                        <div className="bg-indigo-400/80" style={{ height: `${(bucket.dealers / trendMax) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400">{bucket.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-xs text-gray-300 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">Indigo = new dealers</div>
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">Emerald = new listings</div>
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">Amber = new blog posts</div>
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">Cyan = admin audit events</div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {t('admin.reportsQualityHeading', { defaultValue: 'Quality reports' })}
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  {t('admin.reportsQualityDescription', {
                    defaultValue: 'Surface records that still need media, metadata, or location cleanup.',
                  })}
                </p>
              </div>
              <ImageIcon className="h-5 w-5 text-gray-cyan" />
            </div>

            <div className="mt-6 space-y-3">
              {reportQualityHighlights.map(item => (
                <div key={item.key} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
                      {item.value}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">{item.supporting}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {t('admin.reportsGeoHeading', { defaultValue: 'Geographic and operator distribution' })}
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  {t('admin.reportsGeoDescription', {
                    defaultValue: 'A quick view of where dealer density and charging operations are currently concentrated.',
                  })}
                </p>
              </div>
              <MapPin className="h-5 w-5 text-gray-cyan" />
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-white">
                  {t('admin.reportsDealerCities', { defaultValue: 'Top dealer cities' })}
                </p>
                <div className="mt-4 space-y-3">
                  {topDealerCities.length > 0 ? topDealerCities.map(item => (
                    <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                      <span className="text-sm text-gray-200">{item.label}</span>
                      <span className="text-sm font-semibold text-white">{item.value}</span>
                    </div>
                  )) : renderEmptyState(t('admin.reportsNoDealerCities', { defaultValue: 'No dealer city data is available yet.' }))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  {t('admin.reportsStationOperators', { defaultValue: 'Top charging operators' })}
                </p>
                <div className="mt-4 space-y-3">
                  {topStationOperators.length > 0 ? topStationOperators.map(item => (
                    <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                      <span className="text-sm text-gray-200">{item.label}</span>
                      <span className="text-sm font-semibold text-white">{item.value}</span>
                    </div>
                  )) : renderEmptyState(t('admin.reportsNoOperators', { defaultValue: 'No charging operator data is available yet.' }))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {canReadPlacementAnalytics && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {t('admin.reportsPlacementHeading', { defaultValue: 'Placement performance snapshot' })}
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  {t('admin.reportsPlacementDescription', {
                    defaultValue: 'Top public placement zones and campaigns from the current analytics window.',
                  })}
                </p>
              </div>
              <Home className="h-5 w-5 text-gray-cyan" />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-white">
                  {t('admin.reportsTopZones', { defaultValue: 'Top zones' })}
                </p>
                <div className="mt-4 space-y-3">
                  {placementZoneAnalytics.slice(0, 5).map(item => (
                    <div key={item.zoneKey} className="rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-200">{item.zoneKey}</span>
                        <span className="text-sm font-semibold text-white">{item.ctr.toFixed(1)}% CTR</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">
                        {item.impressions} impressions • {item.clicks} clicks
                      </p>
                    </div>
                  ))}
                  {placementZoneAnalytics.length === 0 &&
                    renderEmptyState(
                      t('admin.reportsNoPlacementZones', {
                        defaultValue: 'No placement analytics have been collected yet.',
                      }),
                    )}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  {t('admin.reportsTopCampaigns', { defaultValue: 'Top campaigns' })}
                </p>
                <div className="mt-4 space-y-3">
                  {placementAnalytics.slice(0, 5).map(item => {
                    const campaign = promotionalCampaigns.find(entry => entry.id === item.campaignId);
                    return (
                      <div key={item.campaignId} className="rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-200">{campaign?.name ?? item.campaignId}</span>
                          <span className="text-sm font-semibold text-white">{item.ctr.toFixed(1)}% CTR</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-400">
                          {item.impressions} impressions • {item.clicks} clicks
                        </p>
                      </div>
                    );
                  })}
                  {placementAnalytics.length === 0 &&
                    renderEmptyState(
                      t('admin.reportsNoPlacementCampaigns', {
                        defaultValue: 'No campaign analytics have been collected yet.',
                      }),
                    )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    );
  };

  const renderDealersPanel = () => {
    const dealerUpdateLoading = dealerMutations.update.loading || dealerAction !== null;
    const dealerDeleteLoading =
      dealerMutations.delete.loading || dealerAction?.type === 'delete';

    const filterOptions: Array<{
      key: DealerFilterKey;
      label: string;
      count: number;
    }> = [
        {
          key: 'active',
          label: t('admin.dealerFilters.active', { defaultValue: 'Active' }),
          count: dealerCounts.active,
        },
        {
          key: 'inactive',
          label: t('admin.dealerFilters.inactive', { defaultValue: 'Inactive' }),
          count: dealerCounts.inactive,
        },
        {
          key: 'pending',
          label: t('admin.dealerFilters.pending', { defaultValue: 'Pending' }),
          count: dealerCounts.pending,
        },
        {
          key: 'deleted',
          label: t('admin.dealerFilters.deleted', { defaultValue: 'Deleted' }),
          count: dealerCounts.deleted,
        },
      ];

    const emptyMessage = (() => {
      switch (dealerFilter) {
        case 'active':
          return t('admin.noActiveDealers', { defaultValue: 'No active dealers found.' });
        case 'inactive':
          return t('admin.noInactiveDealers', { defaultValue: 'No inactive dealers found.' });
        case 'pending':
          return t('admin.noPendingDealers', { defaultValue: 'No dealers awaiting approval.' });
        case 'deleted':
        default:
          return t('admin.noDeletedDealers', { defaultValue: 'No deleted dealers.' });
      }
    })();

    let content: React.ReactNode;
    if (loadError) {
      content = renderErrorState();
    } else if (loading) {
      content = renderLoadingState();
    } else {
      content = (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filterOptions.map(option => {
              const isSelected = dealerFilter === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => setDealerFilter(option.key)}
                  className={`rounded-2xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-cyan/60 ${isSelected
                    ? 'border-gray-cyan/60 bg-gray-cyan/30 text-white shadow-lg'
                    : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'
                    }`}
                  aria-pressed={isSelected}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
                    {option.label}
                  </p>
                  <p className="mt-2 text-3xl font-extrabold text-white">{option.count}</p>
                </button>
              );
            })}
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            <header className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">
                {t('admin.filteredDealers', { defaultValue: 'Dealers' })}
              </h3>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300">
                  {filteredDealers.length}
                </span>
                <button
                  onClick={() => toggleSelectAll(filteredDealers.map(d => d.id))}
                  className="text-xs text-gray-400 hover:text-white underline underline-offset-4"
                >
                  {selectedIds.length === filteredDealers.length && filteredDealers.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </header>

            {/* Search and Bulk Actions Toolbar */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center bg-black/20 p-4 rounded-xl border border-white/10">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('admin.searchPlaceholder', { defaultValue: 'Search...' })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gray-cyan/50"
                />
              </div>
              
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                  <span className="text-[10px] uppercase font-bold text-gray-500 mr-1 whitespace-nowrap">{selectedIds.length} Selected</span>
                  {dealerFilter === 'pending' && (
                    <button
                      onClick={() => handleBulkDealerAction('approve')}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 whitespace-nowrap"
                    >
                      <Check size={14} /> {t('admin.approve')}
                    </button>
                  )}
                  {dealerFilter === 'active' && (
                    <button
                      onClick={() => handleBulkDealerAction('deactivate')}
                      className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/30 whitespace-nowrap"
                    >
                      <Power size={14} /> {t('admin.deactivate')}
                    </button>
                  )}
                  {dealerFilter !== 'deleted' && (
                    <button
                      onClick={() => handleBulkDealerAction('delete')}
                      className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 whitespace-nowrap"
                    >
                      <Trash2 size={14} /> {t('admin.delete')}
                    </button>
                  )}
                  {dealerFilter === 'deleted' && (
                    <button
                      onClick={() => handleBulkDealerAction('reactivate')}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 whitespace-nowrap"
                    >
                      <RefreshCcw size={14} /> {t('admin.restoreDealer', { defaultValue: 'Restore' })}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedIds([])}
                    className="p-1.5 text-gray-400 hover:text-white"
                    title="Clear Selection"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {filteredDealers.length === 0 ? (
              renderEmptyState(emptyMessage)
            ) : (
              <ul className="divide-y divide-white/5">
                {filteredDealers.map(dealer => {
                  const status = deriveStatus(dealer);
                  const isDeleted = dealer.isDeleted === true;
                  const isActiveDealer =
                    status === 'approved' && dealer.isActive !== false && !isDeleted;
                  const isPendingDealer = status === 'pending' && !isDeleted;
                  const isRejectedDealer = status === 'rejected' && !isDeleted;
                  const createdAt = formatDate(dealer.createdAt);
                  const updatedAt = formatDate(dealer.updatedAt);
                  const location =
                    dealer.location || [dealer.address, dealer.city].filter(Boolean).join(', ');
                  const contactEmail = dealer.contact_email || dealer.email;
                  const contactPhone = dealer.contact_phone || dealer.phone;
                  const currentPlanId = dealer.planId ?? 'free';
                  const currentSubscriptionStatus = dealer.subscriptionStatus ?? 'active';
                  const dealerPlanDraft =
                    dealerPlanDrafts[dealer.id] ?? getDealerPlanDraft(dealer);
                  const isDealerPlanDirty =
                    dealerPlanDraft.planId !== currentPlanId ||
                    dealerPlanDraft.subscriptionStatus !== currentSubscriptionStatus;
                  const isDealerPlanUpdating = dealerPlanUpdatingId === dealer.id;

                  const statusLabel = isDeleted
                    ? t('admin.statusDeleted', { defaultValue: 'Deleted' })
                    : isPendingDealer
                      ? t('admin.statusPending', { defaultValue: 'Pending' })
                      : isRejectedDealer
                        ? t('admin.statusRejected', { defaultValue: 'Rejected' })
                        : isActiveDealer
                          ? t('admin.statusActive', { defaultValue: 'Active' })
                          : t('admin.statusInactive', { defaultValue: 'Inactive' });

                  const statusClasses = isDeleted
                    ? 'border-rose-500/40 bg-rose-500/20 text-rose-100'
                    : isPendingDealer
                      ? 'border-amber-500/40 bg-amber-500/20 text-amber-100'
                      : isRejectedDealer
                        ? 'border-red-500/40 bg-red-500/20 text-red-100'
                        : isActiveDealer
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-100'
                          : 'border-slate-500/40 bg-slate-500/20 text-slate-100';

                  const showEditButton = dealerFilter !== 'deleted';
                  const showDeleteButton = dealerFilter !== 'deleted';

                  const renderPrimaryAction = () => {
                    const isProcessing = dealerAction?.id === dealer.id;
                    const hasDashboard = !!dealer.ownerUid;

                    const actionButtons = [];

                    if (dealerFilter === 'pending') {
                      actionButtons.push(
                        <button
                          key="approve"
                          onClick={() => handleApproveDealer(dealer.id)}
                          disabled={!isAdmin || dealerUpdateLoading}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 hover:text-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={t('admin.approve')}
                        >
                          {isProcessing && dealerAction?.type === 'approve' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          <span>{t('admin.approve')}</span>
                        </button>,
                        <button
                          key="reject"
                          onClick={() => handleRejectDealer(dealer.id)}
                          disabled={!isAdmin || dealerUpdateLoading}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={t('admin.reject')}
                        >
                          {isProcessing && dealerAction?.type === 'reject' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle size={14} />
                          )}
                          <span>{t('admin.reject')}</span>
                        </button>
                      );
                    } else if (dealerFilter === 'active') {
                      actionButtons.push(
                        <button
                          key="deactivate"
                          onClick={() => handleDeactivateDealer(dealer.id)}
                          disabled={!isAdmin || dealerUpdateLoading}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/30 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={t('admin.deactivate')}
                        >
                          {isProcessing && dealerAction?.type === 'deactivate' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Power size={14} />
                          )}
                          <span>{t('admin.deactivate')}</span>
                        </button>
                      );
                    } else if (dealerFilter === 'inactive') {
                      if (status === 'rejected') {
                        actionButtons.push(
                          <button
                            key="approve"
                            onClick={() => handleApproveDealer(dealer.id)}
                            disabled={!isAdmin || dealerUpdateLoading}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 hover:text-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={t('admin.approve')}
                          >
                            {isProcessing && dealerAction?.type === 'approve' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                            <span>{t('admin.approve')}</span>
                          </button>
                        );
                      } else {
                        actionButtons.push(
                          <button
                            key="reactivate"
                            onClick={() => handleReactivateDealer(dealer.id)}
                            disabled={!isAdmin || dealerUpdateLoading}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 hover:text-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={t('admin.reactivate')}
                          >
                            {isProcessing && dealerAction?.type === 'reactivate' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCcw size={14} />
                            )}
                            <span>{t('admin.reactivate')}</span>
                          </button>
                        );
                      }
                    } else if (dealerFilter === 'deleted') {
                      actionButtons.push(
                        <button
                          key="restore"
                          onClick={() => handleReactivateDealer(dealer.id)}
                          disabled={!isAdmin || dealerUpdateLoading}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 hover:text-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={t('admin.restoreDealer', { defaultValue: 'Restore dealer' })}
                        >
                          {isProcessing && dealerAction?.type === 'reactivate' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw size={14} />
                          )}
                          <span>{t('admin.reactivate')}</span>
                        </button>
                      );
                    }

                    // Add Account Activation button
                    // Show for any approved dealer in active/inactive tabs.
                    // If they stay approved but have no UID, they definitely need activation.
                    // If they HAVE a UID, we still show it as a "Reset/Update" option for the admin's convenience with legacy data.
                    const isActivatable = (status === 'approved' || dealerFilter === 'active' || dealerFilter === 'inactive');
                    
                    if (isActivatable && status !== 'rejected' && status !== 'deleted') {
                      actionButtons.push(
                        <button
                          key="activate"
                          onClick={() => {
                            setActivationModalDealer(dealer);
                            setActivationEmail(dealer.contact_email || dealer.email || '');
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                            hasDashboard 
                              ? 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20' 
                              : 'bg-gray-cyan/20 text-gray-cyan hover:bg-gray-cyan/30'
                          }`}
                          title={hasDashboard ? t('admin.resetAccountHint', { defaultValue: 'Reset/Update login for this dealer' }) : t('admin.activateAccountHint', { defaultValue: 'Create a login for this dealer' })}
                        >
                          <UserPlus size={14} />
                          <span>{hasDashboard ? t('admin.resetLogin', { defaultValue: 'Rilidhu' }) : t('admin.activate', { defaultValue: 'Aktivizo' })}</span>
                        </button>
                      );
                    }

                    return (
                      <div className="flex flex-wrap gap-2">
                        {actionButtons}
                      </div>
                    );
                  };

                  return (
                    <li key={dealer.id} className="group flex items-start gap-4 py-4 first:pt-0 last:pb-0 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors px-2 -mx-2 rounded-lg">
                      <div className="pt-1.5 select-none">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(dealer.id)}
                          onChange={() => toggleSelect(dealer.id)}
                          className="h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50 transition-colors cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-white">{dealer.name}</p>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusClasses}`}>
                            {statusLabel}
                          </span>
                        </div>
                        {location && <p className="text-sm text-gray-300">{location}</p>}
                        {dealer.description && (
                          <p className="text-xs text-gray-400 line-clamp-2">{dealer.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-400">
                          {contactEmail && <span>{contactEmail}</span>}
                          {contactPhone && <span>{contactPhone}</span>}
                        </div>
                        {dealer.brands?.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {dealer.brands.join(', ')}
                          </p>
                        )}
                        {createdAt && (
                          <p className="text-xs text-gray-500">
                            {t('admin.createdOn', { defaultValue: 'Created on {{date}}', date: createdAt })}
                          </p>
                        )}
                        {updatedAt && (
                          <p className="text-xs text-gray-500">
                            {t('admin.updatedOn', { defaultValue: 'Updated on {{date}}', date: updatedAt })}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                          <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-sky-100">
                            {t('admin.dealerPlanBadge', {
                              defaultValue: 'Plan: {{plan}}',
                              plan: currentPlanId.toUpperCase(),
                            })}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                            {t('admin.dealerSubscriptionBadge', {
                              defaultValue: 'Subscription: {{status}}',
                              status: currentSubscriptionStatus,
                            })}
                          </span>
                        </div>
                        {canAssignDealerPlans && !isDeleted && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                              <Key className="h-3.5 w-3.5 text-gray-cyan" />
                              <span>
                                {t('admin.dealerPlanControls', {
                                  defaultValue: 'Dealer plan controls',
                                })}
                              </span>
                            </div>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                                <span>{t('admin.dealerPlanLabel', { defaultValue: 'Plan' })}</span>
                                <select
                                  value={dealerPlanDraft.planId}
                                  onChange={event =>
                                    updateDealerPlanDraft(dealer, {
                                      planId: event.target.value as DealerPlanId,
                                    })
                                  }
                                  disabled={isDealerPlanUpdating}
                                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {DEALER_PLAN_IDS.map(planId => (
                                    <option key={planId} value={planId}>
                                      {planId.toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                                <span>
                                  {t('admin.dealerSubscriptionLabel', {
                                    defaultValue: 'Subscription status',
                                  })}
                                </span>
                                <select
                                  value={dealerPlanDraft.subscriptionStatus}
                                  onChange={event =>
                                    updateDealerPlanDraft(dealer, {
                                      subscriptionStatus:
                                        event.target.value as DealerSubscriptionStatus,
                                    })
                                  }
                                  disabled={isDealerPlanUpdating}
                                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {DEALER_SUBSCRIPTION_STATUSES.map(subscriptionStatus => (
                                    <option key={subscriptionStatus} value={subscriptionStatus}>
                                      {subscriptionStatus}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                onClick={() => handleDealerPlanUpdate(dealer)}
                                disabled={!isDealerPlanDirty || isDealerPlanUpdating}
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-cyan px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isDealerPlanUpdating ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Key size={14} />
                                )}
                                <span>
                                  {t('admin.saveDealerPlan', { defaultValue: 'Save plan' })}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {canReadDealers && (
                          <button
                            onClick={() => openDealerControlCenter(dealer)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
                          >
                            <Shield size={14} />
                            <span>{t('admin.dealerControlCenter', { defaultValue: 'Control center' })}</span>
                          </button>
                        )}
                        {showEditButton && (
                          <button
                            onClick={() => setDealerFormState({ mode: 'edit', entity: dealer })}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
                            aria-label={t('admin.editDealer')}
                          >
                            <Pencil size={14} />
                            <span>{t('admin.edit')}</span>
                          </button>
                        )}

                        {renderPrimaryAction()}

                        {showDeleteButton && (
                          <button
                            onClick={() => confirmAndDelete(() => handleDeleteDealer(dealer.id))}
                            disabled={!isAdmin || dealerDeleteLoading}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={t('admin.delete')}
                          >
                            {dealerAction?.id === dealer.id && dealerAction?.type === 'delete' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            <span>{t('admin.delete')}</span>
                          </button>
                        )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">{t('admin.manageDealers')}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setBulkEntity('dealers')}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <Upload size={16} />
              <span>{t('admin.bulkUploadDealers', { defaultValue: 'Bulk upload dealers' })}</span>
            </button>
            <button
              onClick={() => setDealerFormState({ mode: 'create' })}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-cyan/90"
            >
              <Plus size={16} />
              <span>{t('admin.addNewDealer')}</span>
            </button>
          </div>
        </div>

        {content}
      </div>
    );
  };

  const renderUsersPanel = () => {
    if (!canReadUsers) {
      return (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            {renderEmptyState(
              t('admin.usersUnavailable', {
                defaultValue: 'You do not have permission to manage user accounts.',
              }),
            )}
          </div>
        </div>
      );
    }

    const isSuspended =
      userAdminResult?.accountStatus === 'suspended' || userAdminResult?.authDisabled === true;
    const isDealerLikeTarget = userAdminResult?.relationships.hasDealerAccount === true;
    const isPlatformAdminTarget = userAdminResult?.relationships.isPlatformAdmin === true;
    const isOwnAccount = userAdminResult?.uid === user?.uid;
    const isProtectedAdminTarget = Boolean(isPlatformAdminTarget && !isMasterAdmin);
    const canSuspendTarget =
      Boolean(
        userAdminResult &&
          !isSuspended &&
          !isDealerLikeTarget &&
          !isOwnAccount &&
          !isProtectedAdminTarget &&
          canSuspendUsers,
      );
    const canReactivateTarget =
      Boolean(
        userAdminResult &&
          isSuspended &&
          !isDealerLikeTarget &&
          !isOwnAccount &&
          !isProtectedAdminTarget &&
          canReactivateUsers,
      );
    const createdAt = formatDateTime(userAdminResult?.createdAt);
    const lastSignInAt = formatDateTime(userAdminResult?.lastSignInAt);
    const linkedDealers = userAdminResult?.relationships.linkedDealers ?? [];
    const listingCounts = userAdminResult?.relationships.listingCounts;
    const recentUserListings = userAdminResult?.relationships.recentListings ?? [];
    const userAdminNotes = userAdminResult?.adminNotes ?? [];
    const userRecentAuditLogs = userAdminResult?.recentAuditLogs ?? [];
    const canAddUserNotes = hasPermission('users.edit');

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">
                {t('admin.manageUsers', { defaultValue: 'Users' })}
              </h2>
              <p className="max-w-3xl text-sm text-gray-400">
                {t('admin.usersDescription', {
                  defaultValue:
                    'Look up a user by email or UID, inspect linked dealer and inventory relationships, then suspend or reactivate normal user accounts.',
                })}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-300">
              {t('admin.usersNote', {
                defaultValue:
                  'Dealer and platform-admin accounts stay protected by their own management workflows.',
              })}
            </div>
          </div>

          <form
            onSubmit={handleUserAdminLookup}
            className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:flex-row lg:items-end"
          >
            <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-gray-300">
              <span className="font-medium text-white">
                {t('admin.userLookupLabel', { defaultValue: 'User email or UID' })}
              </span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={userAdminQuery}
                  onChange={event => setUserAdminQuery(event.target.value)}
                  placeholder={t('admin.userLookupPlaceholder', {
                    defaultValue: 'name@example.com or Firebase UID',
                  })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-sm text-white focus:border-gray-cyan/50 focus:outline-none"
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={userAdminLookupLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {userAdminLookupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search size={16} />
              )}
              <span>{t('admin.findUser', { defaultValue: 'Find user' })}</span>
            </button>
          </form>

          {userAdminLookupError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {userAdminLookupError}
            </div>
          )}
        </div>

        {userAdminResult && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">
                    {userAdminResult.displayName ||
                      userAdminResult.email ||
                      t('admin.unnamedUser', { defaultValue: 'Unnamed user' })}
                  </h3>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-gray-300">
                    UID: {userAdminResult.uid}
                  </span>
                  {isSuspended && (
                    <span className="inline-flex items-center rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-100">
                      {t('admin.userSuspendedBadge', { defaultValue: 'Suspended' })}
                    </span>
                  )}
                  {userAdminResult.emailVerified && (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                      {t('admin.emailVerifiedBadge', { defaultValue: 'Email verified' })}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                  <span className="inline-flex items-center rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-2 py-1 text-gray-100">
                    {t('admin.userRoleBadge', {
                      defaultValue: 'Role: {{role}}',
                      role: userAdminResult.role,
                    })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                    {t('admin.userTypeBadge', {
                      defaultValue: 'Type: {{type}}',
                      type: userAdminResult.accountType ?? 'user',
                    })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                    {t('admin.userStatusBadge', {
                      defaultValue: 'Status: {{status}}',
                      status: userAdminResult.accountStatus ?? 'active',
                    })}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-gray-400">
                  <p>{userAdminResult.email ?? t('admin.missingEmail', { defaultValue: 'No email on file' })}</p>
                  {createdAt && (
                    <p>
                      {t('admin.userCreatedAt', {
                        defaultValue: 'Created: {{date}}',
                        date: createdAt,
                      })}
                    </p>
                  )}
                  {lastSignInAt && (
                    <p>
                      {t('admin.userLastSignInAt', {
                        defaultValue: 'Last sign-in: {{date}}',
                        date: lastSignInAt,
                      })}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-300">
                <p className="font-semibold uppercase tracking-wide text-white/80">
                  {t('admin.userRelationshipSummary', { defaultValue: 'Relationship summary' })}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      {t('admin.linkedDealersCount', { defaultValue: 'Dealers' })}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">{linkedDealers.length}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      {t('admin.userListingsCount', { defaultValue: 'Listings' })}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">{listingCounts?.total ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      {t('admin.userModelsCount', { defaultValue: 'Models' })}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {userAdminResult.relationships.modelCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      {t('admin.userFavouritesCount', { defaultValue: 'Favourites' })}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {userAdminResult.relationships.favouriteCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      {t('admin.userEnquiriesCount', { defaultValue: 'Enquiries' })}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {userAdminResult.relationships.enquiryCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      {t('admin.platformAdminFlag', { defaultValue: 'Platform admin' })}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {userAdminResult.relationships.isPlatformAdmin ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {(isDealerLikeTarget || isPlatformAdminTarget || isOwnAccount) && (
              <div className="mt-5 space-y-3">
                {isDealerLikeTarget && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {t('admin.userDealerWorkflowWarning', {
                      defaultValue:
                        'This account is linked to dealer operations. Manage approvals, activation, or suspension through the dealer workflow.',
                    })}
                  </div>
                )}
                {isPlatformAdminTarget && !isMasterAdmin && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {t('admin.userAdminWorkflowWarning', {
                      defaultValue:
                        'This account has platform-admin access. Only a master admin can suspend or reactivate it here.',
                    })}
                  </div>
                )}
                {isOwnAccount && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {t('admin.selfStatusChangeWarning', {
                      defaultValue:
                        'Self-suspension is blocked through this panel. Use a separate admin account for account recovery operations.',
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_340px]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-gray-cyan" />
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                    {t('admin.userRelationships', { defaultValue: 'Linked relationships' })}
                  </h4>
                </div>

                <div className="space-y-3">
                  {linkedDealers.length > 0 ? (
                    linkedDealers.map(dealer => (
                      <div
                        key={dealer.id}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{dealer.name}</p>
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                            {dealer.status ?? 'unknown'}
                          </span>
                          {dealer.isOwner && (
                            <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                              {t('admin.dealerOwnerBadge', { defaultValue: 'Owner' })}
                            </span>
                          )}
                          {dealer.staffRole && (
                            <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-100">
                              {t('admin.dealerStaffRoleBadge', {
                                defaultValue: 'Staff: {{role}}',
                                role: dealer.staffRole,
                              })}
                            </span>
                          )}
                          {dealer.planId && (
                            <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-100">
                              {dealer.planId}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                          <span>ID: {dealer.id}</span>
                          <span>{dealer.isActive ? 'Active' : 'Inactive'}</span>
                          <span>{dealer.isDeleted ? 'Deleted' : 'Visible'}</span>
                          {dealer.subscriptionStatus && <span>{dealer.subscriptionStatus}</span>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-400">
                      {t('admin.noLinkedDealers', {
                        defaultValue: 'No linked dealer records were found for this account.',
                      })}
                    </div>
                  )}

                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">
                        {t('admin.userInventoryBreakdown', { defaultValue: 'Inventory breakdown' })}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {[
                        ['Total', listingCounts?.total ?? 0],
                        ['Pending', listingCounts?.pending ?? 0],
                        ['Approved', listingCounts?.approved ?? 0],
                        ['Active', listingCounts?.active ?? 0],
                        ['Inactive', listingCounts?.inactive ?? 0],
                        ['Rejected', listingCounts?.rejected ?? 0],
                        ['Deleted', listingCounts?.deleted ?? 0],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                          <p className="mt-1 text-base font-semibold text-white">{value}</p>
                        </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">
                        {t('admin.userRecentListings', { defaultValue: 'Recent listings' })}
                      </p>
                      {recentUserListings.length === 0 ? (
                        <p className="mt-3 text-sm text-gray-500">
                          {t('admin.userRecentListingsEmpty', {
                            defaultValue: 'No recent listings were found for this account.',
                          })}
                        </p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {recentUserListings.map(listing => (
                            <div
                              key={listing.id}
                              className="rounded-lg border border-white/10 bg-black/20 px-3 py-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-white">{listing.title}</p>
                                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                                  {listing.status ?? 'unknown'}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                                <span>ID: {listing.id}</span>
                                {listing.dealerName && <span>{listing.dealerName}</span>}
                                {listing.price && <span>{listing.price}</span>}
                                {listing.updatedAt && (
                                  <span>
                                    {t('admin.updatedOn', {
                                      defaultValue: 'Updated on {{date}}',
                                      date: formatDateTime(
                                        typeof listing.updatedAt === 'string' ? listing.updatedAt : null,
                                      ),
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Power className="h-4 w-4 text-gray-cyan" />
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                    {t('admin.userAccountActions', { defaultValue: 'Account actions' })}
                  </h4>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => handleUserStatusChange('suspended')}
                    disabled={!canSuspendTarget || userAdminActionLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {userAdminActionLoading && !canReactivateTarget ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Power size={16} />
                    )}
                    <span>{t('admin.suspendUser', { defaultValue: 'Suspend user' })}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUserStatusChange('active')}
                    disabled={!canReactivateTarget || userAdminActionLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {userAdminActionLoading && !canSuspendTarget ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw size={16} />
                    )}
                    <span>{t('admin.reactivateUser', { defaultValue: 'Reactivate user' })}</span>
                  </button>
                </div>

                <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400">
                  {t('admin.userActionsHint', {
                    defaultValue:
                      'Suspension disables Firebase Auth sign-in and marks the profile as suspended. Reactivation restores sign-in for normal user accounts.',
                  })}
                </div>

                {userAdminResult.adminRoleIds.length > 0 && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400">
                    <p className="font-semibold uppercase tracking-wide text-white/80">
                      {t('admin.userAdminRoles', { defaultValue: 'Admin presets' })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {userAdminResult.adminRoleIds.map(roleId => (
                        <span
                          key={roleId}
                          className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-medium text-gray-200"
                        >
                          {ADMIN_ROLE_PRESETS[roleId]?.label ?? roleId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-gray-cyan" />
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                    {t('admin.internalAdminNotes', { defaultValue: 'Internal admin notes' })}
                  </h4>
                </div>

                <div className="space-y-4">
                  <label className="flex flex-col gap-2 text-sm text-gray-300">
                    <span className="font-medium text-white">
                      {t('admin.addInternalNote', { defaultValue: 'Add internal note' })}
                    </span>
                    <textarea
                      value={userAdminNoteDraft}
                      onChange={event => setUserAdminNoteDraft(event.target.value)}
                      disabled={!canAddUserNotes || userAdminNoteSaving}
                      rows={4}
                      placeholder={t('admin.internalNotePlaceholder', {
                        defaultValue:
                          'Add context for future admins, moderation notes, or support follow-up details.',
                      })}
                      className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleUserAdminNoteCreate()}
                    disabled={!canAddUserNotes || userAdminNoteSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {userAdminNoteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
                    <span>{t('admin.saveInternalNote', { defaultValue: 'Save internal note' })}</span>
                  </button>

                  {userAdminNotes.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-500">
                      {t('admin.internalNotesEmpty', {
                        defaultValue: 'No internal admin notes have been recorded for this account yet.',
                      })}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {userAdminNotes.map(note => (
                        <article
                          key={note.id}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <p className="whitespace-pre-wrap text-sm text-gray-200">{note.body}</p>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                            <span>{note.createdByEmail || note.createdByUid}</span>
                            {note.createdAt && (
                              <span>{formatDateTime(typeof note.createdAt === 'string' ? note.createdAt : null)}</span>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-gray-cyan" />
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                    {t('admin.recentAdminHistory', { defaultValue: 'Recent admin history' })}
                  </h4>
                </div>

                {userRecentAuditLogs.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-500">
                    {t('admin.recentAdminHistoryEmpty', {
                      defaultValue: 'No recent privileged actions are linked to this account yet.',
                    })}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {userRecentAuditLogs.map(log => (
                      <article
                        key={log.id}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-gray-100">
                            {formatAuditActionLabel(log.action)}
                          </span>
                          {log.createdAt && (
                            <span className="text-xs text-gray-500">
                              {formatDateTime(typeof log.createdAt === 'string' ? log.createdAt : null)}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-white">{log.summary}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                          <span>{t('admin.auditActorLabel', { defaultValue: 'Actor' })}: {log.actorEmail || log.actorUid}</span>
                          <span>{log.entityType}:{log.entityId}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAuditPanel = () => {
    if (!canViewAudit) {
      return (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            {renderEmptyState(
              t('admin.auditLogUnavailable', {
                defaultValue: 'You do not have permission to view the audit log.',
              }),
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">
                {t('admin.auditLogTab', { defaultValue: 'Audit log' })}
              </h2>
              <p className="max-w-3xl text-sm text-gray-400">
                {t('admin.auditLogDescription', {
                  defaultValue:
                    'Review recent privileged platform actions, including dealer-plan assignments, admin-access changes, and user status updates.',
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAuditLogs(true)}
              disabled={auditLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {auditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw size={16} />}
              <span>{t('admin.refreshAuditLog', { defaultValue: 'Refresh audit log' })}</span>
            </button>
          </div>

          {auditError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {auditError}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          {auditLoading && !auditLoaded ? (
            renderLoadingState()
          ) : auditLogs.length === 0 ? (
            renderEmptyState(
              t('admin.auditLogEmpty', {
                defaultValue: 'No privileged audit entries have been recorded yet.',
              }),
            )
          ) : (
            <div className="space-y-4">
              {auditLogs.map(log => {
                const beforeBlock = formatJsonBlock(log.before ?? null);
                const afterBlock = formatJsonBlock(log.after ?? null);
                const metadataBlock = formatJsonBlock(log.metadata ?? null);
                const createdAt = typeof log.createdAt === 'string' ? formatDateTime(log.createdAt) : null;

                return (
                  <article
                    key={log.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-2 py-1 text-[11px] font-semibold text-gray-100">
                            {formatAuditActionLabel(log.action)}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-gray-300">
                            {log.entityType}:{log.entityId}
                          </span>
                          {createdAt && (
                            <span className="text-xs text-gray-500">{createdAt}</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-white">{log.summary}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                          <span>
                            {t('admin.auditActorLabel', { defaultValue: 'Actor' })}: {log.actorEmail || log.actorUid}
                          </span>
                          {log.targetUid && (
                            <span>
                              {t('admin.auditTargetLabel', { defaultValue: 'Target' })}: {log.targetEmail || log.targetUid}
                            </span>
                          )}
                        </div>
                        {Array.isArray(log.actorAdminRoleIds) && log.actorAdminRoleIds.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {log.actorAdminRoleIds.map(roleId => (
                              <span
                                key={`${log.id}-${roleId}`}
                                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-gray-300"
                              >
                                {ADMIN_ROLE_PRESETS[roleId]?.label ?? roleId}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {(beforeBlock || afterBlock || metadataBlock) && (
                      <div className="mt-4 grid gap-4 xl:grid-cols-3">
                        {beforeBlock && (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              {t('admin.auditBefore', { defaultValue: 'Before' })}
                            </p>
                            <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-gray-300">
                              {beforeBlock}
                            </pre>
                          </div>
                        )}
                        {afterBlock && (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              {t('admin.auditAfter', { defaultValue: 'After' })}
                            </p>
                            <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-gray-300">
                              {afterBlock}
                            </pre>
                          </div>
                        )}
                        {metadataBlock && (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              {t('admin.auditMetadata', { defaultValue: 'Metadata' })}
                            </p>
                            <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-gray-300">
                              {metadataBlock}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          </div>
      </div>
    );
  };

  const renderAccessPanel = () => {
    if (!canManageAdminAccess) {
      return (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            {renderEmptyState(
              t('admin.accessControlUnavailable', {
                defaultValue: 'You do not have permission to manage platform admin access.',
              }),
            )}
          </div>
        </div>
      );
    }

    const currentDirectPermissionEntries = Object.entries(adminAccessResult?.directPermissions ?? {});
    const initialRoleIds = adminAccessResult?.adminRoleIds ?? [];
    const initialRoleSet = new Set(initialRoleIds);
    const draftRoleSet = new Set(adminAccessRoleDraftIds);
    const hasRoleDraftChanges =
      initialRoleSet.size !== draftRoleSet.size ||
      adminAccessRoleDraftIds.some(roleId => !initialRoleSet.has(roleId));
    const initialStatus = adminAccessResult?.accountStatus ?? 'active';
    const initialDirectPermissions = adminAccessResult?.directPermissions ?? {};
    const directPermissionKeys = new Set<PermissionKey>([
      ...Object.keys(initialDirectPermissions),
      ...Object.keys(adminAccessDirectPermissionDraft),
    ] as PermissionKey[]);
    const hasDirectPermissionDraftChanges = Array.from(directPermissionKeys).some(
      permission => initialDirectPermissions[permission] !== adminAccessDirectPermissionDraft[permission],
    );
    const isDraftDirty =
      hasRoleDraftChanges ||
      adminAccessStatusDraft !== initialStatus ||
      (isMasterAdmin && hasDirectPermissionDraftChanges);
    const isDealerLikeTarget =
      adminAccessResult?.accountType === 'dealer' ||
      adminAccessResult?.accountType === 'dealer_staff' ||
      adminAccessResult?.role === 'dealer' ||
      adminAccessResult?.role === 'pending';
    const isProtectedMasterAdminTarget = Boolean(adminAccessResult?.isMasterAdmin && !isMasterAdmin);
    const isSelfTarget = Boolean(adminAccessResult?.uid && user?.uid === adminAccessResult.uid);
    const controlsDisabled =
      !adminAccessResult ||
      adminAccessSaving ||
      adminAccessLookupLoading ||
      isDealerLikeTarget ||
      isProtectedMasterAdminTarget ||
      isSelfTarget;
    const canRevokeAdminAccess = Boolean((adminAccessResult?.adminRoleIds?.length ?? 0) > 0);
    const effectivePermissions = getEffectivePermissions(
      adminAccessRoleDraftIds,
      adminAccessDirectPermissionDraft,
    );
    const effectivePermissionGroups = permissionGroups
      .map(group => ({
        ...group,
        permissions: group.permissions.filter(permission => effectivePermissions.has(permission)),
      }))
      .filter(group => group.permissions.length > 0);
    const selectedAdminUid = adminAccessResult?.uid ?? null;

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">
                {t('admin.accessControlHeading', { defaultValue: 'Platform admin access control' })}
              </h2>
              <p className="max-w-3xl text-sm text-gray-400">
                {t('admin.accessControlDescription', {
                  defaultValue:
                    'Search for an existing user account by email or UID, then assign scoped platform-admin roles. Dealer and pending accounts stay outside this flow.',
                })}
              </p>
            </div>
            <div className="rounded-xl border border-gray-cyan/20 bg-gray-cyan/10 px-4 py-3 text-xs text-gray-100">
              {t('admin.accessControlNote', {
                defaultValue:
                  'Use separate platform-admin accounts. Direct overrides should be reserved for exceptions, not normal role design.',
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                    {t('admin.platformAdminRoster', { defaultValue: 'Current platform admins' })}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('admin.platformAdminRosterDescription', {
                      defaultValue:
                        'Select an existing admin account to inspect or update its presets and overrides.',
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAdminAccessRoster(true)}
                  disabled={adminRosterLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adminRosterLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw size={14} />}
                  <span>{t('admin.refreshAdminRoster', { defaultValue: 'Refresh' })}</span>
                </button>
              </div>

              {adminRosterError && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {adminRosterError}
                </div>
              )}

              {adminRosterLoading && !adminRosterLoaded ? (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-sm text-gray-300">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-cyan" />
                  <span>{t('admin.loadingAdminRoster', { defaultValue: 'Loading platform admins...' })}</span>
                </div>
              ) : adminRoster.length === 0 ? (
                renderEmptyState(
                  t('admin.adminRosterEmpty', {
                    defaultValue: 'No platform-admin accounts have been assigned yet.',
                  }),
                )
              ) : (
                <div className="space-y-3">
                  {adminRoster.map(adminEntry => {
                    const isSelected = adminEntry.uid === selectedAdminUid;

                    return (
                      <button
                        key={adminEntry.uid}
                        type="button"
                        onClick={() => selectAdminAccessTarget(adminEntry)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-gray-cyan/40 bg-gray-cyan/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">
                            {adminEntry.displayName ||
                              adminEntry.email ||
                              t('admin.accessControlUnnamedUser', { defaultValue: 'Unnamed account' })}
                          </p>
                          {adminEntry.isMasterAdmin && (
                            <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                              {t('admin.masterAdminBadge', { defaultValue: 'Master admin' })}
                            </span>
                          )}
                          {user?.uid === adminEntry.uid && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                              {t('admin.currentAccountBadge', { defaultValue: 'Current account' })}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-gray-400">
                          {adminEntry.email ?? t('admin.missingEmail', { defaultValue: 'No email on file' })}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                            {t('admin.accessAccountStatusBadge', {
                              defaultValue: 'Status: {{status}}',
                              status: adminEntry.accountStatus ?? 'active',
                            })}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                            {t('admin.accessPresetCountBadge', {
                              defaultValue: '{{count}} preset(s)',
                              count: adminEntry.adminRoleIds.length,
                            })}
                          </span>
                        </div>
                        {adminEntry.updatedAt && (
                          <p className="mt-3 text-[11px] text-gray-500">
                            {t('admin.adminRosterUpdatedAt', {
                              defaultValue: 'Updated {{date}}',
                              date: formatDateTime(adminEntry.updatedAt),
                            })}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <form
                onSubmit={handleAdminAccessLookup}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:flex-row lg:items-end"
              >
                <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-gray-300">
                  <span className="font-medium text-white">
                    {t('admin.accessLookupLabel', {
                      defaultValue: 'User email or UID',
                    })}
                  </span>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={adminAccessQuery}
                      onChange={event => setAdminAccessQuery(event.target.value)}
                      placeholder={t('admin.accessLookupPlaceholder', {
                        defaultValue: 'name@example.com or Firebase UID',
                      })}
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-sm text-white focus:border-gray-cyan/50 focus:outline-none"
                    />
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={adminAccessLookupLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adminAccessLookupLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                  <span>{t('admin.accessLookupButton', { defaultValue: 'Find account' })}</span>
                </button>
              </form>

              {adminAccessLookupError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {adminAccessLookupError}
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
                <p className="font-semibold text-white">
                  {t('admin.accessLookupHintHeading', { defaultValue: 'Lookup and roster can be used together' })}
                </p>
                <p className="mt-2">
                  {t('admin.accessLookupHintDescription', {
                    defaultValue:
                      'Use the roster for known platform admins, or search by UID/email when preparing a new account for admin access.',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {adminAccessResult && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">
                    {adminAccessResult.displayName ||
                      adminAccessResult.email ||
                      t('admin.accessControlUnnamedUser', { defaultValue: 'Unnamed account' })}
                  </h3>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-gray-300">
                    UID: {adminAccessResult.uid}
                  </span>
                  {adminAccessResult.isMasterAdmin && (
                    <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-100">
                      {t('admin.masterAdminBadge', { defaultValue: 'Master admin' })}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                  <span className="inline-flex items-center rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-2 py-1 text-gray-100">
                    {t('admin.accessRoleBadge', {
                      defaultValue: 'Role: {{role}}',
                      role: adminAccessResult.role,
                    })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                    {t('admin.accessAccountTypeBadge', {
                      defaultValue: 'Type: {{type}}',
                      type: adminAccessResult.accountType ?? 'user',
                    })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                    {t('admin.accessAccountStatusBadge', {
                      defaultValue: 'Status: {{status}}',
                      status: adminAccessResult.accountStatus ?? 'active',
                    })}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-gray-400">
                  <p>{adminAccessResult.email ?? t('admin.missingEmail', { defaultValue: 'No email on file' })}</p>
                  {adminAccessResult.dealerPlanId && (
                    <p>
                      {t('admin.dealerPlanContext', {
                        defaultValue: 'Dealer plan context: {{plan}} / {{status}}',
                        plan: adminAccessResult.dealerPlanId,
                        status: adminAccessResult.dealerSubscriptionStatus ?? 'active',
                      })}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-300">
                <p className="font-semibold uppercase tracking-wide text-white/80">
                  {t('admin.currentAdminPresets', { defaultValue: 'Current admin presets' })}
                </p>
                <div className="mt-2 flex max-w-md flex-wrap gap-2">
                  {initialRoleIds.length > 0 ? (
                    initialRoleIds.map(roleId => (
                      <span
                        key={roleId}
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-gray-200"
                      >
                        {ADMIN_ROLE_PRESETS[roleId]?.label ?? roleId}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">
                      {t('admin.noAdminPresets', { defaultValue: 'No platform-admin access assigned.' })}
                    </span>
                  )}
                </div>
                {currentDirectPermissionEntries.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="font-semibold uppercase tracking-wide text-white/80">
                      {t('admin.directPermissionOverrides', {
                        defaultValue: 'Direct permission overrides',
                      })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {currentDirectPermissionEntries.map(([permission, value]) => (
                        <span
                          key={permission}
                          className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${
                            value === true
                              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                              : 'border-red-400/30 bg-red-500/10 text-red-100'
                          }`}
                        >
                          {permission}: {String(value)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isDealerLikeTarget && (
              <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {t('admin.dealerAccountAdminWarning', {
                  defaultValue:
                    'This account is still mapped as a dealer or pending account. Use a separate user account for platform-admin access.',
                })}
              </div>
            )}

            {isProtectedMasterAdminTarget && (
              <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {t('admin.masterAdminEditWarning', {
                  defaultValue:
                    'Only a master admin can modify another master-admin account or grant the master-admin role.',
                })}
              </div>
            )}

            {isSelfTarget && (
              <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {t('admin.selfAdminEditWarning', {
                  defaultValue:
                    'Use a separate platform-admin account to change your own privileges. Self-edits are blocked through this control surface.',
                })}
              </div>
            )}

            <div className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-cyan" />
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                    {t('admin.assignAdminPresets', { defaultValue: 'Assign admin presets' })}
                  </h4>
                </div>
                <div className="space-y-3">
                  {adminRoleOptions.map(([roleId, preset]) => {
                    const checked = adminAccessRoleDraftIds.includes(roleId);
                    const disabled = controlsDisabled || (roleId === 'master_admin' && !isMasterAdmin);

                    return (
                      <label
                        key={roleId}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                          checked
                            ? 'border-gray-cyan/40 bg-gray-cyan/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAdminAccessRoleDraft(roleId)}
                          disabled={disabled}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{preset.label}</span>
                            {roleId === 'master_admin' && (
                              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100">
                                {t('admin.highPrivilege', { defaultValue: 'High privilege' })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{preset.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Key className="h-4 w-4 text-gray-cyan" />
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                      {t('admin.accessControls', { defaultValue: 'Access controls' })}
                    </h4>
                  </div>

                  <label className="flex flex-col gap-2 text-sm text-gray-300">
                    <span className="font-medium text-white">
                      {t('admin.adminAccountStatusLabel', { defaultValue: 'Admin account status' })}
                    </span>
                    <select
                      value={adminAccessStatusDraft}
                      onChange={event => setAdminAccessStatusDraft(event.target.value as AccountStatus)}
                      disabled={controlsDisabled}
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {ADMIN_ACCOUNT_STATUSES.map(status => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mt-6 space-y-3">
                    <button
                      type="button"
                      onClick={handleAdminAccessSave}
                      disabled={!isDraftDirty || controlsDisabled}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {adminAccessSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      <span>{t('admin.saveAdminAccess', { defaultValue: 'Save access changes' })}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAdminAccessRevoke}
                      disabled={controlsDisabled || !canRevokeAdminAccess}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle size={16} />
                      <span>{t('admin.removeAdminAccessButton', { defaultValue: 'Remove admin access' })}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => adminAccessResult && hydrateAdminAccessDraft(adminAccessResult)}
                      disabled={!isDraftDirty || adminAccessSaving}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCcw size={16} />
                      <span>{t('admin.resetAdminAccessDraft', { defaultValue: 'Reset changes' })}</span>
                    </button>
                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400">
                    {t('admin.removeAdminAccessHint', {
                      defaultValue:
                        'Role presets should cover the normal case. Use direct overrides only when a specific permission needs to be added or blocked.',
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-gray-cyan" />
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                      {t('admin.effectivePermissionsHeading', { defaultValue: 'Effective permissions preview' })}
                    </h4>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400">
                    {t('admin.effectivePermissionsSummary', {
                      defaultValue: '{{count}} effective permission(s) after presets and overrides are applied.',
                      count: effectivePermissions.size,
                    })}
                  </div>

                  <div className="mt-4 max-h-[360px] space-y-4 overflow-y-auto pr-1">
                    {effectivePermissionGroups.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t('admin.effectivePermissionsEmpty', {
                          defaultValue: 'No platform-admin permissions are currently effective for this account.',
                        })}
                      </p>
                    ) : (
                      effectivePermissionGroups.map(group => (
                        <div key={group.group}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                            {group.label}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {group.permissions.map(permission => (
                              <span
                                key={permission}
                                className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-100"
                              >
                                {formatPermissionActionLabel(permission)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-cyan" />
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                      {t('admin.directPermissionOverrideEditor', {
                        defaultValue: 'Direct permission overrides',
                      })}
                    </h4>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('admin.directPermissionOverrideDescription', {
                        defaultValue:
                          'Override a specific permission to allow it, deny it, or inherit it from the assigned role presets.',
                      })}
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-300">
                  {t('admin.overrideCountBadge', {
                    defaultValue: '{{count}} override(s)',
                    count: Object.keys(adminAccessDirectPermissionDraft).length,
                  })}
                </span>
              </div>

              {!isMasterAdmin && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {t('admin.directOverridesMasterOnly', {
                    defaultValue:
                      'Only a master admin can change direct permission overrides. You can still inspect the current override state here.',
                  })}
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                {permissionGroups.map(group => (
                  <section key={group.group} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <h5 className="text-sm font-semibold text-white">{group.label}</h5>
                    <div className="mt-3 space-y-3">
                      {group.permissions.map(permission => {
                        const overrideValue = adminAccessDirectPermissionDraft[permission];
                        const selectValue: PermissionOverrideOption =
                          overrideValue === true ? 'allow' : overrideValue === false ? 'deny' : 'inherit';
                        const isGranted = effectivePermissions.has(permission);

                        return (
                          <div
                            key={permission}
                            className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-white">
                                  {formatPermissionActionLabel(permission)}
                                </p>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                    isGranted
                                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                                      : 'border-white/10 bg-black/20 text-gray-400'
                                  }`}
                                >
                                  {isGranted
                                    ? t('admin.permissionGranted', { defaultValue: 'Granted' })
                                    : t('admin.permissionBlocked', { defaultValue: 'Blocked' })}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">{permission}</p>
                            </div>
                            <select
                              value={selectValue}
                              onChange={event =>
                                setAdminAccessDirectPermissionOverride(
                                  permission,
                                  event.target.value as PermissionOverrideOption,
                                )
                              }
                              disabled={!isMasterAdmin || controlsDisabled}
                              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {PERMISSION_OVERRIDE_OPTIONS.map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">
                {t('admin.adminInviteHeading', { defaultValue: 'Invite new platform admins' })}
              </h3>
              <p className="max-w-3xl text-sm text-gray-400">
                {t('admin.adminInviteDescription', {
                  defaultValue:
                    'Create secure invite links for future platform admins. The invited user signs in with the target email address and accepts the invite through the backend-audited flow.',
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAdminInvites(true)}
              disabled={adminInvitesLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {adminInvitesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw size={16} />}
              <span>{t('admin.refreshInvites', { defaultValue: 'Refresh invites' })}</span>
            </button>
          </div>

          {adminInviteError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {adminInviteError}
            </div>
          )}

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="space-y-4">
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  <span className="font-medium text-white">
                    {t('admin.inviteEmailLabel', { defaultValue: 'Invite email' })}
                  </span>
                  <input
                    type="email"
                    value={adminInviteEmail}
                    onChange={event => setAdminInviteEmail(event.target.value)}
                    placeholder={t('admin.inviteEmailPlaceholder', {
                      defaultValue: 'new-admin@example.com',
                    })}
                    className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none"
                  />
                </label>

                <div>
                  <p className="text-sm font-medium text-white">
                    {t('admin.inviteRoleSelection', { defaultValue: 'Invite presets' })}
                  </p>
                  <div className="mt-3 space-y-3">
                    {adminRoleOptions.map(([roleId, preset]) => {
                      const checked = adminInviteRoleDraftIds.includes(roleId);
                      const disabled = adminInviteCreating || (roleId === 'master_admin' && !isMasterAdmin);

                      return (
                        <label
                          key={`invite-${roleId}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                            checked
                              ? 'border-gray-cyan/40 bg-gray-cyan/10'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAdminInviteRoleDraft(roleId)}
                            disabled={disabled}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{preset.label}</span>
                              {roleId === 'master_admin' && (
                                <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100">
                                  {t('admin.highPrivilege', { defaultValue: 'High privilege' })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">{preset.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateAdminInvite()}
                  disabled={adminInviteCreating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adminInviteCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus size={16} />}
                  <span>{t('admin.createAdminInvite', { defaultValue: 'Create invite link' })}</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-center gap-2">
                <Key className="h-4 w-4 text-gray-cyan" />
                <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                  {t('admin.recentInvites', { defaultValue: 'Recent invites' })}
                </h4>
              </div>

              {adminInvitesLoading && !adminInvitesLoaded ? (
                renderLoadingState()
              ) : adminInvites.length === 0 ? (
                renderEmptyState(
                  t('admin.adminInvitesEmpty', {
                    defaultValue: 'No platform admin invites have been created yet.',
                  }),
                )
              ) : (
                <div className="space-y-3">
                  {adminInvites.map(invite => (
                    <article key={invite.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{invite.email}</p>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                          {invite.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(invite.adminRoleIds ?? []).map(roleId => (
                          <span
                            key={`${invite.id}-${roleId}`}
                            className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-medium text-gray-200"
                          >
                            {ADMIN_ROLE_PRESETS[roleId]?.label ?? roleId}
                          </span>
                        ))}
                      </div>
                      {invite.createdAt && (
                        <p className="mt-2 text-xs text-gray-500">
                          {t('admin.inviteCreatedAt', {
                            defaultValue: 'Created {{date}}',
                            date: formatDateTime(typeof invite.createdAt === 'string' ? invite.createdAt : null),
                          })}
                        </p>
                      )}
                      {invite.inviteUrl && (
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">
                            {t('admin.inviteLinkLabel', { defaultValue: 'Invite link' })}
                          </p>
                          <p className="mt-2 break-all text-xs text-gray-300">{invite.inviteUrl}</p>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {invite.inviteUrl && (
                          <button
                            type="button"
                            onClick={() => void handleCopyInviteLink(invite)}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
                          >
                            <ExternalLink size={14} />
                            <span>{t('admin.copyInviteLink', { defaultValue: 'Copy link' })}</span>
                          </button>
                        )}
                        {invite.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => void handleRevokeAdminInvite(invite.id)}
                            disabled={adminInviteRevokingId === invite.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {adminInviteRevokingId === invite.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle size={14} />
                            )}
                            <span>{t('admin.revokeInvite', { defaultValue: 'Revoke' })}</span>
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
      </div>
    );
  };

  const renderModelsPanel = () => {
    const modelUpdateLoading =
      modelMutations.update.loading || modelAction?.type === 'toggleVisibility';
    const modelDeleteLoading =
      modelMutations.delete.loading || modelAction?.type === 'delete';
    let content: React.ReactNode;
    if (loadError) {
      content = renderErrorState();
    } else if (loading) {
      content = renderLoadingState();
    } else {
      content = (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <header className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">{t('admin.modelsList', { defaultValue: 'Models' })}</h3>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300">{models.length}</span>
          </header>

          <div className="mb-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-4">
              {[
                { label: t('admin.all'), value: 'all' },
                { label: t('admin.featured'), value: 'featured' },
                { label: t('admin.visible'), value: 'visible' },
                { label: t('admin.hidden'), value: 'hidden' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setModelFilter(tab.value as any)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    modelFilter === tab.value
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('admin.searchModels', { defaultValue: 'Search models by name or brand...' })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSelectAll(filteredModels.map(m => m.id))}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1"
                >
                  {selectedIds.length === filteredModels.length && filteredModels.length > 0
                    ? t('admin.deselectAll', { defaultValue: 'Deselect All' })
                    : t('admin.selectAll', { defaultValue: 'Select All' })}
                </button>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 animate-in fade-in slide-in-from-top-2">
                <span className="text-xs font-medium text-emerald-200">
                  {t('admin.selectedCount', { defaultValue: '{{count}} selected', count: selectedIds.length })}
                </span>
                <div className="h-4 w-px bg-emerald-500/20 mx-1" />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleBulkModelAction('toggleFeatured')}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 whitespace-nowrap"
                  >
                    <Shield size={14} /> {t('admin.toggleFeatured', { defaultValue: 'Toggle Featured' })}
                  </button>
                  <button
                    onClick={() => handleBulkModelAction('toggleVisibility')}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 whitespace-nowrap"
                  >
                    {modelFilter === 'hidden' ? <Eye size={14} /> : <EyeOff size={14} />}
                    {modelFilter === 'hidden' ? t('admin.show') : t('admin.hide')}
                  </button>
                  <button
                    onClick={() => handleBulkModelAction('delete')}
                    className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 whitespace-nowrap"
                  >
                    <Trash2 size={14} /> {t('admin.delete')}
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="p-1.5 text-gray-400 hover:text-white"
                    title="Clear Selection"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {filteredModels.length === 0 ? (
            renderEmptyState(t('admin.noModels'))
          ) : (
            <ul className="divide-y divide-white/5">
              {filteredModels.map(model => (
                <li key={model.id} className="group flex items-start gap-4 py-4 first:pt-0 last:pb-0 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors px-2 -mx-2 rounded-lg">
                  <div className="pt-1.5 select-none">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(model.id)}
                      onChange={() => toggleSelect(model.id)}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50 transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{model.brand} {model.model_name}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {model.range_wltp
                          ? t('modelsPage.range', { defaultValue: 'Range (WLTP)' }) + ': ' + model.range_wltp + ' km'
                          : t('admin.rangeUnknown', { defaultValue: 'Range unknown' })}
                      </p>
                      {model.isFeatured && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
                          {t('admin.featured')}
                        </span>
                      )}
                      {model.reviewStatus === 'pending_review' && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-100">
                          {t('admin.pendingReview', { defaultValue: 'Pending review' })}
                        </span>
                      )}
                      {model.reviewStatus === 'rejected' && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-100">
                          {t('admin.rejected', { defaultValue: 'Rejected' })}
                        </span>
                      )}
                      {model.isActive === false && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border border-white/10">
                          {t('admin.hidden')}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {canReadModels && (
                        <button
                          onClick={() => openModelControlCenter(model)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
                          aria-label={t('admin.modelControlCenter', { defaultValue: 'Control center' })}
                        >
                          <Shield size={14} />
                          <span>{t('admin.modelControlCenter', { defaultValue: 'Control center' })}</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleModelVisibility(model)}
                        disabled={modelUpdateLoading}
                        className={`inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          model.isActive === false 
                            ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' 
                            : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                        }`}
                        aria-label={model.isActive === false ? t('admin.show') : t('admin.hide')}
                      >
                        {model.isActive === false ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span>{model.isActive === false ? t('admin.show') : t('admin.hide')}</span>
                      </button>
                      <button
                        onClick={() => setModelFormState({ mode: 'edit', entity: model })}
                        disabled={modelUpdateLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={t('admin.editModel')}
                      >
                        <Pencil size={14} />
                        <span>{t('admin.edit')}</span>
                      </button>
                      <button
                        onClick={() => confirmAndDelete(() => handleDeleteModel(model.id))}
                        disabled={modelDeleteLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={t('admin.delete')}
                      >
                        {modelAction?.id === model.id && modelAction?.type === 'delete' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        <span>{t('admin.delete')}</span>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">{t('admin.manageModels')}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setBulkEntity('models')}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <Upload size={16} />
              <span>{t('admin.bulkUploadModels', { defaultValue: 'Bulk upload models' })}</span>
            </button>
            <button
              onClick={() => setModelFormState({ mode: 'create' })}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-cyan/90"
            >
              <Plus size={16} />
              <span>{t('admin.addNewModel')}</span>
            </button>
          </div>
        </div>

        {content}
      </div>
    );
  };

  const renderListingsPanel = () => {
    if (loadError) {
      return renderErrorState();
    }
    if (loading) {
      return renderLoadingState();
    }
    
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-white">
          {t('admin.manageListings', { defaultValue: 'Manage listings' })} ({listings.length})
        </h2>
        <Suspense
          fallback={
            <AdminLazyFallback
              label={t('admin.loadingListingsPanel', { defaultValue: 'Loading listings tools...' })}
            />
          }
        >
          <AdminListingsTab
            listings={listings}
            dealers={dealers}
            onUpdateStatus={async (id, status) => {
              await updateAdminListing({ listingId: id, status });
              if (listingControlListing?.id === id) {
                await loadListingControlDetail(id);
              }
            }}
            onDelete={async (id) => {
              await updateAdminListing({ listingId: id, status: 'deleted' });
              if (listingControlListing?.id === id) {
                await loadListingControlDetail(id);
              }
            }}
            onOpenControlCenter={openListingControlCenter}
            canOpenControlCenter={canReadListings}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={toggleSelectAll}
            onBulkAction={handleBulkListingAction}
          />
        </Suspense>
      </div>
    );
  };

  const renderBlogPanel = () => {
    const blogUpdateLoading =
      blogPostMutations.update.loading || blogAction?.type === 'toggleStatus';
    const blogDeleteLoading =
      blogPostMutations.delete.loading || blogAction?.type === 'delete';
    let content: React.ReactNode;
    if (loadError) {
      content = renderErrorState();
    } else if (loading) {
      content = renderLoadingState();
    } else {
      content = (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <header className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">{t('admin.blogPosts')}</h3>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300">{blogPosts.length}</span>
          </header>

          <div className="mb-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-4">
              {[
                { label: t('admin.all'), value: 'all' },
                { label: t('admin.statusPublished'), value: 'published' },
                { label: t('admin.statusDraft'), value: 'draft' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setBlogFilter(tab.value as any)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    blogFilter === tab.value
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('admin.searchBlog', { defaultValue: 'Search blog posts...' })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSelectAll(filteredBlogPosts.map(p => p.id))}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1"
                >
                  {selectedIds.length === filteredBlogPosts.length && filteredBlogPosts.length > 0
                    ? t('admin.deselectAll', { defaultValue: 'Deselect All' })
                    : t('admin.selectAll', { defaultValue: 'Select All' })}
                </button>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 animate-in fade-in slide-in-from-top-2">
                <span className="text-xs font-medium text-emerald-200">
                  {t('admin.selectedCount', { defaultValue: '{{count}} selected', count: selectedIds.length })}
                </span>
                <div className="h-4 w-px bg-emerald-500/20 mx-1" />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleBulkBlogAction('publish')}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 whitespace-nowrap"
                  >
                    <CheckCircle className="h-4 w-4" /> {t('admin.publish', { defaultValue: 'Publish' })}
                  </button>
                  <button
                    onClick={() => handleBulkBlogAction('draft')}
                    className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/30 whitespace-nowrap"
                  >
                    <Pencil className="h-4 w-4" /> {t('admin.draft', { defaultValue: 'Draft' })}
                  </button>
                  <button
                    onClick={() => handleBulkBlogAction('delete')}
                    className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 whitespace-nowrap"
                  >
                    <Trash2 size={14} /> {t('admin.delete')}
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="p-1.5 text-gray-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {filteredBlogPosts.length === 0 ? (
            renderEmptyState(t('admin.noBlogPosts'))
          ) : (
            <ul className="divide-y divide-white/5">
              {filteredBlogPosts.map(post => (
                <li key={post.id} className="group flex items-start gap-4 py-4 first:pt-0 last:pb-0 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors px-2 -mx-2 rounded-lg">
                  <div className="pt-1.5 select-none">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(post.id)}
                      onChange={() => toggleSelect(post.id)}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50 transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{post.title}</p>
                      <p className="mt-1 text-sm text-gray-300">{post.author}</p>
                      <p className="mt-2 text-xs text-gray-400">
                        {post.date
                          ? new Date(post.date).toLocaleDateString()
                          : t('admin.dateUnknown', { defaultValue: 'Date unknown' })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleBlogStatus(post)}
                        disabled={blogUpdateLoading}
                        className={`inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          post.status !== 'published' 
                            ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' 
                            : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                        }`}
                        aria-label={post.status !== 'published' ? t('admin.publish') : t('admin.draft')}
                      >
                        {post.status !== 'published' ? <CheckCircle size={14} /> : <EyeOff size={14} />}
                        <span>{post.status !== 'published' ? t('admin.publish') : t('admin.draft')}</span>
                      </button>
                      <button
                        onClick={() => setBlogFormState({ mode: 'edit', entity: post })}
                        disabled={blogUpdateLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={t('admin.editBlogPost')}
                      >
                        <Pencil size={14} />
                        <span>{t('admin.edit')}</span>
                      </button>
                      <button
                        onClick={() => confirmAndDelete(() => handleDeleteBlogPost(post.id))}
                        disabled={blogDeleteLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={t('admin.delete')}
                      >
                        {blogAction?.id === post.id && blogAction?.type === 'delete' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        <span>{t('admin.delete')}</span>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">{t('admin.manageBlog')}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setBlogTextImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <Upload size={16} />
              <span>{t('admin.bulkUploadPosts', { defaultValue: 'Bulk upload blog posts' })}</span>
            </button>
            <button
              onClick={() => setBlogFormState({ mode: 'create' })}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-cyan/90"
            >
              <Plus size={16} />
              <span>{t('admin.addBlogPost')}</span>
            </button>
          </div>
        </div>

        {content}
      </div>
    );
  };

  const renderSiteSettingsPanel = () => {
    const socialFields: Array<{
      key: keyof PublicSiteSettings['socialLinks'];
      label: string;
      placeholder: string;
    }> = [
      {
        key: 'facebook',
        label: 'Facebook',
        placeholder: 'https://www.facebook.com/makina-elektrike',
      },
      {
        key: 'instagram',
        label: 'Instagram',
        placeholder: 'https://www.instagram.com/makina-elektrike',
      },
      {
        key: 'twitter',
        label: 'X / Twitter',
        placeholder: 'https://twitter.com/makina-elektrike',
      },
      {
        key: 'linkedin',
        label: 'LinkedIn',
        placeholder: 'https://www.linkedin.com/company/makina-elektrike',
      },
    ];

    if (siteSettingsLoading && !siteSettingsLoaded) {
      return renderLoadingState();
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-cyan">
              {t('admin.siteSettingsEyebrow', { defaultValue: 'Public site controls' })}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              {t('admin.siteSettingsTitle', { defaultValue: 'Site settings' })}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
              {t('admin.siteSettingsDescription', {
                defaultValue:
                  'Manage footer social links and the homepage hero background image slider without editing code.',
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadSiteSettings(true)}
              disabled={siteSettingsLoading || siteSettingsSaving}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw size={16} className={siteSettingsLoading ? 'animate-spin' : ''} />
              <span>{t('admin.reloadSettings', { defaultValue: 'Reload' })}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSaveSiteSettings()}
              disabled={siteSettingsSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {siteSettingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={16} />}
              <span>{t('admin.saveSiteSettings', { defaultValue: 'Save settings' })}</span>
            </button>
          </div>
        </div>

        {siteSettingsError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {siteSettingsError}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-white">
              {t('admin.footerSocialLinksTitle', { defaultValue: 'Footer social links' })}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin.footerSocialLinksDescription', {
                defaultValue: 'These URLs control the social icon buttons shown in the public footer.',
              })}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {socialFields.map(field => (
              <label key={field.key} className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">{field.label}</span>
                <input
                  type="url"
                  value={siteSettingsDraft.socialLinks[field.key]}
                  placeholder={field.placeholder}
                  onChange={event => updateSiteSocialLink(field.key, event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-gray-cyan/70"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {t('admin.heroImagesTitle', { defaultValue: 'Homepage hero background images' })}
              </h3>
              <p className="mt-1 max-w-3xl text-sm text-gray-400">
                {t('admin.heroImagesDescription', {
                  defaultValue:
                    'Upload homepage background images to R2 or paste existing URLs. Leave the list empty to use the built-in default image.',
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={addSiteHeroImage}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-cyan/30 bg-gray-cyan/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-gray-cyan/20"
            >
              <Plus size={16} />
              <span>{t('admin.addHeroImage', { defaultValue: 'Add image' })}</span>
            </button>
          </div>

          {siteSettingsDraft.homeHeroImages.length === 0 ? (
            renderEmptyState(
              t('admin.noHeroImagesConfigured', {
                defaultValue: 'No custom hero images are configured. The homepage will use the built-in default background.',
              }),
            )
          ) : (
            <div className="space-y-4">
              {siteSettingsDraft.homeHeroImages.map((image, index) => {
                const desktopUploading =
                  siteHeroUploadTarget?.id === image.id && siteHeroUploadTarget.slot === 'desktop';
                const mobileUploading =
                  siteHeroUploadTarget?.id === image.id && siteHeroUploadTarget.slot === 'mobile';

                return (
                <article
                  key={image.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-950">
                      {image.imageUrl ? (
                        <img
                          src={image.imageUrl}
                          alt={image.alt || `Hero ${index + 1}`}
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-video w-full items-center justify-center text-gray-500">
                          <ImageIcon size={28} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm font-semibold text-white">
                          {t('admin.heroImageLabel', {
                            defaultValue: 'Hero image {{index}}',
                            index: index + 1,
                          })}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeSiteHeroImage(image.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20"
                        >
                          <Trash2 size={14} />
                          <span>{t('admin.remove', { defaultValue: 'Remove' })}</span>
                        </button>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <label className="block text-sm text-gray-300">
                          <span>{t('admin.heroImageUrlLabel', { defaultValue: 'Desktop image URL' })}</span>
                          <input
                            type="url"
                            value={image.imageUrl}
                            placeholder="https://example.com/hero-desktop.webp"
                            onChange={event => updateSiteHeroImage(image.id, 'imageUrl', event.target.value)}
                            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-gray-cyan/70"
                          />
                        </label>
                        <label
                          className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                            desktopUploading
                              ? 'cursor-wait border border-white/10 bg-white/5 text-gray-300'
                              : 'border border-gray-cyan/30 bg-gray-cyan/10 text-cyan-100 hover:bg-gray-cyan/20'
                          }`}
                        >
                          {desktopUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          <span>
                            {desktopUploading
                              ? t('admin.uploading', { defaultValue: 'Uploading...' })
                              : t('admin.uploadDesktopHeroImage', { defaultValue: 'Upload desktop' })}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={Boolean(siteHeroUploadTarget)}
                            onChange={event => void handleSiteHeroImageUpload(image.id, 'desktop', event)}
                          />
                        </label>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <label className="block text-sm text-gray-300">
                          <span>{t('admin.heroMobileImageUrlLabel', { defaultValue: 'Mobile image URL' })}</span>
                          <input
                            type="url"
                            value={image.mobileImageUrl ?? ''}
                            placeholder="https://example.com/hero-mobile.webp"
                            onChange={event => updateSiteHeroImage(image.id, 'mobileImageUrl', event.target.value)}
                            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-gray-cyan/70"
                          />
                        </label>
                        <label
                          className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                            mobileUploading
                              ? 'cursor-wait border border-white/10 bg-white/5 text-gray-300'
                              : 'border border-gray-cyan/30 bg-gray-cyan/10 text-cyan-100 hover:bg-gray-cyan/20'
                          }`}
                        >
                          {mobileUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          <span>
                            {mobileUploading
                              ? t('admin.uploading', { defaultValue: 'Uploading...' })
                              : t('admin.uploadMobileHeroImage', { defaultValue: 'Upload mobile' })}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={Boolean(siteHeroUploadTarget)}
                            onChange={event => void handleSiteHeroImageUpload(image.id, 'mobile', event)}
                          />
                        </label>
                      </div>
                      <p className="text-xs leading-5 text-gray-500">
                        {t('admin.heroImageUploadHint', {
                          defaultValue:
                            'Upload from your computer to R2, or paste a URL manually. After uploading, click Save settings to publish the image.',
                        })}
                      </p>
                      <label className="block text-sm text-gray-300">
                        <span>{t('admin.heroImageAltLabel', { defaultValue: 'Internal alt text' })}</span>
                        <input
                          type="text"
                          value={image.alt ?? ''}
                          placeholder={t('admin.heroImageAltPlaceholder', { defaultValue: 'Electric car interior, dealership, charging scene...' })}
                          onChange={event => updateSiteHeroImage(image.id, 'alt', event.target.value)}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-gray-cyan/70"
                        />
                      </label>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderStationsPanel = () => {
    if (stationsLoading) return renderLoadingState();
    if (stationsError) return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-10 text-center text-sm text-red-200">
        <p className="text-base font-semibold">{stationsError}</p>
      </div>
    );

    const isAllSelected = filteredStations.length > 0 && 
      filteredStations.every(s => selectedIds.includes(s.id));

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">
            {t('admin.manageStations', { defaultValue: 'Manage Charging Stations' })} ({stations.length})
          </h2>
          <button
            onClick={() => setStationFormState({ mode: 'create' })}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-cyan/90"
          >
            <Plus size={16} />
            <span>{t('admin.addStation', { defaultValue: 'Add Station' })}</span>
          </button>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-4">
            {[
              { label: t('admin.all'), value: 'all' },
              { label: t('admin.statusActive'), value: 'active' },
              { label: t('admin.statusInactive'), value: 'inactive' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStationFilter(tab.value as any)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  stationFilter === tab.value
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('admin.searchStations', { defaultValue: 'Search stations by address or operator...' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-gray-cyan/50 focus:outline-none"
              />
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 animate-in fade-in slide-in-from-top-2">
              <span className="text-xs font-medium text-emerald-200">
                {t('admin.selectedCount', { defaultValue: '{{count}} selected', count: selectedIds.length })}
              </span>
              <div className="h-4 w-px bg-emerald-500/20 mx-1" />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleBulkStationAction('toggleActive')}
                  className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 whitespace-nowrap"
                >
                  {stationFilter === 'inactive' ? <Eye size={14} /> : <EyeOff size={14} />}
                  {stationFilter === 'inactive' ? t('admin.show') : t('admin.hide')}
                </button>
                <button
                  onClick={() => handleBulkStationAction('delete')}
                  className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 whitespace-nowrap"
                >
                  <Trash2 size={14} /> {t('admin.delete')}
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="p-1.5 text-gray-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {filteredStations.length === 0 ? (
          renderEmptyState(t('admin.noStationsFound', { defaultValue: 'No charging stations found.' }))
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="border-b border-white/10 bg-white/5">
                <tr>
                  <th className="px-4 py-3 min-w-[40px]">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={() => toggleSelectAll(filteredStations.map(s => s.id))}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50 transition-colors cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold text-white">{t('admin.address')}</th>
                  <th className="px-4 py-3 font-semibold text-white">{t('admin.plugTypes')}</th>
                  <th className="px-4 py-3 font-semibold text-white text-center">{t('admin.speed')}</th>
                  <th className="px-4 py-3 font-semibold text-white text-center">{t('admin.status')}</th>
                  <th className="px-4 py-3 text-right font-semibold text-white">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredStations.map(station => (
                  <tr key={station.id} className="transition-colors hover:bg-white/[0.02] group">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(station.id)}
                        onChange={() => toggleSelect(station.id)}
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50 transition-colors cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-200">{station.address}</span>
                        <span className="text-xs text-gray-500">{station.operator || 'Unknown Operator'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{station.plugTypes}</td>
                    <td className="px-4 py-3 text-center text-gray-300 font-medium">
                      {station.chargingSpeedKw} kW
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        station.isActive !== false 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {station.isActive !== false ? t('admin.visible') : t('admin.hidden')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canReadStations && (
                          <button
                            onClick={() => openStationControlCenter(station)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-indigo-500/20 px-2 py-1 text-[10px] font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
                          >
                            <Shield size={10} />
                            {t('admin.stationControlCenter', { defaultValue: 'Control center' })}
                          </button>
                        )}
                        {station.googleMapsLink && (
                          <a
                            href={station.googleMapsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-400 transition hover:bg-white/10 hover:text-white"
                          >
                            <ExternalLink size={10} />
                            {t('admin.viewMap', { defaultValue: 'Map' })}
                          </a>
                        )}
                        <button
                          onClick={() => handleToggleStationVisibility(station)}
                          disabled={stationAction !== null}
                          className={`inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold transition ${
                            station.isActive === false 
                              ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' 
                              : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                          }`}
                        >
                          {stationAction?.id === station.id &&
                          stationAction?.type === 'toggleVisibility' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : station.isActive === false ? (
                            <Eye size={10} />
                          ) : (
                            <EyeOff size={10} />
                          )}
                          {station.isActive === false ? t('admin.show') : t('admin.hide')}
                        </button>
                        <button
                          onClick={() => setStationFormState({ mode: 'edit', entity: station })}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-200 transition hover:bg-white/10"
                        >
                          <Pencil size={10} />
                          {t('admin.edit')}
                        </button>
                        <button
                          onClick={() => confirmAndDelete(() => handleDeleteStation(station.id))}
                          disabled={stationAction !== null}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-red-500/20 px-2 py-1 text-[10px] font-semibold text-red-200 transition hover:bg-red-500/30"
                        >
                          {stationAction?.id === station.id && stationAction?.type === 'delete' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 size={10} />
                          )}
                          {t('admin.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderPlacementsPanel = () => {
    if (placementsLoading && !placementsLoaded) {
      return renderLoadingState();
    }

    if (placementsError && !placementsLoaded) {
      return (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-10 text-center text-sm text-red-200">
          <p className="text-base font-semibold">{placementsError}</p>
        </div>
      );
    }

    const activeZones = placementZones.filter(zone => zone.status === 'active').length;
    const activeProducts = sponsorshipProducts.filter(product => product.status === 'active').length;
    const reservedOrders = sponsorshipOrders.filter(order => order.status === 'reserved').length;
    const activeOrders = sponsorshipOrders.filter(order => order.status === 'active').length;
    const liveCampaigns = promotionalCampaigns.filter(isPromotionalCampaignPubliclyResolvable).length;
    const unlinkedReservableOrders = sponsorshipOrders.filter(
      order =>
        !order.campaignId &&
        (order.status === 'reserved' || order.status === 'paid' || order.status === 'active'),
    );
    const inactiveLinkedOrders = sponsorshipOrders.filter(order => {
      const linkedCampaign = order.campaignId ? promotionalCampaigns.find(campaign => campaign.id === order.campaignId) : null;
      return (
        Boolean(linkedCampaign) &&
        (order.status === 'reserved' || order.status === 'paid' || order.status === 'active') &&
        !isPromotionalCampaignPubliclyResolvable(linkedCampaign)
      );
    });
    const analyticsByCampaignId = placementAnalytics.reduce<Record<string, PlacementCampaignAnalyticsSummary>>(
      (acc, entry) => {
        acc[entry.campaignId] = entry;
        return acc;
      },
      {},
    );
    const totalPlacementImpressions = placementAnalytics.reduce(
      (sum, entry) => sum + entry.impressions,
      0,
    );
    const totalPlacementClicks = placementAnalytics.reduce(
      (sum, entry) => sum + entry.clicks,
      0,
    );
    const totalPlacementCtr =
      totalPlacementImpressions > 0
        ? ((totalPlacementClicks / totalPlacementImpressions) * 100).toFixed(2)
        : '0.00';
    const selectedPlacementZone = placementAnalyticsFilters.zoneKey
      ? placementZones.find(zone => zone.key === placementAnalyticsFilters.zoneKey) ?? null
      : null;
    const zoneNameByKey = placementZones.reduce<Record<string, string>>((acc, zone) => {
      acc[zone.key] = zone.name;
      return acc;
    }, {});
    const zoneNameById = placementZones.reduce<Record<string, string>>((acc, zone) => {
      acc[zone.id] = zone.name;
      return acc;
    }, {});
    const dealerById = dealers.reduce<Record<string, Dealer>>((acc, dealer) => {
      acc[dealer.id] = dealer;
      return acc;
    }, {});
    const productById = sponsorshipProducts.reduce<Record<string, SponsorshipProduct>>((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {});
    const campaignById = promotionalCampaigns.reduce<Record<string, PromotionalCampaign>>(
      (acc, campaign) => {
        acc[campaign.id] = campaign;
        return acc;
      },
      {},
    );
    const linkedOrdersByCampaignId = sponsorshipOrders.reduce<Record<string, SponsorshipOrder[]>>(
      (acc, order) => {
        if (!order.campaignId) {
          return acc;
        }

        const current = acc[order.campaignId] ?? [];
        current.push(order);
        acc[order.campaignId] = current;
        return acc;
      },
      {},
    );
    const topPlacementZones = placementZoneAnalytics.slice(0, 5);
    const topPlacementCampaigns = placementAnalytics.slice(0, 5);
    const maxZoneImpressions = topPlacementZones.reduce(
      (max, entry) => Math.max(max, entry.impressions),
      0,
    );
    const maxCampaignImpressions = topPlacementCampaigns.reduce(
      (max, entry) => Math.max(max, entry.impressions),
      0,
    );
    const maxDailyImpressions = placementDailyAnalytics.reduce(
      (max, entry) => Math.max(max, entry.impressions),
      0,
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {t('admin.placementsControlCenter', { defaultValue: 'Placements control center' })}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin.placementsControlCenterDescription', {
                defaultValue:
                  'Configure dynamic placement zones, sponsorship products, and promotional campaigns under audited admin control.',
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRefreshPlacements()}
              disabled={placementsLoading || placementAnalyticsLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {placementsLoading || placementAnalyticsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw size={16} />}
              <span>{t('admin.refreshPlacements', { defaultValue: 'Refresh' })}</span>
            </button>
            {canOverridePlacements && (
              <button
                type="button"
                onClick={() => void handlePlacementBootstrap()}
                disabled={placementBootstrapLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {placementBootstrapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle size={16} />}
                <span>
                  {t('admin.bootstrapPlacements', { defaultValue: 'Bootstrap public inventory' })}
                </span>
              </button>
            )}
            {canManagePlacements && (
              <>
                <button
                  type="button"
                  onClick={() => setPlacementZoneFormState({ mode: 'create' })}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-cyan/90"
                >
                  <Plus size={16} />
                  <span>{t('admin.addPlacementZone', { defaultValue: 'Add zone' })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSponsorshipProductFormState({ mode: 'create' })}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                >
                  <Plus size={16} />
                  <span>{t('admin.addSponsorshipProduct', { defaultValue: 'Add product' })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSponsorshipOrderFormState({ mode: 'create' })}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
                >
                  <Plus size={16} />
                  <span>{t('admin.addSponsorshipOrder', { defaultValue: 'Add order' })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPromotionalCampaignFormState({ mode: 'create' })}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/20"
                >
                  <Plus size={16} />
                  <span>{t('admin.addPromotionalCampaign', { defaultValue: 'Add campaign' })}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {placementsError && placementsLoaded && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {placementsError}
          </div>
        )}

        {(unlinkedReservableOrders.length > 0 || inactiveLinkedOrders.length > 0) && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-50">
            <p className="font-semibold">
              {t('admin.placementsNotPublicWarningTitle', {
                defaultValue: 'Some paid or reserved promotions are not public yet.',
              })}
            </p>
            <p className="mt-1 leading-6 text-amber-50/85">
              {t('admin.placementsNotPublicWarningDescription', {
                defaultValue:
                  '{{unlinked}} order(s) have no linked campaign and {{inactive}} linked campaign(s) are draft, paused, expired, or scheduled for later. Public pages only render currently resolvable promotional campaigns.',
                unlinked: unlinkedReservableOrders.length,
                inactive: inactiveLinkedOrders.length,
              })}
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t('admin.placementZonesSummary', { defaultValue: 'Placement zones' })}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{placementZones.length}</p>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin.placementZonesActiveSummary', {
                defaultValue: '{{count}} active',
                count: activeZones,
              })}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t('admin.sponsorshipProductsSummary', { defaultValue: 'Sponsorship products' })}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{sponsorshipProducts.length}</p>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin.sponsorshipProductsActiveSummary', {
                defaultValue: '{{count}} active',
                count: activeProducts,
              })}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t('admin.promotionalCampaignsSummary', { defaultValue: 'Promotional campaigns' })}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{promotionalCampaigns.length}</p>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin.promotionalCampaignsLiveSummary', {
                defaultValue: '{{count}} active',
                count: liveCampaigns,
              })}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t('admin.sponsorshipOrdersSummary', { defaultValue: 'Sponsorship orders' })}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{sponsorshipOrders.length}</p>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin.sponsorshipOrdersActiveReservedSummary', {
                defaultValue: '{{active}} active / {{reserved}} reserved',
                active: activeOrders,
                reserved: reservedOrders,
              })}
            </p>
          </div>
        </div>

        {canReadPlacementAnalytics && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-100/80">
                {t('admin.placementImpressionsSummary', { defaultValue: 'Placement impressions' })}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{totalPlacementImpressions}</p>
            </div>
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-indigo-100/80">
                {t('admin.placementClicksSummary', { defaultValue: 'Placement clicks' })}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{totalPlacementClicks}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-100/80">
                {t('admin.placementCtrSummary', { defaultValue: 'Average CTR' })}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{totalPlacementCtr}%</p>
            </div>
          </div>
        )}

        {canReadPlacementAnalytics && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t('admin.placementAnalyticsFiltersTitle', { defaultValue: 'Performance filters' })}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {t('admin.placementAnalyticsFiltersDescription', {
                    defaultValue:
                      'Filters apply to placement totals, campaign rankings, and the daily trend. The zone leaderboard remains all-time.',
                  })}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="flex min-w-[160px] flex-col gap-2 text-sm text-gray-300">
                  <span>{t('admin.analyticsRangeLabel', { defaultValue: 'Time range' })}</span>
                  <select
                    value={placementAnalyticsFilters.days}
                    disabled={placementAnalyticsLoading}
                    onChange={event =>
                      handlePlacementAnalyticsFilterChange({
                        days: Number(event.target.value),
                      })
                    }
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  >
                    {PLACEMENT_ANALYTICS_RANGE_OPTIONS.map(days => (
                      <option key={days} value={days}>
                        {t('admin.analyticsRangeOption', {
                          defaultValue: 'Last {{days}} days',
                          days,
                        })}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex min-w-[220px] flex-col gap-2 text-sm text-gray-300">
                  <span>{t('admin.zoneDrilldownLabel', { defaultValue: 'Zone drill-down' })}</span>
                  <select
                    value={placementAnalyticsFilters.zoneKey ?? ''}
                    disabled={placementAnalyticsLoading}
                    onChange={event =>
                      handlePlacementAnalyticsFilterChange({
                        zoneKey: event.target.value || null,
                      })
                    }
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  >
                    <option value="">
                      {t('admin.allZonesLabel', { defaultValue: 'All zones' })}
                    </option>
                    {placementZones.map(zone => (
                      <option key={zone.id} value={zone.key}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handlePlacementAnalyticsExport}
                  disabled={placementAnalyticsExporting || placementAnalyticsLoading || placementAnalytics.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {placementAnalyticsExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download size={16} />}
                  <span>{t('admin.exportPlacementAnalytics', { defaultValue: 'Export CSV' })}</span>
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-400">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
                {t('admin.analyticsRangeOption', {
                  defaultValue: 'Last {{days}} days',
                  days: placementAnalyticsFilters.days,
                })}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
                {selectedPlacementZone?.name ??
                  t('admin.allZonesLabel', { defaultValue: 'All zones' })}
              </span>
            </div>
          </section>
        )}

        {canReadPlacementAnalytics && (
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {t('admin.topPlacementZones', { defaultValue: 'Top placement zones' })}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {t('admin.topPlacementZonesDescription', {
                    defaultValue:
                      'See which page slots are attracting the most sponsored visibility and engagement across all tracked time.',
                  })}
                </p>
              </div>

              {topPlacementZones.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {t('admin.noPlacementAnalyticsYet', {
                    defaultValue: 'No placement activity has been recorded yet.',
                  })}
                </p>
              ) : (
                <div className="space-y-3">
                  {topPlacementZones.map(zone => {
                    const width =
                      maxZoneImpressions > 0
                        ? Math.max((zone.impressions / maxZoneImpressions) * 100, 8)
                        : 0;

                    return (
                      <article
                        key={zone.zoneKey}
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {zoneNameByKey[zone.zoneKey] ?? zone.zoneKey}
                            </p>
                            <p className="text-xs text-gray-500">{zone.zoneKey}</p>
                          </div>
                          <div className="text-right text-xs text-gray-300">
                            <p>
                              {t('admin.impressionsLabel', { defaultValue: 'Impressions' })}: {zone.impressions}
                            </p>
                            <p>
                              {t('admin.clicksLabel', { defaultValue: 'Clicks' })}: {zone.clicks}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-cyan-400/80"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-400">
                          <span>CTR: {zone.ctr.toFixed(2)}%</span>
                          {zone.lastImpressionAt && (
                            <span>
                              {t('admin.lastImpressionLabel', { defaultValue: 'Last impression' })}:{' '}
                              {formatDateTime(zone.lastImpressionAt)}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {selectedPlacementZone
                    ? t('admin.zonePlacementPerformance', {
                        defaultValue: 'Zone campaign performance',
                      })
                    : t('admin.topPerformingPlacements', { defaultValue: 'Top-performing placements' })}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {selectedPlacementZone
                    ? t('admin.zonePlacementPerformanceDescription', {
                        defaultValue:
                          'Review which campaigns are performing inside the selected placement zone for the chosen range.',
                      })
                    : t('admin.topPerformingPlacementsDescription', {
                        defaultValue:
                          'Rank live and historical campaigns by delivery so you can quickly identify what is working.',
                      })}
                </p>
              </div>

              {topPlacementCampaigns.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {t('admin.noPlacementAnalyticsYet', {
                    defaultValue: 'No placement activity has been recorded yet.',
                  })}
                </p>
              ) : (
                <div className="space-y-3">
                  {topPlacementCampaigns.map(entry => {
                    const width =
                      maxCampaignImpressions > 0
                        ? Math.max((entry.impressions / maxCampaignImpressions) * 100, 8)
                        : 0;
                    const campaign = campaignById[entry.campaignId];

                    return (
                      <article
                        key={entry.campaignId}
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {campaign?.name ?? entry.campaignId}
                            </p>
                            <p className="text-xs text-gray-500">
                              {campaign?.promotionType ?? t('admin.unknownLabel', { defaultValue: 'Unknown' })}
                            </p>
                          </div>
                          <div className="text-right text-xs text-gray-300">
                            <p>
                              {t('admin.impressionsLabel', { defaultValue: 'Impressions' })}: {entry.impressions}
                            </p>
                            <p>
                              {t('admin.clicksLabel', { defaultValue: 'Clicks' })}: {entry.clicks}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-indigo-400/80"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-400">
                          <span>CTR: {entry.ctr.toFixed(2)}%</span>
                          {entry.lastClickAt && (
                            <span>
                              {t('admin.lastClickLabel', { defaultValue: 'Last click' })}:{' '}
                              {formatDateTime(entry.lastClickAt)}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {placementAnalyticsError && canReadPlacementAnalytics && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {placementAnalyticsError}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">
              {t('admin.placementInventoryOverview', { defaultValue: 'Placement inventory overview' })}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin.placementInventoryOverviewDescription', {
                defaultValue:
                  'See current slot availability by zone based on reserving sponsorship orders and any live campaigns occupying inventory directly.',
              })}
            </p>
          </div>

          {placementAvailability.length === 0 ? (
            renderEmptyState(
              t('admin.noPlacementAvailability', {
                defaultValue: 'Availability will appear once placement zones and sponsorship orders exist.',
              }),
            )
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {placementAvailability.map(entry => (
                <article
                  key={entry.zoneId}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{entry.zoneName}</p>
                      <p className="text-xs text-gray-500">{entry.zoneKey}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        entry.availableAssignments > 0
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                          : 'border border-red-500/30 bg-red-500/10 text-red-100'
                      }`}
                    >
                      {entry.availableAssignments > 0
                        ? t('admin.inventoryAvailableLabel', { defaultValue: 'Available' })
                        : t('admin.inventorySoldOutLabel', { defaultValue: 'Sold out' })}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">
                        {t('admin.zoneCapacityLabel', { defaultValue: 'Capacity' })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">{entry.maxAssignments}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">
                        {t('admin.zoneReservedLabel', { defaultValue: 'Reserved now' })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">{entry.reservedAssignments}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">
                        {t('admin.zoneAvailableLabel', { defaultValue: 'Available now' })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">{entry.availableAssignments}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-400">
                    {entry.nextReleaseAt && (
                      <span>
                        {t('admin.nextReleaseLabel', { defaultValue: 'Next release' })}:{' '}
                        {formatDateTime(entry.nextReleaseAt)}
                      </span>
                    )}
                    {entry.blockingOrderIds.length > 0 && (
                      <span>
                        {t('admin.blockingOrdersLabel', { defaultValue: 'Blocking orders' })}:{' '}
                        {entry.blockingOrderIds.length}
                      </span>
                    )}
                    {entry.blockingCampaignIds.length > 0 && (
                      <span>
                        {t('admin.blockingCampaignsLabel', { defaultValue: 'Blocking campaigns' })}:{' '}
                        {entry.blockingCampaignIds.length}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">
              {t('admin.sponsorshipOrdersDirectory', { defaultValue: 'Sponsorship orders' })}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin.sponsorshipOrdersDirectoryDescription', {
                defaultValue:
                  'Commercial deals, reservations, and paid inventory records that govern who occupies premium placement slots.',
              })}
            </p>
          </div>

          {sponsorshipOrders.length === 0 ? (
            renderEmptyState(
              t('admin.noSponsorshipOrders', {
                defaultValue: 'No sponsorship orders have been created yet.',
              }),
            )
          ) : (
            <div className="space-y-3">
              {sponsorshipOrders.map(order => {
                const dealer = dealerById[order.dealerId];
                const product = productById[order.sponsorshipProductId];
                const linkedCampaign = order.campaignId ? campaignById[order.campaignId] : null;
                const linkedCampaignIsPublic = isPromotionalCampaignPubliclyResolvable(linkedCampaign);
                const orderCanCreatePublicCampaign =
                  canManagePlacements &&
                  !linkedCampaign &&
                  (order.status === 'reserved' || order.status === 'paid' || order.status === 'active');

                return (
                  <article
                    key={order.id}
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{order.name}</p>
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                            {order.status}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                            {order.paymentStatus}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-400">
                          <span>
                            {t('admin.dealerLabel', { defaultValue: 'Dealer' })}: {dealer?.name ?? order.dealerId}
                          </span>
                          <span>
                            {t('admin.sponsorshipProduct', { defaultValue: 'Sponsorship product' })}:{' '}
                            {product?.name ?? order.sponsorshipProductId}
                          </span>
                          {order.dealerPlanId && (
                            <span>
                              {t('admin.planLabel', { defaultValue: 'Plan' })}: {order.dealerPlanId.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-400">
                          {order.startAt && (
                            <span>
                              {t('admin.startsLabel', { defaultValue: 'Starts' })}:{' '}
                              {formatDateTime(typeof order.startAt === 'string' ? order.startAt : null)}
                            </span>
                          )}
                          {order.endAt && (
                            <span>
                              {t('admin.endsLabel', { defaultValue: 'Ends' })}:{' '}
                              {formatDateTime(typeof order.endAt === 'string' ? order.endAt : null)}
                            </span>
                          )}
                          {order.paidAt && (
                            <span>
                              {t('admin.paidAtLabel', { defaultValue: 'Paid at' })}:{' '}
                              {formatDateTime(typeof order.paidAt === 'string' ? order.paidAt : null)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-400">
                          {(order.priceAmount != null || order.priceLabel) && (
                            <span>
                              {t('admin.priceLabel', { defaultValue: 'Price label' })}:{' '}
                              {order.priceAmount != null
                                ? `${order.currency ?? 'EUR'} ${order.priceAmount}`
                                : order.priceLabel}
                            </span>
                          )}
                          {order.invoiceReference && (
                            <span>
                              {t('admin.invoiceReferenceLabel', { defaultValue: 'Invoice / reference' })}:{' '}
                              {order.invoiceReference}
                            </span>
                          )}
                          {linkedCampaign && (
                            <span>
                              {t('admin.linkedCampaignLabel', { defaultValue: 'Linked campaign' })}:{' '}
                              {linkedCampaign.name} ({linkedCampaign.status})
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          {linkedCampaignIsPublic ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-100">
                              {t('admin.publicPlacementLiveLabel', { defaultValue: 'Public placement live' })}
                            </span>
                          ) : linkedCampaign ? (
                            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-100">
                              {t('admin.publicPlacementNotLiveLabel', {
                                defaultValue: 'Linked campaign is not public now',
                              })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-100">
                              {t('admin.publicPlacementMissingCampaignLabel', {
                                defaultValue: 'Not public yet: no linked campaign',
                              })}
                            </span>
                          )}
                        </div>
                        {order.internalNotes && (
                          <p className="text-sm text-gray-300">{order.internalNotes}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {order.zoneIds.map(zoneId => (
                            <span
                              key={`${order.id}-${zoneId}`}
                              className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-gray-300"
                            >
                              {zoneNameById[zoneId] ?? zoneId}
                            </span>
                          ))}
                        </div>
                      </div>

                      {canManagePlacements && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSponsorshipOrderFormState({ mode: 'edit', entity: order })}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
                          >
                            <Pencil size={14} />
                            <span>{t('admin.edit')}</span>
                          </button>
                          {orderCanCreatePublicCampaign && (
                            <button
                              type="button"
                              onClick={() => void handleCreateLinkedCampaignFromOrder(order)}
                              disabled={placementSaving}
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Megaphone className="h-3.5 w-3.5" />
                              <span>
                                {t('admin.createLinkedCampaignLabel', {
                                  defaultValue: 'Create public campaign',
                                })}
                              </span>
                            </button>
                          )}
                          {order.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleSponsorshipOrderStatusUpdate(order, 'quoted', {
                                  paymentStatus:
                                    order.paymentStatus === 'unpaid' ? 'pending' : order.paymentStatus,
                                })
                              }
                              disabled={placementSaving}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              <span>{t('admin.quoteOrderLabel', { defaultValue: 'Quote' })}</span>
                            </button>
                          )}
                          {order.paymentStatus !== 'paid' &&
                            order.status !== 'cancelled' &&
                            order.status !== 'expired' &&
                            order.status !== 'active' && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleSponsorshipOrderStatusUpdate(order, 'paid', {
                                    paymentStatus: 'paid',
                                    paidAt: new Date().toISOString(),
                                  })
                                }
                                disabled={placementSaving}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                <span>{t('admin.markPaidLabel', { defaultValue: 'Mark paid' })}</span>
                              </button>
                            )}
                          {order.status !== 'reserved' && order.status !== 'active' && order.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => void handleSponsorshipOrderStatusUpdate(order, 'reserved')}
                              disabled={placementSaving}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <CheckCircle size={14} />
                              <span>{t('admin.reserveLabel', { defaultValue: 'Reserve' })}</span>
                            </button>
                          )}
                          {order.status !== 'active' && order.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => void handleSponsorshipOrderStatusUpdate(order, 'active')}
                              disabled={placementSaving}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Power size={14} />
                              <span>{t('admin.activate', { defaultValue: 'Activate' })}</span>
                            </button>
                          )}
                          {order.status !== 'cancelled' && order.status !== 'expired' && (
                            <button
                              type="button"
                              onClick={() => void handleSponsorshipOrderStatusUpdate(order, 'cancelled')}
                              disabled={placementSaving}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <XCircle size={14} />
                              <span>{t('admin.cancelOrderLabel', { defaultValue: 'Cancel order' })}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {canReadPlacementAnalytics && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">
                {t('admin.placementDailyTrend', {
                  defaultValue: 'Last {{days}} days',
                  days: placementAnalyticsFilters.days,
                })}
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                {selectedPlacementZone
                  ? t('admin.placementDailyTrendZoneDescription', {
                      defaultValue:
                        'Review daily sponsored-delivery volume for the selected placement zone and range.',
                    })
                  : t('admin.placementDailyTrendDescription', {
                      defaultValue:
                        'Review daily sponsored-delivery volume to spot momentum, gaps, or campaign fatigue.',
                    })}
              </p>
            </div>

            {placementDailyAnalytics.length === 0 ? (
              <p className="text-sm text-gray-400">
                {t('admin.noPlacementAnalyticsYet', {
                  defaultValue: 'No placement activity has been recorded yet.',
                })}
              </p>
            ) : (
              <div className="space-y-3">
                {placementDailyAnalytics.map(entry => {
                  const width =
                    maxDailyImpressions > 0
                      ? Math.max((entry.impressions / maxDailyImpressions) * 100, 4)
                      : 0;
                  const parsedDate = new Date(`${entry.dateKey}T00:00:00`);
                  const dateLabel = Number.isNaN(parsedDate.getTime())
                    ? entry.dateKey
                    : parsedDate.toLocaleDateString();

                  return (
                    <article
                      key={entry.dateKey}
                      className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{dateLabel}</p>
                        <div className="flex flex-wrap gap-3 text-[11px] text-gray-300">
                          <span>
                            {t('admin.impressionsLabel', { defaultValue: 'Impressions' })}: {entry.impressions}
                          </span>
                          <span>
                            {t('admin.clicksLabel', { defaultValue: 'Clicks' })}: {entry.clicks}
                          </span>
                          <span>CTR: {entry.ctr.toFixed(2)}%</span>
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-400/80"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {t('admin.placementZonesDirectory', { defaultValue: 'Placement zones' })}
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                {t('admin.placementZonesDirectoryDescription', {
                  defaultValue:
                    'Named page slots that control where promotions can appear and what types of content can occupy them.',
                })}
              </p>
            </div>
          </div>

          {placementZones.length === 0 ? (
            renderEmptyState(
              t('admin.noPlacementZones', {
                defaultValue: 'No placement zones have been created yet.',
              }),
            )
          ) : (
            <div className="space-y-3">
              {placementZones.map(zone => (
                <article
                  key={zone.id}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{zone.name}</p>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                          {zone.status ?? 'inactive'}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-100">
                          {zone.key}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {zone.pageKey} / {zone.slotKey}
                      </p>
                      {zone.description && <p className="text-sm text-gray-300">{zone.description}</p>}
                      <div className="flex flex-wrap gap-2 text-[11px] text-gray-400">
                        <span>
                          {t('admin.maxAssignments', { defaultValue: 'Max assignments' })}: {zone.maxAssignments}
                        </span>
                        <span>
                          {zone.allowHousePromotions
                            ? t('admin.housePromotionsEnabled', { defaultValue: 'House enabled' })
                            : t('admin.housePromotionsDisabled', { defaultValue: 'House disabled' })}
                        </span>
                        <span>
                          {zone.allowSponsoredPromotions
                            ? t('admin.sponsoredPromotionsEnabled', { defaultValue: 'Sponsored enabled' })
                            : t('admin.sponsoredPromotionsDisabled', { defaultValue: 'Sponsored disabled' })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {zone.allowedEntityTypes.map(entityType => (
                          <span
                            key={`${zone.id}-${entityType}`}
                            className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-gray-300"
                          >
                            {formatPlacementEntityTypeLabel(entityType)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {canManagePlacements && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPlacementZoneFormState({ mode: 'edit', entity: zone })}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
                        >
                          <Pencil size={14} />
                          <span>{t('admin.edit')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handlePlacementZoneStatusUpdate(
                              zone,
                              zone.status === 'active' ? 'inactive' : 'active',
                            )
                          }
                          disabled={placementSaving}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {zone.status === 'active' ? <EyeOff size={14} /> : <Eye size={14} />}
                          <span>
                            {zone.status === 'active'
                              ? t('admin.deactivate', { defaultValue: 'Deactivate' })
                              : t('admin.activate', { defaultValue: 'Activate' })}
                          </span>
                        </button>
                        {zone.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => void handlePlacementZoneStatusUpdate(zone, 'archived')}
                            disabled={placementSaving}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            <span>{t('admin.archive', { defaultValue: 'Archive' })}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">
              {t('admin.sponsorshipProductsDirectory', { defaultValue: 'Sponsorship products' })}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin.sponsorshipProductsDirectoryDescription', {
                defaultValue:
                  'Commercial inventory definitions that determine which plans and content types can buy visibility.',
              })}
            </p>
          </div>

          {sponsorshipProducts.length === 0 ? (
            renderEmptyState(
              t('admin.noSponsorshipProducts', {
                defaultValue: 'No sponsorship products have been created yet.',
              }),
            )
          ) : (
            <div className="space-y-3">
              {sponsorshipProducts.map(product => (
                <article
                  key={product.id}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{product.name}</p>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                          {product.status ?? 'inactive'}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                          {product.code}
                        </span>
                      </div>
                      {product.description && <p className="text-sm text-gray-300">{product.description}</p>}
                      <div className="flex flex-wrap gap-2 text-[11px] text-gray-400">
                        <span>
                          {t('admin.defaultDurationDays', { defaultValue: 'Default duration (days)' })}:{' '}
                          {product.defaultDurationDays ?? '-'}
                        </span>
                        {product.priceLabel && <span>{product.priceLabel}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {product.eligiblePlanIds.map(planId => (
                          <span
                            key={`${product.id}-${planId}`}
                            className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-100"
                          >
                            {planId.toUpperCase()}
                          </span>
                        ))}
                        {product.eligibleEntityTypes.map(entityType => (
                          <span
                            key={`${product.id}-${entityType}`}
                            className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-gray-300"
                          >
                            {formatPlacementEntityTypeLabel(entityType)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {canManagePlacements && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSponsorshipProductFormState({ mode: 'edit', entity: product })}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
                        >
                          <Pencil size={14} />
                          <span>{t('admin.edit')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleSponsorshipProductStatusUpdate(
                              product,
                              product.status === 'active' ? 'inactive' : 'active',
                            )
                          }
                          disabled={placementSaving}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {product.status === 'active' ? <EyeOff size={14} /> : <Eye size={14} />}
                          <span>
                            {product.status === 'active'
                              ? t('admin.deactivate', { defaultValue: 'Deactivate' })
                              : t('admin.activate', { defaultValue: 'Activate' })}
                          </span>
                        </button>
                        {product.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => void handleSponsorshipProductStatusUpdate(product, 'archived')}
                            disabled={placementSaving}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            <span>{t('admin.archive', { defaultValue: 'Archive' })}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">
              {t('admin.promotionalCampaignsDirectory', { defaultValue: 'Promotional campaigns' })}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin.promotionalCampaignsDirectoryDescription', {
                defaultValue:
                  'Scheduled or live promotion units that connect sponsored or house content to one or more placement zones.',
              })}
            </p>
          </div>

          {promotionalCampaigns.length === 0 ? (
            renderEmptyState(
              t('admin.noPromotionalCampaigns', {
                defaultValue: 'No promotional campaigns have been created yet.',
              }),
            )
          ) : (
            <div className="space-y-3">
              {promotionalCampaigns.map(campaign => {
                const linkedOrders = linkedOrdersByCampaignId[campaign.id] ?? [];
                const reservingLinkedOrders = linkedOrders.filter(
                  order =>
                    order.status === 'reserved' ||
                    order.status === 'paid' ||
                    order.status === 'active',
                );
                const requiresOrderCoverage =
                  campaign.promotionType === 'sponsored_promotion' &&
                  (campaign.status === 'scheduled' ||
                    campaign.status === 'active' ||
                    campaign.status === 'paused');
                const linkedProduct = campaign.sponsorshipProductId
                  ? productById[campaign.sponsorshipProductId]
                  : null;

                return (
                  <article
                    key={campaign.id}
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                      {canReadPlacementAnalytics && (
                        <div className="mb-1 flex flex-wrap gap-2 text-[11px] text-gray-300">
                          <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-medium text-cyan-100">
                            {t('admin.impressionsLabel', { defaultValue: 'Impressions' })}: {analyticsByCampaignId[campaign.id]?.impressions ?? 0}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-100">
                            {t('admin.clicksLabel', { defaultValue: 'Clicks' })}: {analyticsByCampaignId[campaign.id]?.clicks ?? 0}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-100">
                            CTR: {(analyticsByCampaignId[campaign.id]?.ctr ?? 0).toFixed(2)}%
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{campaign.name}</p>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                          {campaign.status}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-100">
                          {campaign.promotionType}
                        </span>
                        {requiresOrderCoverage && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              reservingLinkedOrders.length > 0
                                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                                : 'border border-amber-500/30 bg-amber-500/10 text-amber-100'
                            }`}
                          >
                            {reservingLinkedOrders.length > 0
                              ? t('admin.orderBackedLabel', { defaultValue: 'Order-backed' })
                              : t('admin.needsOrderCoverageLabel', {
                                  defaultValue: 'Needs reserving order',
                                })}
                          </span>
                        )}
                      </div>
                      {campaign.description && <p className="text-sm text-gray-300">{campaign.description}</p>}
                      <div className="flex flex-wrap gap-2 text-[11px] text-gray-400">
                        <span>
                          {t('admin.zoneAssignmentsCount', {
                            defaultValue: '{{count}} zones',
                            count: campaign.zoneIds.length,
                          })}
                        </span>
                        {canReadPlacementAnalytics && analyticsByCampaignId[campaign.id]?.lastImpressionAt && (
                          <span>
                            {t('admin.lastImpressionLabel', { defaultValue: 'Last impression' })}:{' '}
                            {formatDateTime(analyticsByCampaignId[campaign.id]?.lastImpressionAt ?? null)}
                          </span>
                        )}
                        {canReadPlacementAnalytics && analyticsByCampaignId[campaign.id]?.lastClickAt && (
                          <span>
                            {t('admin.lastClickLabel', { defaultValue: 'Last click' })}:{' '}
                            {formatDateTime(analyticsByCampaignId[campaign.id]?.lastClickAt ?? null)}
                          </span>
                        )}
                        {campaign.sponsoredEntityType && (
                          <span>
                            {formatPlacementEntityTypeLabel(campaign.sponsoredEntityType)} /{' '}
                            {campaign.sponsoredEntityId ?? '-'}
                          </span>
                        )}
                        {linkedProduct && (
                          <span>
                            {t('admin.sponsorshipProduct', { defaultValue: 'Sponsorship product' })}:{' '}
                            {linkedProduct.name}
                          </span>
                        )}
                        {campaign.startAt && (
                          <span>
                            {t('admin.startsLabel', { defaultValue: 'Starts' })}:{' '}
                            {formatDateTime(typeof campaign.startAt === 'string' ? campaign.startAt : null)}
                          </span>
                        )}
                        {campaign.endAt && (
                          <span>
                            {t('admin.endsLabel', { defaultValue: 'Ends' })}:{' '}
                            {formatDateTime(typeof campaign.endAt === 'string' ? campaign.endAt : null)}
                          </span>
                        )}
                      </div>
                      {linkedOrders.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {linkedOrders.map(order => (
                            <span
                              key={`${campaign.id}-${order.id}`}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                order.status === 'reserved' ||
                                order.status === 'paid' ||
                                order.status === 'active'
                                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                                  : 'border border-white/10 bg-black/30 text-gray-300'
                              }`}
                            >
                              {order.name} ({order.status})
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {campaign.zoneIds.map(zoneId => {
                          const zone = placementZones.find(entry => entry.id === zoneId);
                          return (
                            <span
                              key={`${campaign.id}-${zoneId}`}
                              className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-gray-300"
                            >
                              {zone?.name ?? zoneId}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {canManagePlacements && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPromotionalCampaignFormState({ mode: 'edit', entity: campaign })}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
                        >
                          <Pencil size={14} />
                          <span>{t('admin.edit')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handlePromotionalCampaignStatusUpdate(
                              campaign,
                              campaign.status === 'active' ? 'paused' : 'active',
                            )
                          }
                          disabled={placementSaving}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {campaign.status === 'active' ? <Power size={14} /> : <CheckCircle size={14} />}
                          <span>
                            {campaign.status === 'active'
                              ? t('admin.pause', { defaultValue: 'Pause' })
                              : t('admin.publish', { defaultValue: 'Publish' })}
                          </span>
                        </button>
                        {campaign.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => void handlePromotionalCampaignStatusUpdate(campaign, 'archived')}
                            disabled={placementSaving}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            <span>{t('admin.archive', { defaultValue: 'Archive' })}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  };

  if (!user) {
    return null;
  }

  return (
    <>
    <div className="flex h-screen w-full overflow-hidden">
      <SEO
        title={t('admin.dashboardMetaTitle')}
        description={t('admin.dashboardMetaDescription')}
        keywords={t('admin.dashboardMetaKeywords', { returnObjects: true }) as string[]}
        canonical={`${BASE_URL}/admin/`}
        robots="noindex, nofollow"
        openGraph={{
          title: t('admin.dashboardMetaTitle'),
          description: t('admin.dashboardMetaDescription'),
          url: `${BASE_URL}/admin/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: t('admin.dashboardMetaTitle'),
          description: t('admin.dashboardMetaDescription'),
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />
      
      <button
        type="button"
        onClick={() => setAdminSidebarOpen(open => !open)}
        className="fixed left-3 top-3 z-[80] hidden h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#000080]/90 text-white shadow-xl backdrop-blur transition hover:border-gray-cyan/50 hover:bg-gray-cyan/20 md:inline-flex"
        aria-label={adminSidebarOpen ? 'Close admin control panel' : 'Open admin control panel'}
        aria-expanded={adminSidebarOpen}
      >
        {adminSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
      </button>

      {/* Sidebar Layout */}
      <aside
        className={`hidden h-screen shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#080827]/95 backdrop-blur-xl transition-[width] duration-300 md:flex ${
          adminSidebarOpen ? 'w-72' : 'w-0 border-r-0'
        }`}
      >
        <div className="border-b border-white/10 p-6 pl-16">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-gray-cyan" />
            <h1 className="text-xl font-bold text-white">{t('admin.dashboard')}</h1>
          </div>
          <p className="mt-2 text-xs text-gray-400 break-all">{user.email}</p>
        </div>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {tabGroups.map(group => (
            <section key={group.label}>
              <p className="mb-2 px-2 text-[11px] font-bold uppercase text-gray-500">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.tabs.map(tab => (
                  <div key={tab.id} className="flex items-center gap-2">
                    <button
                      onClick={() => navigateToAdminTab(tab.id)}
                      className={`flex min-w-0 flex-1 items-center rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-gray-cyan text-white shadow-lg'
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="min-w-0 truncate">{tab.label}</span>
                    </button>
                    <DashboardInfoTooltip label={tab.description} side="left" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="max-h-[45vh] space-y-3 overflow-y-auto border-t border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOfflineQueueOpen(true)}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
            >
              <div className="flex min-w-0 items-center gap-2">
                <ClipboardList size={18} className="shrink-0" />
                <span className="truncate">{t('admin.offlineQueueButton', { defaultValue: 'Offline queue' })}</span>
              </div>
              {offlineQueueCount > 0 && (
                <span className="rounded-full bg-gray-cyan px-2 py-0.5 text-xs font-semibold text-white">
                  {offlineQueueCount}
                </span>
              )}
            </button>
            <DashboardInfoTooltip
              label={t('admin.tooltips.offlineQueueButton', {
                defaultValue: 'Review admin actions saved while offline or during failed network requests, then retry or clear them safely.',
              })}
              side="left"
            />
          </div>

          {canReadAdminNotifications && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAdminNotificationsOpen(true)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-gray-cyan/20 bg-gray-cyan/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-gray-cyan/20 hover:text-white"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Bell size={18} className="shrink-0" />
                  <span className="truncate">{t('admin.notificationsButton', { defaultValue: 'Admin notifications' })}</span>
                </div>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
                  {adminNotificationCount}
                </span>
              </button>
              <DashboardInfoTooltip
                label={t('admin.tooltips.notificationsButton', {
                  defaultValue: 'Open actionable admin notifications for dealer requests, approvals, pending reviews, and operational issues.',
                })}
                side="left"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/guide')}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
            >
              <div className="flex min-w-0 items-center gap-2">
                <BookOpen size={18} className="shrink-0 text-gray-cyan" />
                <span className="truncate">{t('admin.privateAdminGuide', { defaultValue: 'Admin how-to guide' })}</span>
              </div>
              <ExternalLink size={14} className="shrink-0 text-gray-400" />
            </button>
            <DashboardInfoTooltip
              label={t('admin.tooltips.privateAdminGuideButton', {
                defaultValue: 'Open the private admin manual with step-by-step explanations for every control-center workflow.',
              })}
              side="left"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/dealer-guide')}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
            >
              <div className="flex min-w-0 items-center gap-2">
                <BookOpen size={18} className="shrink-0 text-gray-cyan" />
                <span className="truncate">{t('admin.privateDealerGuide', { defaultValue: 'Dealer how-to guide' })}</span>
              </div>
              <ExternalLink size={14} className="shrink-0 text-gray-400" />
            </button>
            <DashboardInfoTooltip
              label={t('admin.tooltips.privateDealerGuideButton', {
                defaultValue: 'Open the dealer-facing guide as an admin so you can support dealership staff and verify instructions.',
              })}
              side="left"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/design-system')}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-gray-cyan/20 bg-gray-cyan/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-gray-cyan/20 hover:text-white"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Palette size={18} className="shrink-0 text-gray-cyan" />
                <span className="truncate">Design system</span>
              </div>
              <ExternalLink size={14} className="shrink-0 text-gray-400" />
            </button>
            <DashboardInfoTooltip
              label="Open the visual design-system reference for colors, components, states, and admin/public usage rules."
              side="left"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Home size={18} className="shrink-0 text-gray-cyan" />
                <span className="truncate">{t('admin.goToHomepage', { defaultValue: 'Platform Homepage' })}</span>
              </div>
              <ExternalLink size={14} className="shrink-0 text-gray-400" />
            </button>
            <DashboardInfoTooltip
              label={t('admin.tooltips.goToHomepageButton', {
                defaultValue: 'Open the public site to verify how approved admin, dealer, listing, model, and placement changes appear.',
              })}
              side="left"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex min-w-0 flex-1 items-center justify-center space-x-2 rounded-lg bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/30 hover:text-red-300"
            >
              <LogOut size={18} />
              <span>{t('admin.logout')}</span>
            </button>
            <DashboardInfoTooltip
              label={t('admin.tooltips.logoutButton', {
                defaultValue: 'End this admin session. Use this before leaving a shared or unattended device.',
              })}
              side="left"
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex flex-col gap-4 border-b border-white/10 bg-white/5 backdrop-blur-xl p-4 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-gray-cyan" />
              <h1 className="text-lg font-bold text-white">{t('admin.dashboard')}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/admin/guide')}
                className="p-2 text-gray-300 hover:text-white transition rounded-lg hover:bg-white/10"
                aria-label={t('admin.privateAdminGuide', { defaultValue: 'Admin how-to guide' })}
              >
                <BookOpen size={20} />
              </button>
              {canReadAdminNotifications && (
                <button
                  onClick={() => setAdminNotificationsOpen(true)}
                  className="relative p-2 text-gray-300 hover:text-white transition rounded-lg hover:bg-white/10"
                  aria-label={t('admin.notificationsButton', { defaultValue: 'Admin notifications' })}
                >
                  <Bell size={20} />
                  {adminNotificationCount > 0 && (
                    <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-cyan px-1 text-[10px] font-bold text-white">
                      {adminNotificationCount}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setOfflineQueueOpen(true)}
                className="relative p-2 text-gray-300 hover:text-white transition rounded-lg hover:bg-white/10"
              >
                <ClipboardList size={20} />
                {offlineQueueCount > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-gray-cyan text-[10px] font-bold text-white">
                    {offlineQueueCount}
                  </span>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-red-400 hover:text-red-300 transition rounded-lg hover:bg-red-500/20"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
            {tabs.map(tab => (
              <span key={tab.id} className="inline-flex flex-none items-center gap-2">
                <button
                  onClick={() => navigateToAdminTab(tab.id)}
                  className={`inline-flex whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-gray-cyan text-white shadow-md'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
                <DashboardInfoTooltip label={tab.description} side="left" />
              </span>
            ))}
          </div>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {activeTab === 'overview' && renderOverviewPanel()}
          {activeTab === 'dealers' && renderDealersPanel()}
          {activeTab === 'users' && renderUsersPanel()}
          {activeTab === 'models' && renderModelsPanel()}
          {activeTab === 'listings' && renderListingsPanel()}
          {activeTab === 'blog' && renderBlogPanel()}
          {activeTab === 'settings' && renderSiteSettingsPanel()}
          {activeTab === 'engagement' && <VisitorEngagementTab />}
          {activeTab === 'stations' && renderStationsPanel()}
          {activeTab === 'placements' && renderPlacementsPanel()}
          {activeTab === 'reports' && renderReportsPanel()}
          {activeTab === 'access' && renderAccessPanel()}
          {activeTab === 'audit' && renderAuditPanel()}
          {activeTab === 'migration' && (
            <div className="mt-6">
              <Suspense
                fallback={
                  <AdminLazyFallback
                    label={t('admin.loadingMigrationTools', { defaultValue: 'Loading migration tools...' })}
                  />
                }
              >
                <MigrationTool />
              </Suspense>
            </div>
          )}
        </div>
      </main>
    </div>

      {renderAdminNotificationsPanel()}

      {dealerFormState && (
        <AdminModal
          title={dealerFormState.mode === 'edit' ? t('admin.editDealer') : t('admin.addNewDealer')}
          onClose={closeAllModals}
        >
          <DealerForm
            initialValues={dealerFormState.entity}
            onSubmit={handleDealerSubmit}
            onCreateModel={handleCreateDealerModel}
            onCancel={closeAllModals}
            isSubmitting={dealerSubmitting}
            canManageModels={isAdmin}
          />
        </AdminModal>
      )}

      {modelFormState && (
        <AdminModal
          title={modelFormState.mode === 'edit' ? t('admin.editModel') : t('admin.addNewModel')}
          onClose={closeAllModals}
        >
          <Suspense
            fallback={
              <AdminLazyFallback
                label={t('admin.loadingModelForm', { defaultValue: 'Loading model form...' })}
              />
            }
          >
            <ModelForm
              initialValues={modelFormState.entity}
              onSubmit={handleModelSubmit}
              onCancel={closeAllModals}
              isSubmitting={modelSubmitting}
              isAdmin={isAdmin}
            />
          </Suspense>
        </AdminModal>
      )}

      {blogFormState && (
        <AdminModal
          title={
            blogFormState.mode === 'edit' ? t('admin.editBlogPost') : t('admin.addBlogPost')
          }
          onClose={closeAllModals}
        >
          <BlogPostForm
            initialValues={blogFormState.entity}
            onSubmit={handleBlogSubmit}
            onCancel={closeAllModals}
            isSubmitting={blogSubmitting}
          />
        </AdminModal>
      )}

      {stationFormState && (
        <AdminModal
          title={stationFormState.mode === 'edit' ? 'Edit Charging Station' : 'Add New Charging Station'}
          onClose={closeAllModals}
        >
          <ChargingStationForm
            initialValues={stationFormState.entity}
            onSubmit={handleStationSubmit}
            onCancel={closeAllModals}
            isSubmitting={stationSubmitting}
          />
        </AdminModal>
      )}

      {placementZoneFormState && (
        <AdminModal
          title={
            placementZoneFormState.mode === 'edit'
              ? t('admin.editPlacementZone', { defaultValue: 'Edit placement zone' })
              : t('admin.addPlacementZone', { defaultValue: 'Add placement zone' })
          }
          onClose={closeAllModals}
        >
          <PlacementZoneForm
            initialValues={placementZoneFormState.entity}
            onSubmit={handlePlacementZoneSubmit}
            onCancel={closeAllModals}
            isSubmitting={placementSaving}
          />
        </AdminModal>
      )}

      {sponsorshipProductFormState && (
        <AdminModal
          title={
            sponsorshipProductFormState.mode === 'edit'
              ? t('admin.editSponsorshipProduct', { defaultValue: 'Edit sponsorship product' })
              : t('admin.addSponsorshipProduct', { defaultValue: 'Add sponsorship product' })
          }
          onClose={closeAllModals}
        >
          <SponsorshipProductForm
            initialValues={sponsorshipProductFormState.entity}
            onSubmit={handleSponsorshipProductSubmit}
            onCancel={closeAllModals}
            isSubmitting={placementSaving}
          />
        </AdminModal>
      )}

      {sponsorshipOrderFormState && (
        <AdminModal
          title={
            sponsorshipOrderFormState.mode === 'edit'
              ? t('admin.editSponsorshipOrder', { defaultValue: 'Edit sponsorship order' })
              : t('admin.addSponsorshipOrder', { defaultValue: 'Add sponsorship order' })
          }
          onClose={closeAllModals}
        >
          <SponsorshipOrderForm
            initialValues={sponsorshipOrderFormState.entity}
            dealers={dealers}
            zones={placementZones}
            products={sponsorshipProducts}
            campaigns={promotionalCampaigns}
            onSubmit={handleSponsorshipOrderSubmit}
            onCancel={closeAllModals}
            isSubmitting={placementSaving}
          />
        </AdminModal>
      )}

      {promotionalCampaignFormState && (
        <AdminModal
          title={
            promotionalCampaignFormState.mode === 'edit'
              ? t('admin.editPromotionalCampaign', { defaultValue: 'Edit promotional campaign' })
              : t('admin.addPromotionalCampaign', { defaultValue: 'Add promotional campaign' })
          }
          onClose={closeAllModals}
        >
          <PromotionalCampaignForm
            initialValues={promotionalCampaignFormState.entity}
            zones={placementZones}
            products={sponsorshipProducts}
            onSubmit={handlePromotionalCampaignSubmit}
            onCancel={closeAllModals}
            isSubmitting={placementSaving}
          />
        </AdminModal>
      )}

      {offlineQueueOpen && (
        <AdminModal
          title={t('admin.offlineQueueTitle', { defaultValue: 'Offline submissions' })}
          onClose={() => setOfflineQueueOpen(false)}
        >
          <OfflineQueuePanel onClose={() => setOfflineQueueOpen(false)} />
        </AdminModal>
      )}

      {bulkEntity && bulkEntity !== 'blog' && (
        <AdminModal title={getBulkModalTitle(bulkEntity)} onClose={() => setBulkEntity(null)}>
          <Suspense
            fallback={
              <AdminLazyFallback
                label={t('admin.loadingImportTools', { defaultValue: 'Loading import tools...' })}
              />
            }
          >
            <BulkImportModal entity={bulkEntity} onClose={() => setBulkEntity(null)} />
          </Suspense>
        </AdminModal>
      )}

      {blogTextImportOpen && (
        <AdminModal
          title={t('admin.bulkUploadPosts', { defaultValue: 'Bulk upload blog posts' })}
          onClose={() => setBlogTextImportOpen(false)}
        >
          <BlogTextImportModal onClose={() => setBlogTextImportOpen(false)} />
        </AdminModal>
      )}
      {dealerControlDealer && (
        <AdminModal
          title={t('admin.dealerControlCenterTitle', {
            defaultValue: 'Dealer control center: {{name}}',
            name: dealerControlDealer.name,
          })}
          onClose={closeDealerControlCenter}
        >
          <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  {t('admin.dealerControlCenterDescription', {
                    defaultValue:
                      'Inspect the dealer owner account, team members, pending invites, and operational relationships. Owner reassignment and team enforcement run through trusted backend paths.',
                  })}
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                    ID: {dealerControlDealer.id}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                    {t('admin.dealerFilterStatusLabel', {
                      defaultValue: 'Status: {{status}}',
                      status: deriveStatus(dealerControlDealer),
                    })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadDealerControlDetail(dealerControlDealer.id)}
                disabled={dealerControlLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {dealerControlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw size={16} />}
                <span>{t('admin.refreshDealerControlCenter', { defaultValue: 'Refresh dealer data' })}</span>
              </button>
            </div>

            {dealerControlError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {dealerControlError}
              </div>
            )}

            {dealerControlLoading && !dealerControlDetail ? (
              <AdminLazyFallback
                label={t('admin.loadingDealerControlCenter', {
                  defaultValue: 'Loading dealer control center...',
                })}
              />
            ) : dealerControlDetail ? (
              <>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.dealerOwnerAccount', { defaultValue: 'Owner account' })}
                      </h3>
                    </div>

                    {dealerControlDetail.owner ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-white">
                              {dealerControlDetail.owner.displayName ||
                                dealerControlDetail.owner.email ||
                                dealerControlDetail.owner.uid}
                            </p>
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                              UID: {dealerControlDetail.owner.uid}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {t('admin.accessRoleBadge', {
                                defaultValue: 'Role: {{role}}',
                                role: dealerControlDetail.owner.role,
                              })}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {t('admin.accessAccountTypeBadge', {
                                defaultValue: 'Type: {{type}}',
                                type: dealerControlDetail.owner.accountType ?? 'user',
                              })}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {t('admin.accessAccountStatusBadge', {
                                defaultValue: 'Status: {{status}}',
                                status: dealerControlDetail.owner.accountStatus ?? 'active',
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-gray-500">
                              {t('admin.ownerEmailLabel', { defaultValue: 'Owner email' })}
                            </p>
                            <p className="mt-1 text-sm text-gray-200">
                              {dealerControlDetail.owner.email ??
                                t('admin.missingEmail', { defaultValue: 'No email on file' })}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-gray-500">
                              {t('admin.emailVerificationStatus', { defaultValue: 'Email verification' })}
                            </p>
                            <p className="mt-1 text-sm text-gray-200">
                              {dealerControlDetail.owner.emailVerified
                                ? t('admin.emailVerifiedBadge', { defaultValue: 'Email verified' })
                                : t('admin.emailNotVerified', { defaultValue: 'Not verified' })}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-gray-500">
                              {t('admin.lastSignInLabel', { defaultValue: 'Last sign-in' })}
                            </p>
                            <p className="mt-1 text-sm text-gray-200">
                              {formatDateTime(dealerControlDetail.owner.lastSignInAt) ??
                                t('admin.noLastSignIn', { defaultValue: 'No sign-in recorded' })}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-gray-500">
                              {t('admin.authAccessLabel', { defaultValue: 'Auth access' })}
                            </p>
                            <p className="mt-1 text-sm text-gray-200">
                              {dealerControlDetail.owner.authDisabled
                                ? t('admin.authDisabled', { defaultValue: 'Disabled' })
                                : t('admin.authEnabled', { defaultValue: 'Enabled' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        {t('admin.noDealerOwnerLinked', {
                          defaultValue:
                            'No owner account is currently linked to this dealer. Use account activation or assign an existing account below.',
                        })}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.reassignDealerOwner', { defaultValue: 'Reassign owner' })}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm text-gray-400">
                        {t('admin.reassignDealerOwnerDescription', {
                          defaultValue:
                            'Promote an existing user account into the dealer owner role. The account must already exist and cannot be a platform admin.',
                        })}
                      </p>
                      <label className="flex flex-col gap-2 text-sm text-gray-300">
                        <span className="font-medium text-white">
                          {t('admin.ownerReassignQueryLabel', {
                            defaultValue: 'Target email or UID',
                          })}
                        </span>
                        <input
                          type="text"
                          value={dealerOwnerDraftQuery}
                          onChange={event => setDealerOwnerDraftQuery(event.target.value)}
                          disabled={!canEditDealers || dealerOwnerUpdating}
                          placeholder={t('admin.ownerReassignQueryPlaceholder', {
                            defaultValue: 'new-owner@example.com or Firebase UID',
                          })}
                          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleDealerOwnerReassign()}
                        disabled={!canEditDealers || dealerOwnerUpdating}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {dealerOwnerUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield size={16} />}
                        <span>{t('admin.reassignDealerOwnerButton', { defaultValue: 'Reassign owner' })}</span>
                      </button>
                    </div>
                  </section>
                </div>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-gray-cyan" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                      {t('admin.dealerOperationalSnapshot', { defaultValue: 'Operational snapshot' })}
                    </h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">
                        {t('admin.listingsTab', { defaultValue: 'Listings' })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {dealerControlDetail.relationships.listingCounts.total}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('admin.pendingActiveSplit', {
                          defaultValue: 'Pending {{pending}} / Active {{active}}',
                          pending: dealerControlDetail.relationships.listingCounts.pending,
                          active:
                            dealerControlDetail.relationships.listingCounts.active +
                            dealerControlDetail.relationships.listingCounts.approved,
                        })}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">
                        {t('admin.manageModels', { defaultValue: 'Models' })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {dealerControlDetail.relationships.modelCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">
                        {t('admin.enquiriesLabel', { defaultValue: 'Enquiries' })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {dealerControlDetail.relationships.enquiryCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">
                        {t('admin.teamCapacityLabel', { defaultValue: 'Team capacity' })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {dealerControlDetail.capacity.remainingSlots} / {dealerControlDetail.capacity.maxTeamAccounts}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('admin.teamUsageSummary', {
                          defaultValue: 'Owner {{owners}}, Staff {{staff}}, Pending invites {{invites}}',
                          owners: dealerControlDetail.capacity.ownerCount,
                          staff: dealerControlDetail.capacity.activeStaffCount,
                          invites: dealerControlDetail.capacity.pendingInviteCount,
                        })}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.dealerRecentListings', { defaultValue: 'Recent listings' })}
                      </h3>
                    </div>

                    {dealerControlDetail.relationships.recentListings.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t('admin.dealerRecentListingsEmpty', {
                          defaultValue: 'No recent listings were found for this dealer.',
                        })}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dealerControlDetail.relationships.recentListings.map(listing => (
                          <article
                            key={listing.id}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">{listing.title}</p>
                              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                                {listing.status ?? 'unknown'}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                              <span>ID: {listing.id}</span>
                              {listing.ownerUid && <span>Owner UID: {listing.ownerUid}</span>}
                              {listing.price && <span>{listing.price}</span>}
                              {listing.updatedAt && (
                                <span>
                                  {t('admin.updatedOn', {
                                    defaultValue: 'Updated on {{date}}',
                                    date: formatDateTime(
                                      typeof listing.updatedAt === 'string' ? listing.updatedAt : null,
                                    ),
                                  })}
                                </span>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Eye className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.recentAdminHistory', { defaultValue: 'Recent admin history' })}
                      </h3>
                    </div>

                    {dealerControlDetail.recentAuditLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t('admin.dealerRecentHistoryEmpty', {
                          defaultValue: 'No recent privileged actions are linked to this dealer yet.',
                        })}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dealerControlDetail.recentAuditLogs.map(log => (
                          <article
                            key={log.id}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-gray-100">
                                {formatAuditActionLabel(log.action)}
                              </span>
                              {log.createdAt && (
                                <span className="text-xs text-gray-500">
                                  {formatDateTime(typeof log.createdAt === 'string' ? log.createdAt : null)}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-white">{log.summary}</p>
                            <p className="mt-2 text-xs text-gray-500">
                              {t('admin.auditActorLabel', { defaultValue: 'Actor' })}: {log.actorEmail || log.actorUid}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-gray-cyan" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                      {t('admin.internalAdminNotes', { defaultValue: 'Internal admin notes' })}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <label className="flex flex-col gap-2 text-sm text-gray-300">
                      <span className="font-medium text-white">
                        {t('admin.addInternalNote', { defaultValue: 'Add internal note' })}
                      </span>
                      <textarea
                        value={dealerControlNoteDraft}
                        onChange={event => setDealerControlNoteDraft(event.target.value)}
                        disabled={!canEditDealers || dealerControlNoteSaving}
                        rows={4}
                        placeholder={t('admin.dealerInternalNotePlaceholder', {
                          defaultValue:
                            'Track context for future admins, commercial follow-up, or operational issues on this dealer.',
                        })}
                        className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleDealerControlNoteCreate()}
                      disabled={!canEditDealers || dealerControlNoteSaving}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {dealerControlNoteSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus size={16} />
                      )}
                      <span>{t('admin.saveInternalNote', { defaultValue: 'Save internal note' })}</span>
                    </button>

                    {dealerControlDetail.adminNotes.length === 0 ? (
                      <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-gray-500">
                        {t('admin.dealerInternalNotesEmpty', {
                          defaultValue: 'No internal admin notes have been recorded for this dealer yet.',
                        })}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dealerControlDetail.adminNotes.map(note => (
                          <article
                            key={note.id}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <p className="whitespace-pre-wrap text-sm text-gray-200">{note.body}</p>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                              <span>{note.createdByEmail || note.createdByUid}</span>
                              {note.createdAt && (
                                <span>{formatDateTime(typeof note.createdAt === 'string' ? note.createdAt : null)}</span>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.dealerTeamMembers', { defaultValue: 'Dealer team members' })}
                      </h3>
                    </div>

                    {dealerControlDetail.staffMembers.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t('admin.dealerTeamMembersEmpty', {
                          defaultValue: 'No dealer staff members are currently linked.',
                        })}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dealerControlDetail.staffMembers.map(member => (
                          <article
                            key={member.uid}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-white">
                                    {member.displayName || member.email || member.uid}
                                  </p>
                                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                                    {member.dealerStaffRole ?? 'staff'}
                                  </span>
                                  {member.accountStatus && (
                                    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                                      {member.accountStatus}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">{member.email ?? member.uid}</p>
                                {member.updatedAt && (
                                  <p className="text-xs text-gray-500">
                                    {t('admin.updatedOn', {
                                      defaultValue: 'Updated on {{date}}',
                                      date: formatDateTime(member.updatedAt),
                                    })}
                                  </p>
                                )}
                              </div>
                              {canManageDealerTeam && (
                                <button
                                  type="button"
                                  onClick={() => void handleDealerControlStaffRemove(member.uid)}
                                  disabled={dealerControlStaffRemovingId === member.uid}
                                  className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {dealerControlStaffRemovingId === member.uid ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                  <span>{t('admin.removeStaffAccess', { defaultValue: 'Remove access' })}</span>
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Key className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.dealerTeamInvites', { defaultValue: 'Dealer team invites' })}
                      </h3>
                    </div>

                    {dealerControlDetail.invites.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t('admin.dealerTeamInvitesEmpty', {
                          defaultValue: 'No dealer team invites have been issued yet.',
                        })}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dealerControlDetail.invites.map(invite => (
                          <article
                            key={invite.id}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-white">{invite.email}</p>
                                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                                    {invite.status}
                                  </span>
                                  {invite.dealerStaffRole && (
                                    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                                      {invite.dealerStaffRole}
                                    </span>
                                  )}
                                </div>
                                {invite.createdAt && (
                                  <p className="text-xs text-gray-500">
                                    {t('admin.inviteCreatedAt', {
                                      defaultValue: 'Created {{date}}',
                                      date: formatDateTime(typeof invite.createdAt === 'string' ? invite.createdAt : null),
                                    })}
                                  </p>
                                )}
                              </div>
                              {canManageDealerTeam && invite.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => void handleDealerControlInviteRevoke(invite.id)}
                                  disabled={dealerControlInviteRevokingId === invite.id}
                                  className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {dealerControlInviteRevokingId === invite.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <XCircle size={14} />
                                  )}
                                  <span>{t('admin.revokeInvite', { defaultValue: 'Revoke' })}</span>
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-400">
                {t('admin.dealerControlNoData', {
                  defaultValue: 'Dealer relationship data is not available yet.',
                })}
              </div>
            )}
          </div>
        </AdminModal>
      )}
      {listingControlListing && (
        <AdminModal
          title={t('admin.listingControlCenterTitle', {
            defaultValue: 'Listing control center: {{name}}',
            name: listingControlListing.title || `${listingControlListing.make} ${listingControlListing.model}`,
          })}
          onClose={closeListingControlCenter}
        >
          <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  {t('admin.listingControlCenterDescription', {
                    defaultValue:
                      'Inspect listing ownership, dealer linkage, moderation state, enquiries, and internal admin context through trusted backend reads.',
                  })}
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                    ID: {listingControlListing.id}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                    {t('admin.listingFilterStatusLabel', {
                      defaultValue: 'Status: {{status}}',
                      status: listingControlDetail?.listing.status ?? listingControlListing.status,
                    })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadListingControlDetail(listingControlListing.id)}
                disabled={listingControlLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {listingControlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw size={16} />}
                <span>{t('admin.refreshListingControlCenter', { defaultValue: 'Refresh listing data' })}</span>
              </button>
            </div>

            {listingControlError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {listingControlError}
              </div>
            )}

            {listingControlLoading && !listingControlDetail ? (
              <AdminLazyFallback
                label={t('admin.loadingListingControlCenter', {
                  defaultValue: 'Loading listing control center...',
                })}
              />
            ) : listingControlDetail ? (
              <>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.listingOverview', { defaultValue: 'Listing overview' })}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {listingControlDetail.listing.primaryImageUrl ? (
                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                          <img
                            src={listingControlDetail.listing.primaryImageUrl}
                            alt={listingControlDetail.listing.title}
                            className="h-52 w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-sm text-gray-500">
                          {t('admin.listingNoPrimaryImage', { defaultValue: 'No primary image on file.' })}
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-white">{listingControlDetail.listing.title}</p>
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                            {listingControlDetail.listing.status ?? 'unknown'}
                          </span>
                          {listingControlDetail.listing.isFeatured && (
                            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                              {t('admin.featured', { defaultValue: 'Featured' })}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                          {listingControlDetail.listing.make && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {listingControlDetail.listing.make}
                              {listingControlDetail.listing.model ? ` ${listingControlDetail.listing.model}` : ''}
                            </span>
                          )}
                          {listingControlDetail.listing.year !== null && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {listingControlDetail.listing.year}
                            </span>
                          )}
                          {listingControlDetail.listing.bodyType && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {listingControlDetail.listing.bodyType}
                            </span>
                          )}
                          {listingControlDetail.listing.fuelType && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {listingControlDetail.listing.fuelType}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.price', { defaultValue: 'Price' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {listingControlDetail.listing.price !== null
                              ? `${listingControlDetail.listing.price.toLocaleString()} ${listingControlDetail.listing.priceCurrency ?? ''}`.trim()
                              : t('admin.priceUnknown', { defaultValue: 'Price unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.mileage', { defaultValue: 'Mileage' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {listingControlDetail.listing.mileage !== null
                              ? `${listingControlDetail.listing.mileage.toLocaleString()} km`
                              : t('admin.mileageUnknown', { defaultValue: 'Mileage unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.mediaSummaryLabel', { defaultValue: 'Media' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {t('admin.mediaSummaryValue', {
                              defaultValue: '{{images}} images, {{gallery}} gallery items',
                              images: listingControlDetail.listing.imageCount,
                              gallery: listingControlDetail.listing.galleryCount,
                            })}
                          </p>
                          {listingControlDetail.listing.videoUrl && (
                            <p className="mt-1 text-xs text-gray-500">
                              {t('admin.videoAttached', { defaultValue: 'Video attached' })}
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.listingFlagsLabel', { defaultValue: 'Commercial flags' })}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-300">
                            <span>{listingControlDetail.listing.isForRent ? 'Rent enabled' : 'No rent'}</span>
                            <span>{listingControlDetail.listing.isForSubscription ? 'Subscription enabled' : 'No subscription'}</span>
                          </div>
                        </div>
                      </div>

                      {(listingControlDetail.listing.locationAddress || listingControlDetail.listing.locationCity) && (
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-gray-500">
                            <MapPin className="h-3.5 w-3.5 text-gray-cyan" />
                            <span>{t('admin.locationLabel', { defaultValue: 'Location' })}</span>
                          </div>
                          <p className="text-sm text-gray-200">
                            {[listingControlDetail.listing.locationAddress, listingControlDetail.listing.locationCity]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="space-y-6">
                    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-gray-cyan" />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                          {t('admin.listingRelationships', { defaultValue: 'Ownership and relationships' })}
                        </h3>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.dealerLabel', { defaultValue: 'Dealer' })}
                          </p>
                          {listingControlDetail.dealer ? (
                            <>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {listingControlDetail.dealer.name}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium">
                                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-gray-300">
                                  {listingControlDetail.dealer.status ?? 'unknown'}
                                </span>
                                {listingControlDetail.dealer.planId && (
                                  <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-sky-100">
                                    {listingControlDetail.dealer.planId.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">
                              {t('admin.listingNoDealerLinked', { defaultValue: 'No dealer record is linked.' })}
                            </p>
                          )}
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.ownerAccountLabel', { defaultValue: 'Owner account' })}
                          </p>
                          {listingControlDetail.owner ? (
                            <>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {listingControlDetail.owner.displayName ||
                                  listingControlDetail.owner.email ||
                                  listingControlDetail.owner.uid}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {listingControlDetail.owner.email ?? listingControlDetail.owner.uid}
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">
                              {t('admin.listingNoOwnerLinked', { defaultValue: 'No owner account is linked.' })}
                            </p>
                          )}
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.modelLabel', { defaultValue: 'Model linkage' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {listingControlDetail.model
                              ? [listingControlDetail.model.brand, listingControlDetail.model.modelName]
                                  .filter(Boolean)
                                  .join(' ')
                              : t('admin.listingNoModelLinked', {
                                  defaultValue: 'No canonical model is linked.',
                                })}
                          </p>
                        </div>

                        {listingControlDetail.listing.modelProfileChangeReason && (
                          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-amber-200/80">
                              {t('admin.listingModelOverrideReview', {
                                defaultValue: 'Dealer model-card override',
                              })}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-amber-50">
                              {listingControlDetail.listing.modelProfileChangeReason.replace(/_/g, ' ')}
                            </p>
                            {listingControlDetail.listing.modelProfileChangeFields.length > 0 && (
                              <p className="mt-2 text-xs text-amber-100/80">
                                {t('admin.listingModelOverrideFields', {
                                  defaultValue: 'Changed fields: {{fields}}',
                                  fields: listingControlDetail.listing.modelProfileChangeFields.join(', '),
                                })}
                              </p>
                            )}
                            {listingControlDetail.listing.modelProfileChangeNotes && (
                              <p className="mt-2 text-sm leading-6 text-amber-50/90">
                                {listingControlDetail.listing.modelProfileChangeNotes}
                              </p>
                            )}
                            {listingControlDetail.listing.modelProfileSnapshot && (
                              <p className="mt-2 text-xs text-amber-100/70">
                                {t('admin.listingModelOverrideSnapshot', {
                                  defaultValue: 'Original card: {{model}}',
                                  model: [
                                    listingControlDetail.listing.modelProfileSnapshot.brand,
                                    listingControlDetail.listing.modelProfileSnapshot.modelName,
                                  ].filter(Boolean).join(' ') || listingControlDetail.listing.modelProfileSnapshot.modelId,
                                })}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-gray-cyan" />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                          {t('admin.listingOperationalSnapshot', { defaultValue: 'Operational snapshot' })}
                        </h3>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.enquiriesLabel', { defaultValue: 'Enquiries' })}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {listingControlDetail.relationships.enquiryCount}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {t('admin.enquiryBreakdown', {
                              defaultValue: 'New {{newCount}} / Read {{readCount}} / Replied {{repliedCount}}',
                              newCount: listingControlDetail.relationships.newEnquiryCount,
                              readCount: listingControlDetail.relationships.readEnquiryCount,
                              repliedCount: listingControlDetail.relationships.repliedEnquiryCount,
                            })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.listingModerationState', { defaultValue: 'Moderation state' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {listingControlDetail.listing.rejectionReason
                              ? listingControlDetail.listing.rejectionReason
                              : t('admin.listingNoRejectionReason', {
                                  defaultValue: 'No rejection reason recorded.',
                                })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.createdLabel', { defaultValue: 'Created on' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {formatDateTime(listingControlDetail.listing.createdAt) ??
                              t('admin.dateUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.updatedLabel', { defaultValue: 'Updated on' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {formatDateTime(listingControlDetail.listing.updatedAt) ??
                              t('admin.dateUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Eye className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.recentAdminHistory', { defaultValue: 'Recent admin history' })}
                      </h3>
                    </div>

                    {listingControlDetail.recentAuditLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t('admin.listingRecentHistoryEmpty', {
                          defaultValue: 'No recent privileged actions are linked to this listing yet.',
                        })}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {listingControlDetail.recentAuditLogs.map(log => (
                          <article
                            key={log.id}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-gray-100">
                                {formatAuditActionLabel(log.action)}
                              </span>
                              {log.createdAt && (
                                <span className="text-xs text-gray-500">
                                  {formatDateTime(typeof log.createdAt === 'string' ? log.createdAt : null)}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-white">{log.summary}</p>
                            <p className="mt-2 text-xs text-gray-500">
                              {t('admin.auditActorLabel', { defaultValue: 'Actor' })}: {log.actorEmail || log.actorUid}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.internalAdminNotes', { defaultValue: 'Internal admin notes' })}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <label className="flex flex-col gap-2 text-sm text-gray-300">
                        <span className="font-medium text-white">
                          {t('admin.addInternalNote', { defaultValue: 'Add internal note' })}
                        </span>
                        <textarea
                          value={listingControlNoteDraft}
                          onChange={event => setListingControlNoteDraft(event.target.value)}
                          disabled={!canModerateListings || listingControlNoteSaving}
                          rows={4}
                          placeholder={t('admin.listingInternalNotePlaceholder', {
                            defaultValue:
                              'Track moderation rationale, pricing concerns, duplicate suspicion, or operational follow-up for this listing.',
                          })}
                          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleListingControlNoteCreate()}
                        disabled={!canModerateListings || listingControlNoteSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {listingControlNoteSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus size={16} />
                        )}
                        <span>{t('admin.saveInternalNote', { defaultValue: 'Save internal note' })}</span>
                      </button>

                      {listingControlDetail.adminNotes.length === 0 ? (
                        <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-gray-500">
                          {t('admin.listingInternalNotesEmpty', {
                            defaultValue: 'No internal admin notes have been recorded for this listing yet.',
                          })}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {listingControlDetail.adminNotes.map(note => (
                            <article
                              key={note.id}
                              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                            >
                              <p className="whitespace-pre-wrap text-sm text-gray-200">{note.body}</p>
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                <span>{note.createdByEmail || note.createdByUid}</span>
                                {note.createdAt && (
                                  <span>{formatDateTime(typeof note.createdAt === 'string' ? note.createdAt : null)}</span>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-400">
                {t('admin.listingControlNoData', {
                  defaultValue: 'Listing relationship data is not available yet.',
                })}
              </div>
            )}
          </div>
        </AdminModal>
      )}
      {modelControlModel && (
        <AdminModal
          title={t('admin.modelControlCenterTitle', {
            defaultValue: 'Model control center: {{name}}',
            name: [modelControlModel.brand, modelControlModel.model_name].filter(Boolean).join(' '),
          })}
          onClose={closeModelControlCenter}
        >
          <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  {t('admin.modelControlCenterDescription', {
                    defaultValue:
                      'Inspect canonical EV model ownership, linked dealers, linked listings, recent admin actions, and internal notes.',
                  })}
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                    ID: {modelControlModel.id}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                    {modelControlDetail?.model.isActive === false
                      ? t('admin.hidden', { defaultValue: 'Hidden' })
                      : t('admin.visible', { defaultValue: 'Visible' })}
                  </span>
                  {modelControlDetail?.model.reviewStatus === 'pending_review' && (
                    <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-1 text-amber-100">
                      {t('admin.pendingReview', { defaultValue: 'Pending review' })}
                    </span>
                  )}
                  {modelControlDetail?.model.reviewStatus === 'rejected' && (
                    <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-2 py-1 text-red-100">
                      {t('admin.rejected', { defaultValue: 'Rejected' })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void loadModelControlDetail(modelControlModel.id)}
                  disabled={modelControlLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {modelControlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw size={16} />}
                  <span>{t('admin.refreshModelControlCenter', { defaultValue: 'Refresh model data' })}</span>
                </button>
                {canManageModels && modelControlDetail && (
                  <>
                    {modelControlDetail.model.reviewStatus === 'pending_review' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleReviewModel(modelControlModel, 'approved')}
                          disabled={modelAction !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {modelAction?.id === modelControlModel.id && modelAction.type === 'approveReview' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle size={16} />
                          )}
                          <span>{t('admin.approveModelReview', { defaultValue: 'Approve review' })}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReviewModel(modelControlModel, 'rejected')}
                          disabled={modelAction !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {modelAction?.id === modelControlModel.id && modelAction.type === 'rejectReview' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle size={16} />
                          )}
                          <span>{t('admin.rejectModelReview', { defaultValue: 'Reject review' })}</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setModelFormState({
                          mode: 'edit',
                          entity: models.find(entry => entry.id === modelControlModel.id) ?? modelControlModel,
                        })
                      }
                      disabled={modelSubmitting}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Pencil size={16} />
                      <span>{t('admin.editModel', { defaultValue: 'Edit model' })}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleModelFeatured(modelControlModel)}
                      disabled={modelAction !== null}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        modelControlDetail.model.isFeatured
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                      }`}
                    >
                      {modelAction?.id === modelControlModel.id && modelAction.type === 'toggleFeatured' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      <span>
                        {modelControlDetail.model.isFeatured
                          ? t('admin.unfeatureModel', { defaultValue: 'Remove featured' })
                          : t('admin.featureModel', { defaultValue: 'Feature model' })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleModelVisibility(modelControlModel)}
                      disabled={modelAction !== null}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        modelControlDetail.model.isActive === false
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'
                      }`}
                    >
                      {modelAction?.id === modelControlModel.id && modelAction.type === 'toggleVisibility' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : modelControlDetail.model.isActive === false ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} />
                      )}
                      <span>
                        {modelControlDetail.model.isActive === false
                          ? t('admin.showModel', { defaultValue: 'Show model' })
                          : t('admin.hideModel', { defaultValue: 'Hide model' })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmAndDelete(() => handleDeleteModel(modelControlModel.id))}
                      disabled={modelAction !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {modelAction?.id === modelControlModel.id && modelAction.type === 'delete' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      <span>{t('admin.deleteModel', { defaultValue: 'Delete model' })}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {modelControlError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {modelControlError}
              </div>
            )}

            {modelControlLoading && !modelControlDetail ? (
              <AdminLazyFallback
                label={t('admin.loadingModelControlCenter', {
                  defaultValue: 'Loading model control center...',
                })}
              />
            ) : modelControlDetail ? (
              <>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.modelOverview', { defaultValue: 'Model overview' })}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {modelControlDetail.model.heroImageUrl ? (
                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                          <img
                            src={modelControlDetail.model.heroImageUrl}
                            alt={[modelControlDetail.model.brand, modelControlDetail.model.modelName]
                              .filter(Boolean)
                              .join(' ')}
                            className="h-52 w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-sm text-gray-500">
                          {t('admin.modelNoPrimaryImage', { defaultValue: 'No primary image on file.' })}
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-white">
                            {[modelControlDetail.model.brand, modelControlDetail.model.modelName]
                              .filter(Boolean)
                              .join(' ')}
                          </p>
                          {modelControlDetail.model.isFeatured && (
                            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                              {t('admin.featured', { defaultValue: 'Featured' })}
                            </span>
                          )}
                          {modelControlDetail.model.reviewStatus === 'pending_review' && (
                            <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-100">
                              {t('admin.pendingReview', { defaultValue: 'Pending review' })}
                            </span>
                          )}
                          {modelControlDetail.model.reviewStatus === 'rejected' && (
                            <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-100">
                              {t('admin.rejected', { defaultValue: 'Rejected' })}
                            </span>
                          )}
                          {modelControlDetail.model.isActive === false && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                              {t('admin.hidden', { defaultValue: 'Hidden' })}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                          {modelControlDetail.model.source && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              Source: {modelControlDetail.model.source}
                            </span>
                          )}
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                            {t('admin.reviewState', { defaultValue: 'Review state' })}: {modelControlDetail.model.reviewStatus}
                          </span>
                          {modelControlDetail.model.bodyType && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {modelControlDetail.model.bodyType}
                            </span>
                          )}
                          {modelControlDetail.model.chargePort && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {modelControlDetail.model.chargePort}
                            </span>
                          )}
                          {modelControlDetail.model.seats !== null && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {modelControlDetail.model.seats} seats
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.batteryCapacityLabel', { defaultValue: 'Battery capacity' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {modelControlDetail.model.batteryCapacity !== null
                              ? `${modelControlDetail.model.batteryCapacity} kWh`
                              : t('admin.valueUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.rangeLabel', { defaultValue: 'Range (WLTP)' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {modelControlDetail.model.rangeWltp !== null
                              ? `${modelControlDetail.model.rangeWltp} km`
                              : t('admin.valueUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.powerLabel', { defaultValue: 'Power' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {modelControlDetail.model.powerKw !== null
                              ? `${modelControlDetail.model.powerKw} kW`
                              : t('admin.valueUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.mediaSummaryLabel', { defaultValue: 'Media' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {t('admin.mediaSummaryValue', {
                              defaultValue: '{{images}} images, {{gallery}} gallery items',
                              images: modelControlDetail.model.imageCount,
                              gallery: modelControlDetail.model.galleryCount,
                            })}
                          </p>
                        </div>
                      </div>

                      {modelControlDetail.model.notes && (
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.modelDataNotes', { defaultValue: 'Model data notes' })}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-200">
                            {modelControlDetail.model.notes}
                          </p>
                        </div>
                      )}
                      {(modelControlDetail.model.reviewRequestedAt ||
                        modelControlDetail.model.reviewedAt ||
                        modelControlDetail.model.reviewNotes) && (
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.reviewDetails', { defaultValue: 'Review details' })}
                          </p>
                          <div className="mt-2 space-y-2 text-sm text-gray-200">
                            {modelControlDetail.model.reviewRequestedAt && (
                              <p>
                                {t('admin.reviewRequestedAt', { defaultValue: 'Requested' })}:{' '}
                                {formatDateTime(modelControlDetail.model.reviewRequestedAt) ?? modelControlDetail.model.reviewRequestedAt}
                              </p>
                            )}
                            {modelControlDetail.model.reviewedAt && (
                              <p>
                                {t('admin.reviewedAt', { defaultValue: 'Reviewed' })}:{' '}
                                {formatDateTime(modelControlDetail.model.reviewedAt) ?? modelControlDetail.model.reviewedAt}
                              </p>
                            )}
                            {modelControlDetail.model.reviewedBy && (
                              <p>
                                {t('admin.reviewedBy', { defaultValue: 'Reviewed by' })}: {modelControlDetail.model.reviewedBy}
                              </p>
                            )}
                            {modelControlDetail.model.reviewNotes && (
                              <p className="whitespace-pre-wrap">{modelControlDetail.model.reviewNotes}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="space-y-6">
                    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-gray-cyan" />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                          {t('admin.modelOwnershipAndRelationships', {
                            defaultValue: 'Ownership and relationships',
                          })}
                        </h3>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.ownerDealerLabel', { defaultValue: 'Owner dealer' })}
                          </p>
                          {modelControlDetail.ownerDealer ? (
                            <>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {modelControlDetail.ownerDealer.name}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium">
                                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-gray-300">
                                  {modelControlDetail.ownerDealer.status ?? 'unknown'}
                                </span>
                                {modelControlDetail.ownerDealer.planId && (
                                  <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-sky-100">
                                    {modelControlDetail.ownerDealer.planId.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">
                              {t('admin.modelNoOwnerDealerLinked', {
                                defaultValue: 'No owner dealer is linked.',
                              })}
                            </p>
                          )}
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.ownerAccountLabel', { defaultValue: 'Owner account' })}
                          </p>
                          {modelControlDetail.owner ? (
                            <>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {modelControlDetail.owner.displayName ||
                                  modelControlDetail.owner.email ||
                                  modelControlDetail.owner.uid}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {modelControlDetail.owner.email ?? modelControlDetail.owner.uid}
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">
                              {t('admin.modelNoOwnerLinked', {
                                defaultValue: 'No owner account is linked.',
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-gray-cyan" />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                          {t('admin.modelOperationalSnapshot', {
                            defaultValue: 'Operational snapshot',
                          })}
                        </h3>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.linkedDealersLabel', { defaultValue: 'Linked dealers' })}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {modelControlDetail.relationships.dealerCount}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {t('admin.activeDealersCountLabel', {
                              defaultValue: 'Active {{count}}',
                              count: modelControlDetail.relationships.activeDealerCount,
                            })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.linkedListingsLabel', { defaultValue: 'Linked listings' })}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {modelControlDetail.relationships.listingCounts.total}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {t('admin.pendingActiveSplit', {
                              defaultValue: 'Pending {{pending}} / Active {{active}}',
                              pending: modelControlDetail.relationships.listingCounts.pending,
                              active:
                                modelControlDetail.relationships.listingCounts.active +
                                modelControlDetail.relationships.listingCounts.approved,
                            })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.createdLabel', { defaultValue: 'Created on' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {formatDateTime(modelControlDetail.model.createdAt) ??
                              t('admin.dateUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.updatedLabel', { defaultValue: 'Updated on' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {formatDateTime(modelControlDetail.model.updatedAt) ??
                              t('admin.dateUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.modelLinkedDealersTitle', { defaultValue: 'Linked dealers' })}
                      </h3>
                    </div>

                    {modelControlDetail.relationships.recentDealers.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t('admin.modelLinkedDealersEmpty', {
                          defaultValue: 'No dealers are linked to this model yet.',
                        })}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {modelControlDetail.relationships.recentDealers.map(dealer => (
                          <article
                            key={dealer.id}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">{dealer.name}</p>
                              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                                {dealer.status ?? 'unknown'}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                              <span>ID: {dealer.id}</span>
                              <span>{dealer.isActive ? 'Active' : 'Hidden'}</span>
                              {dealer.planId && <span>{dealer.planId.toUpperCase()}</span>}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.modelLinkedListingsTitle', { defaultValue: 'Linked listings' })}
                      </h3>
                    </div>

                    {modelControlDetail.relationships.recentListings.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t('admin.modelLinkedListingsEmpty', {
                          defaultValue: 'No listings are directly linked to this model yet.',
                        })}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {modelControlDetail.relationships.recentListings.map(listing => (
                          <article
                            key={listing.id}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">{listing.title}</p>
                              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                                {listing.status ?? 'unknown'}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                              <span>ID: {listing.id}</span>
                              {listing.dealerName && <span>{listing.dealerName}</span>}
                              {listing.price && <span>{listing.price}</span>}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Eye className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.recentAdminHistory', { defaultValue: 'Recent admin history' })}
                      </h3>
                    </div>

                    {modelControlDetail.recentAuditLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t('admin.modelRecentHistoryEmpty', {
                          defaultValue: 'No recent privileged actions are linked to this model yet.',
                        })}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {modelControlDetail.recentAuditLogs.map(log => (
                          <article
                            key={log.id}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-gray-100">
                                {formatAuditActionLabel(log.action)}
                              </span>
                              {log.createdAt && (
                                <span className="text-xs text-gray-500">
                                  {formatDateTime(typeof log.createdAt === 'string' ? log.createdAt : null)}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-white">{log.summary}</p>
                            <p className="mt-2 text-xs text-gray-500">
                              {t('admin.auditActorLabel', { defaultValue: 'Actor' })}: {log.actorEmail || log.actorUid}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.internalAdminNotes', { defaultValue: 'Internal admin notes' })}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <label className="flex flex-col gap-2 text-sm text-gray-300">
                        <span className="font-medium text-white">
                          {t('admin.addInternalNote', { defaultValue: 'Add internal note' })}
                        </span>
                        <textarea
                          value={modelControlNoteDraft}
                          onChange={event => setModelControlNoteDraft(event.target.value)}
                          disabled={!canManageModels || modelControlNoteSaving}
                          rows={4}
                          placeholder={t('admin.modelInternalNotePlaceholder', {
                            defaultValue:
                              'Track canonical data concerns, ownership context, duplicate risk, or review decisions for this model.',
                          })}
                          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleModelControlNoteCreate()}
                        disabled={!canManageModels || modelControlNoteSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {modelControlNoteSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus size={16} />
                        )}
                        <span>{t('admin.saveInternalNote', { defaultValue: 'Save internal note' })}</span>
                      </button>

                      {modelControlDetail.adminNotes.length === 0 ? (
                        <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-gray-500">
                          {t('admin.modelInternalNotesEmpty', {
                            defaultValue: 'No internal admin notes have been recorded for this model yet.',
                          })}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {modelControlDetail.adminNotes.map(note => (
                            <article
                              key={note.id}
                              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                            >
                              <p className="whitespace-pre-wrap text-sm text-gray-200">{note.body}</p>
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                <span>{note.createdByEmail || note.createdByUid}</span>
                                {note.createdAt && (
                                  <span>{formatDateTime(typeof note.createdAt === 'string' ? note.createdAt : null)}</span>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-400">
                {t('admin.modelControlNoData', {
                  defaultValue: 'Model relationship data is not available yet.',
                })}
              </div>
            )}
          </div>
        </AdminModal>
      )}
      {stationControlStation && (
        <AdminModal
          title={t('admin.stationControlCenterTitle', {
            defaultValue: 'Charging-station control center: {{address}}',
            address: stationControlStation.address,
          })}
          onClose={closeStationControlCenter}
        >
          <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  {t('admin.stationControlCenterDescription', {
                    defaultValue:
                      'Inspect station visibility, location metadata, recent privileged actions, and internal notes.',
                  })}
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                    ID: {stationControlStation.id}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                    {stationControlDetail?.station.isActive === false
                      ? t('admin.hidden', { defaultValue: 'Hidden' })
                      : t('admin.visible', { defaultValue: 'Visible' })}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void loadStationControlDetail(stationControlStation.id)}
                  disabled={stationControlLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {stationControlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw size={16} />}
                  <span>{t('admin.refreshStationControlCenter', { defaultValue: 'Refresh station data' })}</span>
                </button>
                {(stationControlDetail?.station.googleMapsLink ?? stationControlStation.googleMapsLink) && (
                  <a
                    href={stationControlDetail?.station.googleMapsLink ?? stationControlStation.googleMapsLink ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
                  >
                    <ExternalLink size={16} />
                    <span>{t('admin.openMapLink', { defaultValue: 'Open map link' })}</span>
                  </a>
                )}
                {canManageStations && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setStationFormState({
                          mode: 'edit',
                          entity:
                            stations.find(entry => entry.id === stationControlStation.id) ??
                            stationControlStation,
                        })
                      }
                      disabled={stationSubmitting}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Pencil size={16} />
                      <span>{t('admin.editStation', { defaultValue: 'Edit station' })}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleToggleStationVisibility(
                          stations.find(entry => entry.id === stationControlStation.id) ??
                            stationControlStation,
                        )
                      }
                      disabled={stationAction !== null}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        stationControlDetail?.station.isActive === false
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'
                      }`}
                    >
                      {stationAction?.id === stationControlStation.id &&
                      stationAction.type === 'toggleVisibility' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : stationControlDetail?.station.isActive === false ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} />
                      )}
                      <span>
                        {stationControlDetail?.station.isActive === false
                          ? t('admin.showStation', { defaultValue: 'Show station' })
                          : t('admin.hideStation', { defaultValue: 'Hide station' })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmAndDelete(() => handleDeleteStation(stationControlStation.id))}
                      disabled={stationAction !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {stationAction?.id === stationControlStation.id && stationAction.type === 'delete' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      <span>{t('admin.deleteStation', { defaultValue: 'Delete station' })}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {stationControlError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {stationControlError}
              </div>
            )}

            {stationControlLoading && !stationControlDetail ? (
              <AdminLazyFallback
                label={t('admin.loadingStationControlCenter', {
                  defaultValue: 'Loading charging-station control center...',
                })}
              />
            ) : stationControlDetail ? (
              <>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.stationOverview', { defaultValue: 'Station overview' })}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                        <p className="text-base font-semibold text-white">
                          {stationControlDetail.station.address ??
                            t('admin.valueUnavailable', { defaultValue: 'Unavailable' })}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium">
                          {stationControlDetail.station.operator && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {stationControlDetail.station.operator}
                            </span>
                          )}
                          {stationControlDetail.station.plugTypes && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                              {stationControlDetail.station.plugTypes}
                            </span>
                          )}
                          {stationControlDetail.station.chargingSpeedKw !== null && (
                            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">
                              {stationControlDetail.station.chargingSpeedKw} kW
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.stationCoordinatesLabel', { defaultValue: 'Coordinates' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {stationControlDetail.station.latitude !== null &&
                            stationControlDetail.station.longitude !== null
                              ? `${stationControlDetail.station.latitude}, ${stationControlDetail.station.longitude}`
                              : t('admin.coordinatesUnavailable', { defaultValue: 'Coordinates not set' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.stationPricingLabel', { defaultValue: 'Pricing details' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {stationControlDetail.station.pricingDetails ??
                              t('admin.valueUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.createdLabel', { defaultValue: 'Created on' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {formatDateTime(stationControlDetail.station.createdAt) ??
                              t('admin.dateUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.updatedLabel', { defaultValue: 'Updated on' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {formatDateTime(stationControlDetail.station.updatedAt) ??
                              t('admin.dateUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.stationOwnershipAndAudit', {
                          defaultValue: 'Creation and accountability',
                        })}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">
                          {t('admin.createdByLabel', { defaultValue: 'Created by' })}
                        </p>
                        {stationControlDetail.createdBy ? (
                          <>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {stationControlDetail.createdBy.displayName ||
                                stationControlDetail.createdBy.email ||
                                stationControlDetail.createdBy.uid}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {stationControlDetail.createdBy.email ?? stationControlDetail.createdBy.uid}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-sm text-gray-500">
                            {t('admin.stationCreatedByUnavailable', {
                              defaultValue: 'Creator details are not available.',
                            })}
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">
                          {t('admin.updatedByLabel', { defaultValue: 'Last updated by' })}
                        </p>
                        {stationControlDetail.updatedBy ? (
                          <>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {stationControlDetail.updatedBy.displayName ||
                                stationControlDetail.updatedBy.email ||
                                stationControlDetail.updatedBy.uid}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {stationControlDetail.updatedBy.email ?? stationControlDetail.updatedBy.uid}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-sm text-gray-500">
                            {t('admin.stationUpdatedByUnavailable', {
                              defaultValue: 'Updater details are not available.',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Eye className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.recentAdminHistory', { defaultValue: 'Recent admin history' })}
                      </h3>
                    </div>

                    {stationControlDetail.recentAuditLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t('admin.stationRecentHistoryEmpty', {
                          defaultValue: 'No recent privileged actions are linked to this station yet.',
                        })}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {stationControlDetail.recentAuditLogs.map(log => (
                          <article
                            key={log.id}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-gray-100">
                                {formatAuditActionLabel(log.action)}
                              </span>
                              {log.createdAt && (
                                <span className="text-xs text-gray-500">
                                  {formatDateTime(typeof log.createdAt === 'string' ? log.createdAt : null)}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-white">{log.summary}</p>
                            <p className="mt-2 text-xs text-gray-500">
                              {t('admin.auditActorLabel', { defaultValue: 'Actor' })}: {log.actorEmail || log.actorUid}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-gray-cyan" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        {t('admin.internalAdminNotes', { defaultValue: 'Internal admin notes' })}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <label className="flex flex-col gap-2 text-sm text-gray-300">
                        <span className="font-medium text-white">
                          {t('admin.addInternalNote', { defaultValue: 'Add internal note' })}
                        </span>
                        <textarea
                          value={stationControlNoteDraft}
                          onChange={event => setStationControlNoteDraft(event.target.value)}
                          disabled={!canManageStations || stationControlNoteSaving}
                          rows={4}
                          placeholder={t('admin.stationInternalNotePlaceholder', {
                            defaultValue:
                              'Track data-quality issues, verification checks, duplicate risk, or operator follow-up for this station.',
                          })}
                          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleStationControlNoteCreate()}
                        disabled={!canManageStations || stationControlNoteSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {stationControlNoteSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus size={16} />
                        )}
                        <span>{t('admin.saveInternalNote', { defaultValue: 'Save internal note' })}</span>
                      </button>

                      {stationControlDetail.adminNotes.length === 0 ? (
                        <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-gray-500">
                          {t('admin.stationInternalNotesEmpty', {
                            defaultValue: 'No internal admin notes have been recorded for this station yet.',
                          })}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {stationControlDetail.adminNotes.map(note => (
                            <article
                              key={note.id}
                              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                            >
                              <p className="whitespace-pre-wrap text-sm text-gray-200">{note.body}</p>
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                <span>{note.createdByEmail || note.createdByUid}</span>
                                {note.createdAt && (
                                  <span>{formatDateTime(typeof note.createdAt === 'string' ? note.createdAt : null)}</span>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-400">
                {t('admin.stationControlNoData', {
                  defaultValue: 'Charging-station relationship data is not available yet.',
                })}
              </div>
            )}
          </div>
        </AdminModal>
      )}
      {activationModalDealer && (
        <AdminModal
          title={t('admin.activateAccountTitle', { defaultValue: 'Aktivizo Llogarinë: {{name}}', name: activationModalDealer.name })}
          onClose={() => setActivationModalDealer(null)}
        >
          <form onSubmit={handleActivateAccount} className="space-y-6">
            <p className="text-sm text-gray-300">
              {t('admin.activationModalHint', { 
                defaultValue: 'Vendos email-in dhe një fjalëkalim për të krijuar llogarinë e dilerit. Dileri do të mund të kyçet me këto kredenciale.' 
              })}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200">
                  Email
                </label>
                <input
                  type="email"
                  value={activationEmail}
                  onChange={(e) => setActivationEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200">
                  {t('admin.password', { defaultValue: 'Fjalëkalimi' })}
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    value={activationPassword}
                    onChange={(e) => setActivationPassword(e.target.value)}
                    className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pl-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                    placeholder="Min. 6 karaktere"
                    required
                  />
                  <Key className="absolute left-3 top-2.5 text-gray-400" size={16} />
                </div>
              </div>
            </div>

            {activationError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
                {activationError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setActivationModalDealer(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 transition"
              >
                {t('admin.cancel', { defaultValue: 'Anulo' })}
              </button>
              <button
                type="submit"
                disabled={isActivating}
                className="flex items-center gap-2 rounded-lg bg-gray-cyan px-6 py-2 text-sm font-bold text-white transition hover:bg-gray-cyan/90 disabled:opacity-50"
              >
                {isActivating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Duke u procesuar...</span>
                  </>
                ) : (
                  <span>{t('admin.confirmActivation', { defaultValue: 'Krijo Llogarinë' })}</span>
                )}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </>
  );
};

export default AdminPage;
