import React, { Suspense, lazy, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
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
  Eye,
  EyeOff,
  ImageIcon,
  MapPin,
  MessageSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  BlogPost,
  ChargingStation,
  PermissionKey,
  PermissionOverrides,
} from '../types';
import DealerForm, { DealerFormValues } from '../components/admin/DealerForm';
import type { ModelFormValues } from '../components/admin/ModelForm';
import BlogPostForm, { BlogPostFormValues } from '../components/admin/BlogPostForm';
import ChargingStationForm from '../components/admin/ChargingStationForm';
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
} from '../services/storage';
import ModalLayout from '../components/ModalLayout';
import {
  ADMIN_ROLE_PRESETS,
  PERMISSION_KEYS,
  getEffectivePermissions,
} from '../utils/accessControl';

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
  return createPortal(
    <ModalLayout isOpen onClose={onClose} title={title} maxWidthClass="max-w-3xl">
      {children}
    </ModalLayout>,
    document.body
  );
};

type FormState<T> = { mode: 'create' | 'edit'; entity?: T } | null;

type TabKey = 'dealers' | 'users' | 'models' | 'listings' | 'blog' | 'stations' | 'access' | 'audit' | 'migration';
type DealerFilterKey = 'active' | 'inactive' | 'pending' | 'deleted';
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

