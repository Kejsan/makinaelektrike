import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  CheckSquare,
  Square,
  FileText,
  Home,
  ExternalLink,
  Search,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DataContext } from '../contexts/DataContext';
import { Dealer, DealerStatus, Model, BlogPost, ChargingStation } from '../types';
import DealerForm, { DealerFormValues } from '../components/admin/DealerForm';
import ModelForm, { ModelFormValues } from '../components/admin/ModelForm';
import BlogPostForm, { BlogPostFormValues } from '../components/admin/BlogPostForm';
import ChargingStationForm from '../components/admin/ChargingStationForm';
import BulkImportModal, { BulkImportEntity } from '../components/admin/BulkImportModal';
import BlogTextImportModal from '../components/admin/BlogTextImportModal';
import OfflineQueuePanel from '../components/admin/OfflineQueuePanel';
import AdminListingsTab from '../components/admin/AdminListingsTab';
import { MigrationTool } from '../components/admin/MigrationTool';
import {
  fetchChargingStations,
  createChargingStation,
  updateChargingStation,
  deleteChargingStation,
} from '../services/chargingStations';
import { associateDealerWithAccount } from '../services/api';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
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
import {
  modalCloseButtonClass,
  modalContainerClass,
  modalHeaderClass,
  modalOverlayClass,
} from '../constants/modalStyles';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const AdminModal: React.FC<ModalProps> = ({ title, onClose, children }) => {
  const { t } = useTranslation();

  return createPortal(
    <div className={modalOverlayClass}>
      <div
        className={`${modalContainerClass} max-w-3xl overflow-hidden bg-gray-900/95 flex max-h-[calc(100dvh-2rem)] flex-col sm:max-h-[calc(100dvh-3rem)]`}
      >
        <div className={`${modalHeaderClass} shrink-0 border-b border-white/10 px-6 py-4`}>
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className={modalCloseButtonClass} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
};

type FormState<T> = { mode: 'create' | 'edit'; entity?: T } | null;

type TabKey = 'dealers' | 'models' | 'listings' | 'blog' | 'stations' | 'migration';
type DealerFilterKey = 'active' | 'inactive' | 'pending' | 'deleted';

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

const AdminPage: React.FC = () => {
  const { logout, user, role } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [activationModalDealer, setActivationModalDealer] = useState<Dealer | null>(null);
  const [activationPassword, setActivationPassword] = useState('');
  const [activationEmail, setActivationEmail] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const {
    dealers,
    models,
    listings,
    getModelsForDealer,
    blogPosts,
    loading,
    loadError,
    dealerMutations,
    modelMutations,
    blogPostMutations,
    addDealer,
    updateDealer,
    deleteDealer,
    deactivateDealer,
    reactivateDealer,
    approveDealer,
    rejectDealer,
    addModel,
    updateModel,
    deleteModel,
    updateListing,
    deleteListing,
    linkModelToDealer,
    unlinkModelFromDealer,
    addBlogPost,
    updateBlogPost,
    deleteBlogPost,
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
    { id: string; type: 'approve' | 'reject' | 'deactivate' | 'reactivate' } | null
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

  // Search and Selection States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
      await Promise.all(selectedIds.map(id => {
        if (action === 'approve') return approveDealer(id);
        if (action === 'deactivate') return deactivateDealer(id);
        if (action === 'delete') return deleteDealer(id);
        if (action === 'reactivate') return reactivateDealer(id);
        return Promise.resolve();
      }));
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
        if (action === 'delete') return deleteModel(id);
        const model = models.find(m => m.id === id);
        if (!model) return Promise.resolve();
        
        if (action === 'toggleFeatured') {
          return updateModel(id, { isFeatured: !model.isFeatured });
        }
        if (action === 'toggleVisibility') {
          // Explicitly set based on current filter state if possible, or just toggle
          const targetVisibility = modelFilter === 'hidden' ? true : (modelFilter === 'visible' ? false : !model.isActive);
          return updateModel(id, { isActive: targetVisibility });
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
        if (action === 'delete') return deleteListing(id);
        if (action === 'approve') return updateListing(id, { status: 'active' });
        if (action === 'reject') return updateListing(id, { status: 'rejected' });
        if (action === 'hide') return updateListing(id, { status: 'inactive' });
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
        if (action === 'delete') return deleteBlogPost(id);
        if (action === 'publish' || action === 'draft') {
          return updateBlogPost(id, { status: action === 'publish' ? 'published' : 'draft' });
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
        if (action === 'delete') return deleteChargingStation(id);
        if (action === 'toggleActive' && station) {
          const targetVisibility = stationFilter === 'inactive' ? true : (stationFilter === 'active' ? false : !station.isActive);
          return updateChargingStation(id, {
            address: station.address,
            plugTypes: station.plugTypes,
            chargingSpeedKw: station.chargingSpeedKw,
            operator: station.operator || '',
            pricingDetails: station.pricingDetails || '',
            googleMapsLink: station.googleMapsLink || '',
            latitude: station.latitude ?? '',
            longitude: station.longitude ?? '',
            isActive: targetVisibility,
          }, user!.uid);
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
      { id: 'models' as TabKey, label: t('admin.manageModels') },
      { id: 'listings' as TabKey, label: t('admin.listingsTab', { defaultValue: 'Listings' }) },
      { id: 'blog' as TabKey, label: t('admin.manageBlog') },
      { id: 'stations' as TabKey, label: t('admin.manageStations', { defaultValue: 'Charging stations' }) },
      { id: 'migration' as TabKey, label: t('admin.migrationTab', { defaultValue: 'Data migration' }) },
    ],
    [t]
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

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('admin.dashboardMetaTitle'),
    description: t('admin.dashboardMetaDescription'),
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    url: `${BASE_URL}/admin/`,
  };

  const handleApproveDealer = async (dealerId: string) => {
    if (!isAdmin) {
      return;
    }

    setDealerAction({ id: dealerId, type: 'approve' });
    try {
      await approveDealer(dealerId);
    } catch (error) {
      console.error('Failed to approve dealer', error);
    } finally {
      setDealerAction(null);
    }
  };

  const handleActivateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activationModalDealer) return;

    if (activationPassword.length < 6) {
      setActivationError(t('admin.passwordTooShort', { defaultValue: 'Password must be at least 6 characters' }));
      return;
    }

    setIsActivating(true);
    setActivationError(null);

    let secondaryApp;
    try {
      const secondaryConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      };
      
      const appName = `Activation-${activationModalDealer.id}-${Date.now()}`;
      secondaryApp = initializeApp(secondaryConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        activationEmail,
        activationPassword
      );
      
      const newUser = userCredential.user;
      
      await associateDealerWithAccount(
        activationModalDealer.id,
        newUser.uid,
        activationEmail
      );
      
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      
      addToast(t('admin.activationSuccess', { defaultValue: 'Account activated successfully!' }), 'success');
      setActivationModalDealer(null);
      setActivationPassword('');
      setActivationEmail('');
    } catch (error: any) {
      console.error('Failed to activate dealer account:', error);
      let errorMsg = error.message || 'Failed to create account. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = t('admin.emailAlreadyInUse', { defaultValue: 'This email is already registered.' });
      }
      setActivationError(errorMsg);
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch(e) {}
      }
    } finally {
      setIsActivating(false);
    }
  };

  const handleRejectDealer = async (dealerId: string) => {
    if (!isAdmin) {
      return;
    }

    setDealerAction({ id: dealerId, type: 'reject' });
    try {
      await rejectDealer(dealerId);
    } catch (error) {
      console.error('Failed to reject dealer', error);
    } finally {
      setDealerAction(null);
    }
  };

  const handleDeactivateDealer = async (dealerId: string) => {
    if (!isAdmin) {
      return;
    }

    setDealerAction({ id: dealerId, type: 'deactivate' });
    try {
      await deactivateDealer(dealerId);
    } catch (error) {
      console.error('Failed to deactivate dealer', error);
    } finally {
      setDealerAction(null);
    }
  };

  const handleReactivateDealer = async (dealerId: string) => {
    if (!isAdmin) {
      return;
    }

    setDealerAction({ id: dealerId, type: 'reactivate' });
    try {
      await reactivateDealer(dealerId);
    } catch (error) {
      console.error('Failed to reactivate dealer', error);
    } finally {
      setDealerAction(null);
    }
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

      const syncModelsForDealer = async (dealerId: string, desiredIds: string[]) => {
        const currentIds = new Set(getModelsForDealer(dealerId).map(model => model.id));
        const desiredSet = new Set(desiredIds.filter(Boolean));

        const toAdd = desiredIds.filter(id => !currentIds.has(id));
        const toRemove = [...currentIds].filter((id): id is string => typeof id === 'string' && !desiredSet.has(id));

        for (const modelId of toAdd) {
          await linkModelToDealer(dealerId, modelId);
        }

        for (const modelId of toRemove) {
          await unlinkModelFromDealer(dealerId, modelId);
        }
      };

      if (dealerFormState?.mode === 'edit' && dealerFormState.entity) {
        const { id, ...rest } = normalizedRest;
        const dealerId = dealerFormState.entity.id;
        await updateDealer(dealerId, rest);

        if (imageFile) {
          const heroUrl = await uploadDealerHeroImage(dealerId, imageFile);
          await updateDealer(dealerId, { image_url: heroUrl });
        }

        if (galleryFiles.length > 0) {
          const uploadedGallery = await Promise.all(
            galleryFiles.map(file => uploadDealerGalleryImage(dealerId, file)),
          );
          const nextGallery = mergeGallery(baseGallery, uploadedGallery);
          await updateDealer(dealerId, { imageGallery: nextGallery });
        }

        await syncModelsForDealer(dealerId, modelIds);
      } else {
        const { id: _omit, ...rest } = normalizedRest;
        const createdDealer = await addDealer(rest);

        if (createdDealer?.id) {
          let nextGallery = baseGallery;

          if (imageFile) {
            const heroUrl = await uploadDealerHeroImage(createdDealer.id, imageFile);
            await updateDealer(createdDealer.id, { image_url: heroUrl });
          }

          if (galleryFiles.length > 0) {
            const uploadedGallery = await Promise.all(
              galleryFiles.map(file => uploadDealerGalleryImage(createdDealer.id, file)),
            );
            nextGallery = mergeGallery(nextGallery, uploadedGallery);
            await updateDealer(createdDealer.id, { imageGallery: nextGallery });
          }

          await syncModelsForDealer(createdDealer.id, modelIds);
        }
      }
      closeAllModals();
    } catch (error) {
      console.error(error);
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

      if (modelFormState?.mode === 'edit' && modelFormState.entity) {
        const { id, ...rest } = normalizedRest;
        const modelId = modelFormState.entity.id;
        await updateModel(modelId, rest);

        if (imageFile) {
          const heroUrl = await uploadModelHeroImage(modelId, imageFile);
          await updateModel(modelId, { image_url: heroUrl });
        }

        if (galleryFiles.length > 0) {
          const uploadedGallery = await Promise.all(
            galleryFiles.map(file => uploadModelGalleryImage(modelId, file)),
          );
          const nextGallery = mergeGallery(baseGallery, uploadedGallery);
          await updateModel(modelId, { imageGallery: nextGallery });
        }
      } else {
        const { id: _omit, ...rest } = normalizedRest;
        const createdModel = await addModel(rest);

        if (createdModel?.id) {
          let nextGallery = baseGallery;

          if (imageFile) {
            const heroUrl = await uploadModelHeroImage(createdModel.id, imageFile);
            await updateModel(createdModel.id, { image_url: heroUrl });
          }

          if (galleryFiles.length > 0) {
            const uploadedGallery = await Promise.all(
              galleryFiles.map(file => uploadModelGalleryImage(createdModel.id, file)),
            );
            nextGallery = mergeGallery(nextGallery, uploadedGallery);
            await updateModel(createdModel.id, { imageGallery: nextGallery });
          }
        }
      }
      closeAllModals();
    } catch (error) {
      console.error(error);
    } finally {
      setModelSubmitting(false);
    }
  };

  const handleBlogSubmit = async (values: BlogPostFormValues) => {
    setBlogSubmitting(true);
    try {
      if (blogFormState?.mode === 'edit' && blogFormState.entity) {
        const { id, ...rest } = values;
        await updateBlogPost(blogFormState.entity.id, rest);
      } else {
        const { id: _omit, ...rest } = values;
        await addBlogPost(rest);
      }
      closeAllModals();
    } catch (error) {
      console.error(error);
    } finally {
      setBlogSubmitting(false);
    }
  };

  const handleStationSubmit = async (values: ChargingStationFormValues) => {
    if (!user?.uid) return;

    setStationSubmitting(true);
    try {
      if (stationFormState?.mode === 'edit' && stationFormState.entity) {
        await updateChargingStation(stationFormState.entity.id, values, user.uid);
      } else {
        await createChargingStation(values, user.uid);
      }
      closeAllModals();
      // Refetch stations
      const updatedStations = await fetchChargingStations();
      setStations(updatedStations);
    } catch (error) {
      console.error('Failed to save charging station:', error);
    } finally {
      setStationSubmitting(false);
    }
  };

  const handleDeleteStation = async (stationId: string) => {
    try {
      await deleteChargingStation(stationId);
      // Refetch stations
      const updatedStations = await fetchChargingStations();
      setStations(updatedStations);
    } catch (error) {
      console.error('Failed to delete charging station:', error);
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
    const dealerUpdateLoading = dealerMutations.update.loading;
    const dealerDeleteLoading = dealerMutations.delete.loading;

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

                  const isProcessing = dealerUpdateLoading && dealerAction?.id === dealer.id;

                  const showEditButton = dealerFilter !== 'deleted';
                  const showDeleteButton = dealerFilter !== 'deleted';

                  const renderPrimaryAction = () => {
                    const isProcessing = dealerUpdateLoading && dealerAction?.id === dealer.id;
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
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
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
                            onClick={() => confirmAndDelete(() => deleteDealer(dealer.id))}
                            disabled={!isAdmin || dealerDeleteLoading}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={t('admin.delete')}
                          >
                            {dealerDeleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={14} />}
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
  const renderModelsPanel = () => {
    const modelUpdateLoading = modelMutations.update.loading;
    const modelDeleteLoading = modelMutations.delete.loading;
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
                      <button
                        onClick={() => updateModel(model.id, { isActive: model.isActive === false })}
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
                        onClick={() => confirmAndDelete(() => deleteModel(model.id))}
                        disabled={modelDeleteLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={t('admin.delete')}
                      >
                        {modelDeleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={14} />}
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
        <h2 className="text-xl font-semibold text-white">Manage Listings ({listings.length})</h2>
        <AdminListingsTab 
          listings={listings} 
          dealers={dealers} 
          onUpdateStatus={(id, status) => updateListing(id, { status })} 
          onDelete={deleteListing}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={toggleSelectAll}
          onBulkAction={handleBulkListingAction}
        />
      </div>
    );
  };

  const renderBlogPanel = () => {
    const blogUpdateLoading = blogPostMutations.update.loading;
    const blogDeleteLoading = blogPostMutations.delete.loading;
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
                        onClick={() => updateBlogPost(post.id, { status: post.status === 'published' ? 'draft' : 'published' })}
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
                        onClick={() => confirmAndDelete(() => deleteBlogPost(post.id))}
                        disabled={blogDeleteLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={t('admin.delete')}
                      >
                        {blogDeleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={14} />}
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
                          onClick={() => updateChargingStation(station.id, {
                            address: station.address,
                            plugTypes: station.plugTypes,
                            chargingSpeedKw: station.chargingSpeedKw,
                            operator: station.operator || '',
                            pricingDetails: station.pricingDetails || '',
                            googleMapsLink: station.googleMapsLink || '',
                            latitude: station.latitude ?? '',
                            longitude: station.longitude ?? '',
                            isActive: station.isActive === false,
                          }, user!.uid)}
                          className={`inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold transition ${
                            station.isActive === false 
                              ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' 
                              : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                          }`}
                        >
                          {station.isActive === false ? <Eye size={10} /> : <EyeOff size={10} />}
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
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-red-500/20 px-2 py-1 text-[10px] font-semibold text-red-200 transition hover:bg-red-500/30"
                        >
                          <Trash2 size={10} />
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
          {activeTab === 'models' && renderModelsPanel()}
          {activeTab === 'listings' && renderListingsPanel()}
          {activeTab === 'blog' && renderBlogPanel()}
          {activeTab === 'stations' && renderStationsPanel()}
          {activeTab === 'migration' && <div className="mt-6"><MigrationTool /></div>}
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
          <ModelForm
            initialValues={modelFormState.entity}
            onSubmit={handleModelSubmit}
            onCancel={closeAllModals}
            isSubmitting={modelSubmitting}
            isAdmin={isAdmin}
          />
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
          <BulkImportModal entity={bulkEntity} onClose={() => setBulkEntity(null)} />
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