const formatJsonBlock = (value: Record<string, unknown> | null | undefined) => {
  if (!value || Object.keys(value).length === 0) {
    return null;
  }

  return JSON.stringify(value, null, 2);
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

const AdminPage: React.FC = () => {
  const { logout, user, role, hasPermission, isMasterAdmin } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

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

  const [activeTab, setActiveTab] = useState<TabKey>('dealers');
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
    { id: string; type: 'toggleVisibility' | 'delete' } | null
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
  const canViewAudit = hasPermission('audit.view');

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
      // Refresh stations after bulk action
      const data = await fetchChargingStations();
      setStations(data);
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
      { id: 'dealers' as TabKey, label: t('admin.manageDealers') },
      ...(canReadUsers
        ? [{ id: 'users' as TabKey, label: t('admin.manageUsers', { defaultValue: 'Users' }) }]
        : []),
      { id: 'models' as TabKey, label: t('admin.manageModels') },
      { id: 'listings' as TabKey, label: t('admin.listingsTab', { defaultValue: 'Listings' }) },
      { id: 'blog' as TabKey, label: t('admin.manageBlog') },
      { id: 'stations' as TabKey, label: t('admin.manageStations', { defaultValue: 'Charging stations' }) },
      ...(canManageAdminAccess
        ? [
            {
              id: 'access' as TabKey,
              label: t('admin.accessControlTab', { defaultValue: 'Access control' }),
            },
          ]
        : []),
      ...(canViewAudit
        ? [
            {
              id: 'audit' as TabKey,
              label: t('admin.auditLogTab', { defaultValue: 'Audit log' }),
            },
          ]
        : []),
      { id: 'migration' as TabKey, label: t('admin.migrationTab', { defaultValue: 'Data migration' }) },
    ],
    [canManageAdminAccess, canReadUsers, canViewAudit, t]
  );

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
  };

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
          String(model.name || '').toLowerCase().includes(q) ||
          String(model.make || '').toLowerCase().includes(q);
        
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
      setActiveTab('dealers');
    }
  }, [activeTab, canReadUsers]);

  useEffect(() => {
    if (!canReadListings && activeTab === 'listings') {
      setActiveTab('dealers');
    }
  }, [activeTab, canReadListings]);

  useEffect(() => {
    if (!canManageAdminAccess && activeTab === 'access') {
      setActiveTab('dealers');
    }
  }, [activeTab, canManageAdminAccess]);

  useEffect(() => {
    if (!canViewAudit && activeTab === 'audit') {
      setActiveTab('dealers');
    }
  }, [activeTab, canViewAudit]);

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

      setAuditLoading(true);
      setAuditError(null);
      try {
        const logs = await listAdminAuditLogs(50);
        setAuditLogs(logs);
        setAuditLoaded(true);
      } catch (error) {
        console.error('Failed to load admin audit logs', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('admin.auditLogLoadFailed', {
                defaultValue: 'Failed to load the audit log.',
              });
        setAuditError(errorMessage);
      } finally {
        setAuditLoading(false);
      }
    },
    [auditLoaded, auditLoading, canViewAudit, t],
  );

  useEffect(() => {
    if (activeTab === 'audit' && canViewAudit) {
      void loadAuditLogs();
    }
  }, [activeTab, canViewAudit, loadAuditLogs]);

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
      closeAllModals();
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
    if (!user?.uid) return;

    setStationSubmitting(true);
    try {
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
      const updatedStations = await fetchChargingStations();
      setStations(updatedStations);
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
      const updatedStations = await fetchChargingStations();
      setStations(updatedStations);
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
      const updatedStations = await fetchChargingStations();
      setStations(updatedStations);
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
        const data = await fetchChargingStations();
        setStations(data);
      } catch (error) {
        console.error('Error loading charging stations:', error);
        setStationsError('Failed to load charging stations');
      } finally {
        setStationsLoading(false);
      }
    };

    loadStations();
  }, []);


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

  if (!user) {
    return null;
  }

  return (
    <>
    <div className="flex min-h-screen w-full">
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
      
      {/* Sidebar Layout */}
      <aside className="hidden w-64 flex-col border-r border-white/10 bg-white/5 backdrop-blur-xl md:flex shrink-0">
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-gray-cyan" />
            <h1 className="text-xl font-bold text-white">{t('admin.dashboard')}</h1>
          </div>
          <p className="mt-2 text-xs text-gray-400 break-all">{user.email}</p>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-gray-cyan text-white shadow-lg'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4 space-y-3 bg-black/20">
          <button
            onClick={() => setOfflineQueueOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <ClipboardList size={18} />
              <span>{t('admin.offlineQueueButton', { defaultValue: 'Offline queue' })}</span>
            </div>
            {offlineQueueCount > 0 && (
              <span className="rounded-full bg-gray-cyan px-2 py-0.5 text-xs font-semibold text-white">
                {offlineQueueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <Home size={18} className="text-gray-cyan" />
              <span>{t('admin.goToHomepage', { defaultValue: 'Platform Homepage' })}</span>
            </div>
            <ExternalLink size={14} className="text-gray-400" />
          </button>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/30 hover:text-red-300"
          >
            <LogOut size={18} />
            <span>{t('admin.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="md:hidden flex flex-col gap-4 border-b border-white/10 bg-white/5 backdrop-blur-xl p-4 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-gray-cyan" />
              <h1 className="text-lg font-bold text-white">{t('admin.dashboard')}</h1>
            </div>
            <div className="flex items-center gap-2">
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
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-none whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gray-cyan text-white shadow-md'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Panel */}
        <div className="flex-1 p-4 md:p-8 overflow-auto">
          {activeTab === 'dealers' && renderDealersPanel()}
          {activeTab === 'users' && renderUsersPanel()}
          {activeTab === 'models' && renderModelsPanel()}
          {activeTab === 'listings' && renderListingsPanel()}
          {activeTab === 'blog' && renderBlogPanel()}
          {activeTab === 'stations' && renderStationsPanel()}
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
                            {t('admin.createdOn', { defaultValue: 'Created on' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {formatDateTime(listingControlDetail.listing.createdAt) ??
                              t('admin.dateUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.updatedOn', { defaultValue: 'Updated on' })}
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
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadModelControlDetail(modelControlModel.id)}
                disabled={modelControlLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {modelControlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw size={16} />}
                <span>{t('admin.refreshModelControlCenter', { defaultValue: 'Refresh model data' })}</span>
              </button>
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
                            {t('admin.createdOn', { defaultValue: 'Created on' })}
                          </p>
                          <p className="mt-1 text-sm text-gray-200">
                            {formatDateTime(modelControlDetail.model.createdAt) ??
                              t('admin.dateUnavailable', { defaultValue: 'Unavailable' })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('admin.updatedOn', { defaultValue: 'Updated on' })}
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
