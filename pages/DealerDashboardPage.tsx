import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Loader2, 
  Plus, 
  Save, 
  Trash2, 
  Upload, 
  MessageSquare, 
  ExternalLink, 
  PlusCircle, 
  LayoutDashboard,
  Clock,
  User,
  FilePlus2,
  Images,
  ListChecks,
  ShieldCheck,
  UserPlus,
  Users,
  Copy,
  Megaphone,
  CreditCard
} from 'lucide-react';
import { DataContext } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  uploadDealerGalleryImage,
  uploadDealerHeroImage,
  uploadModelGalleryImage,
  uploadModelHeroImage,
} from '../services/storage';
import {
  createDealerStaffInvite,
  listDealerStaff,
  removeDealerStaffMember,
  revokeDealerStaffInvite,
  type DealerStaffMember,
  type DealerTeamCapacity,
} from '../services/dealerStaff';
import {
  cancelDealerPlacementRequest,
  createDealerPlacementRequest,
  listDealerPlacements,
} from '../services/dealerPlacements';
import type {
  AccessInvite,
  Dealer,
  DealerServiceCapability,
  DealerPlacementRequestFormValues,
  DealerStaffRole,
  Model,
  PlacementZone,
  PromotionalCampaign,
  SponsorshipOrder,
  SponsorshipProduct,
} from '../types';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import { DEALERSHIP_PLACEHOLDER_IMAGE, MODEL_PLACEHOLDER_IMAGE } from '../constants/media';
import { DEALER_SERVICE_CAPABILITY_OPTIONS } from '../constants/dealerCapabilities';
import Link from '../components/LocalizedLink';
import DealerPlacementRequestForm, {
  type DealerPlacementEntityOption,
} from '../components/dealer/DealerPlacementRequestForm';
import { isPromotionalCampaignPubliclyResolvable } from '../utils/placements';

interface ProfileFormState {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  notes: string;
  description: string;
  brands: string;
  languages: string;
  serviceCapabilities: DealerServiceCapability[];
  serviceNotes: string;
  certificationDetails: string;
  typeOfCars: string;
  priceRange: string;
  facebook: string;
  instagram: string;
  twitter: string;
  youtube: string;
  imageUrl: string;
}

interface NewModelFormState {
  brand: string;
  model_name: string;
  body_type: string;
  range_wltp: string;
  power_kw: string;
  notes: string;
  image_url: string;
}

interface GalleryDraft {
  file: File;
  preview: string;
}

const defaultProfileState: ProfileFormState = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  city: '',
  notes: '',
  description: '',
  brands: '',
  languages: '',
  serviceCapabilities: [],
  serviceNotes: '',
  certificationDetails: '',
  typeOfCars: '',
  priceRange: '',
  facebook: '',
  instagram: '',
  twitter: '',
  youtube: '',
  imageUrl: '',
};

const defaultModelState: NewModelFormState = {
  brand: '',
  model_name: '',
  body_type: '',
  range_wltp: '',
  power_kw: '',
  notes: '',
  image_url: '',
};

const formatList = (items?: string[]) => (items && items.length ? items.join(', ') : '');
const parseList = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
const parseNumericField = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
};


const DealerDashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, profile, dealerPlan, dealerEntitlements } = useAuth();
  const {
    dealers,
    models,
    getModelsForDealer,
    updateDealer,
    updateModel,
    addModel,
    linkModelToDealer,
    unlinkModelFromDealer,
    dealerMutations,
    modelMutations,
    enquiries,
    listings,
    loading: dataLoading,
  } = useContext(DataContext);
  const { addToast } = useToast();

  const [profileState, setProfileState] = useState<ProfileFormState>(defaultProfileState);
  const [newModelState, setNewModelState] = useState<NewModelFormState>(defaultModelState);
  const [newModelImageFile, setNewModelImageFile] = useState<File | null>(null);
  const [newModelImagePreview, setNewModelImagePreview] = useState('');
  const [newModelPreviewFromFile, setNewModelPreviewFromFile] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [creatingModel, setCreatingModel] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryRemoving, setGalleryRemoving] = useState<string | null>(null);
  const [newModelGalleryDrafts, setNewModelGalleryDrafts] = useState<GalleryDraft[]>([]);
  const newModelGalleryDraftsRef = useRef<GalleryDraft[]>([]);
  const [teamInviteEmail, setTeamInviteEmail] = useState('');
  const [teamInviteRole, setTeamInviteRole] = useState<Extract<DealerStaffRole, 'manager' | 'editor'>>('manager');
  const [teamMembers, setTeamMembers] = useState<DealerStaffMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<AccessInvite[]>([]);
  const [teamCapacity, setTeamCapacity] = useState<DealerTeamCapacity | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamInviteSubmitting, setTeamInviteSubmitting] = useState(false);
  const [teamInviteRevokingId, setTeamInviteRevokingId] = useState<string | null>(null);
  const [teamMemberRemovingId, setTeamMemberRemovingId] = useState<string | null>(null);
  const [placementProducts, setPlacementProducts] = useState<SponsorshipProduct[]>([]);
  const [placementZones, setPlacementZones] = useState<PlacementZone[]>([]);
  const [placementOrders, setPlacementOrders] = useState<SponsorshipOrder[]>([]);
  const [placementCampaigns, setPlacementCampaigns] = useState<PromotionalCampaign[]>([]);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [placementsLoaded, setPlacementsLoaded] = useState(false);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [placementRequestSubmitting, setPlacementRequestSubmitting] = useState(false);
  const [placementOrderCancellingId, setPlacementOrderCancellingId] = useState<string | null>(null);

  const dealer: Dealer | null = useMemo(() => {
    if (!user) {
      return null;
    }
    const dealerStaffDealerId =
      profile?.accountType === 'dealer_staff' && typeof profile.dealerId === 'string'
        ? profile.dealerId
        : null;
    return (
      dealers.find(
        entry =>
          entry.id === user.uid ||
          entry.ownerUid === user.uid ||
          (dealerStaffDealerId ? entry.id === dealerStaffDealerId : false),
      ) ?? null
    );
  }, [dealers, profile, user]);

  const assignedModels: Model[] = useMemo(() => {
    if (!dealer) {
      return [];
    }
    return getModelsForDealer(dealer.id);
  }, [dealer, getModelsForDealer]);

  const availableModels: Model[] = useMemo(() => {
    if (!assignedModels.length) {
      return models;
    }
    const assignedIds = new Set(assignedModels.map(model => model.id));
    return models.filter(model => !assignedIds.has(model.id));
  }, [assignedModels, models]);

  const dealerEnquiries = useMemo(
    () => (dealer ? enquiries.filter(enquiry => enquiry.dealerId === dealer.id) : []),
    [dealer, enquiries],
  );

  const dealerListings = useMemo(
    () => (dealer ? listings.filter(listing => listing.dealerId === dealer.id && listing.status !== 'deleted') : []),
    [dealer, listings],
  );

  const activeDealerListings = useMemo(
    () => dealerListings.filter(listing => listing.status === 'active' || listing.status === 'approved').length,
    [dealerListings],
  );

  const pendingDealerListings = useMemo(
    () => dealerListings.filter(listing => listing.status === 'pending').length,
    [dealerListings],
  );

  const profileCompletion = useMemo(() => {
    const fields = [
      profileState.name,
      profileState.contactName,
      profileState.phone || profileState.email,
      profileState.city,
      profileState.address,
      profileState.description,
      profileState.brands,
      profileState.languages,
      profileState.serviceCapabilities.length > 0 ? 'services' : '',
      profileState.typeOfCars,
      profileState.imageUrl,
    ];
    const completed = fields.filter(value => value.trim().length > 0).length;
    return Math.round((completed / fields.length) * 100);
  }, [profileState]);

  const enquiryDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language || 'sq', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [i18n.language],
  );

  useEffect(() => {
    if (!dealer) {
      setProfileState(defaultProfileState);
      return;
    }

    setProfileState({
      name: dealer.name ?? dealer.companyName ?? '',
      contactName: dealer.contactName ?? '',
      phone: dealer.contact_phone ?? dealer.phone ?? '',
      email: dealer.contact_email ?? dealer.email ?? '',
      website: dealer.website ?? '',
      address: dealer.address ?? dealer.location ?? '',
      city: dealer.city ?? '',
      notes: dealer.notes ?? '',
      description: dealer.description ?? '',
      brands: formatList(dealer.brands),
      languages: formatList(dealer.languages),
      serviceCapabilities: dealer.serviceCapabilities ?? [],
      serviceNotes: dealer.serviceNotes ?? '',
      certificationDetails: dealer.certificationDetails ?? '',
      typeOfCars: dealer.typeOfCars ?? '',
      priceRange: dealer.priceRange ?? '',
      facebook: dealer.social_links?.facebook ?? '',
      instagram: dealer.social_links?.instagram ?? '',
      twitter: dealer.social_links?.twitter ?? '',
      youtube: dealer.social_links?.youtube ?? '',
      imageUrl: dealer.logo_url ?? dealer.image_url ?? '',
    });
  }, [dealer]);

  useEffect(() => {
    newModelGalleryDraftsRef.current = newModelGalleryDrafts;
  }, [newModelGalleryDrafts]);

  useEffect(
    () => () => {
      newModelGalleryDraftsRef.current.forEach(draft => URL.revokeObjectURL(draft.preview));
    },
    [],
  );

  useEffect(() => {
    if (!availableModels.find(model => model.id === selectedModelId)) {
      setSelectedModelId('');
    }
  }, [availableModels, selectedModelId]);

  useEffect(() => {
    if (newModelImageFile) {
      return;
    }
    setNewModelImagePreview(newModelState.image_url.trim());
    setNewModelPreviewFromFile(false);
  }, [newModelState.image_url, newModelImageFile]);

  useEffect(
    () => () => {
      if (newModelPreviewFromFile && newModelImagePreview) {
        URL.revokeObjectURL(newModelImagePreview);
      }
    },
    [newModelImagePreview, newModelPreviewFromFile],
  );

  const metaTitle = t('dealerDashboardPage.metaTitle', { defaultValue: 'Dealer dashboard | Makina Elektrike' });
  const metaDescription = t('dealerDashboardPage.metaDescription', {
    defaultValue: 'Manage your public dealer profile, model line-up, and imagery inside Makina Elektrike.',
  });
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: metaTitle,
    description: metaDescription,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    url: `${BASE_URL}/dealer/dashboard/`,
  };

  const handleProfileChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setProfileState(prev => ({ ...prev, [name]: value }));
  };

  const handleServiceCapabilityChange = (capability: DealerServiceCapability, checked: boolean) => {
    setProfileState(prev => {
      const current = new Set(prev.serviceCapabilities);
      if (checked) {
        current.add(capability);
      } else {
        current.delete(capability);
      }

      return {
        ...prev,
        serviceCapabilities: Array.from(current),
      };
    });
  };

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dealer) {
      return;
    }

    if (!profileState.name.trim()) {
      addToast(
        t('dealerDashboardPage.toasts.missingName', {
          defaultValue: 'Please provide a dealership name.',
        }),
        'error',
      );
      return;
    }

    if (!profileState.address.trim() || !profileState.city.trim()) {
      addToast(
        t('dealerDashboardPage.toasts.addressCityRequired', {
          defaultValue: 'Address and city are required to publish your profile.',
        }),
        'error',
      );
      return;
    }

    setSavingProfile(true);
    try {
      const socialLinks = {
        facebook: profileState.facebook.trim(),
        instagram: profileState.instagram.trim(),
        twitter: profileState.twitter.trim(),
        youtube: profileState.youtube.trim(),
      };

      const sanitizedSocialLinks = Object.fromEntries(
        Object.entries(socialLinks).filter(([, value]) => Boolean(value)),
      );

      await updateDealer(dealer.id, {
        name: profileState.name.trim(),
        companyName: profileState.name.trim(),
        contactName: profileState.contactName.trim() || undefined,
        address: profileState.address.trim(),
        city: profileState.city.trim(),
        phone: profileState.phone.trim() || undefined,
        email: profileState.email.trim() || undefined,
        contact_phone: profileState.phone.trim() || undefined,
        contact_email: profileState.email.trim() || undefined,
        location:
          [profileState.address.trim(), profileState.city.trim()].filter(Boolean).join(', ') || undefined,
        website: profileState.website.trim() || undefined,
        notes: profileState.notes.trim() || undefined,
        description: profileState.description.trim() || undefined,
        brands: parseList(profileState.brands),
        languages: parseList(profileState.languages),
        serviceCapabilities: profileState.serviceCapabilities,
        serviceNotes: profileState.serviceNotes.trim() || undefined,
        certificationDetails: profileState.certificationDetails.trim() || undefined,
        typeOfCars:
          profileState.typeOfCars.trim() ||
          dealer.typeOfCars ||
          t('dealerDashboardPage.fields.vehicleFocusDefault', { defaultValue: 'Electric vehicles' }),
        priceRange: profileState.priceRange.trim() || undefined,
        image_url: profileState.imageUrl.trim() || undefined,
        logo_url: profileState.imageUrl.trim() || undefined,
        social_links: Object.keys(sanitizedSocialLinks).length
          ? sanitizedSocialLinks
          : undefined,
        ownerUid: dealer.ownerUid ?? user?.uid,
      });
      addToast(
        t('dealerDashboardPage.toasts.profileSaved', {
          defaultValue: 'Dealer profile saved successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to update dealer profile', error);
      addToast(
        t('dealerDashboardPage.toasts.profileSaveFailed', {
          defaultValue: 'Dealer profile could not be saved. Please try again.',
        }),
        'error',
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!dealer) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingImage(true);
    try {
      const imageUrl = await uploadDealerHeroImage(dealer.id, file);
      setProfileState(prev => ({ ...prev, imageUrl }));
      const existingGallery = (dealer.imageGallery ?? []).filter(Boolean);
      const nextGallery = Array.from(new Set([imageUrl, ...existingGallery])).slice(0, 3);
      await updateDealer(dealer.id, {
        image_url: imageUrl,
        logo_url: imageUrl,
        imageGallery: nextGallery,
      });
    } catch (error) {
      console.error('Failed to upload dealer image', error);
      addToast(
        t('dealerDashboardPage.toasts.imageUploadFailed', {
          defaultValue: 'Image upload failed. Please try again.',
        }),
        'error',
      );
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleImageRemove = async () => {
    if (!dealer) {
      return;
    }

    setProfileState(prev => ({ ...prev, imageUrl: '' }));
    try {
      const sanitizedGallery = (dealer.imageGallery ?? []).filter(Boolean);
      const primaryImage = dealer.logo_url ?? dealer.image_url ?? '';
      const updatedGallery = sanitizedGallery.filter(url => url !== primaryImage);
      await updateDealer(dealer.id, { image_url: '', logo_url: '', imageGallery: updatedGallery });
    } catch (error) {
      console.error('Failed to remove dealer image', error);
    }
  };

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!dealer) {
      return;
    }

    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    const existingGallery = (dealer.imageGallery ?? []).filter(Boolean);
    const existingCount = existingGallery.length;
    const availableSlots = Math.max(0, 3 - existingCount);
    if (availableSlots <= 0) {
      addToast(
        t('dealerDashboardPage.toasts.galleryLimitReached', {
          defaultValue: 'Gallery limit reached. Remove an image before uploading a new one.',
        }),
        'warning',
      );
      event.target.value = '';
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);
    setGalleryUploading(true);
    try {
      const uploaded = await Promise.all(
        selectedFiles.map((file: File) => uploadDealerGalleryImage(dealer.id, file)),
      );
      const nextGallery = Array.from(new Set([...existingGallery, ...uploaded])).slice(0, 3);
      await updateDealer(dealer.id, { imageGallery: nextGallery });
    } catch (error) {
      console.error('Failed to upload gallery image', error);
      addToast(
        t('dealerDashboardPage.toasts.galleryUploadFailed', {
          defaultValue: 'Gallery upload failed. Please try again.',
        }),
        'error',
      );
    } finally {
      setGalleryUploading(false);
      event.target.value = '';
    }
  };

  const handleGalleryImageRemove = async (imageUrl: string) => {
    if (!dealer) {
      return;
    }

    setGalleryRemoving(imageUrl);
    try {
      const existingGallery = (dealer.imageGallery ?? []).filter(Boolean);
      const nextGallery = existingGallery.filter(url => url !== imageUrl);
      await updateDealer(dealer.id, { imageGallery: nextGallery });
    } catch (error) {
      console.error('Failed to remove gallery image', error);
      addToast(
        t('dealerDashboardPage.toasts.galleryRemoveFailed', {
          defaultValue: 'Could not remove that gallery image.',
        }),
        'error',
      );
    } finally {
      setGalleryRemoving(null);
    }
  };

  const handleAttachModel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dealer) {
      return;
    }

    if (!selectedModelId) {
      addToast(
        t('dealerDashboardPage.toasts.selectModelFirst', {
          defaultValue: 'Select a model before attaching it to your profile.',
        }),
        'error',
      );
      return;
    }

    try {
      await linkModelToDealer(dealer.id, selectedModelId);
      setSelectedModelId('');
    } catch (error) {
      console.error('Failed to attach model', error);
    }
  };

  const handleDetachModel = async (modelId: string) => {
    if (!dealer) {
      return;
    }
    try {
      await unlinkModelFromDealer(dealer.id, modelId);
    } catch (error) {
      console.error('Failed to detach model', error);
    }
  };

  const handleNewModelChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setNewModelState(prev => ({ ...prev, [name]: value }));
  };

  const handleNewModelImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (newModelPreviewFromFile && newModelImagePreview) {
      URL.revokeObjectURL(newModelImagePreview);
    }

    const nextPreview = URL.createObjectURL(file);
    setNewModelImageFile(file);
    setNewModelImagePreview(nextPreview);
    setNewModelPreviewFromFile(true);
  };

  const handleNewModelImageClear = () => {
    if (newModelPreviewFromFile && newModelImagePreview) {
      URL.revokeObjectURL(newModelImagePreview);
    }

    setNewModelImageFile(null);
    const trimmedUrl = newModelState.image_url.trim();
    setNewModelImagePreview(trimmedUrl);
    setNewModelPreviewFromFile(false);
  };

  const handleNewModelGalleryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    const availableSlots = Math.max(0, 3 - newModelGalleryDrafts.length);
    if (availableSlots <= 0) {
      event.target.value = '';
      addToast(
        t('dealerDashboardPage.toasts.modelGalleryLimitReached', {
          defaultValue: 'Gallery limit reached for this model. Remove an image before adding another.',
        }),
        'warning',
      );
      return;
    }

    const selected = files.slice(0, availableSlots);
    const drafts = selected.map((file: File) => ({ file, preview: URL.createObjectURL(file) }));
    setNewModelGalleryDrafts(prev => [...prev, ...drafts]);
    event.target.value = '';
  };

  const handleNewModelGalleryRemove = (index: number) => {
    setNewModelGalleryDrafts(prev => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return next;
    });
  };

  const resetNewModelGalleryDrafts = () => {
    setNewModelGalleryDrafts(prev => {
      prev.forEach(draft => URL.revokeObjectURL(draft.preview));
      return [];
    });
  };

  const handleCreateModel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dealer) {
      return;
    }

    if (!newModelState.brand.trim() || !newModelState.model_name.trim()) {
      addToast(
        t('dealerDashboardPage.toasts.missingBrandModel', {
          defaultValue: 'Brand and model name are required.',
        }),
        'error',
      );
      return;
    }

    setCreatingModel(true);
    const selectedFile = newModelImageFile;
    const galleryFiles = newModelGalleryDrafts.map(draft => draft.file);
    try {
      const payload = {
        brand: newModelState.brand.trim(),
        model_name: newModelState.model_name.trim(),
        ownerDealerId: dealer.id,
        createdBy: user?.uid ?? dealer.ownerUid ?? dealer.id,
        body_type: newModelState.body_type.trim() || undefined,
        range_wltp: parseNumericField(newModelState.range_wltp),
        power_kw: parseNumericField(newModelState.power_kw),
        notes: newModelState.notes.trim() || undefined,
        image_url: newModelState.image_url.trim() || undefined,
      } satisfies Omit<Model, 'id'>;

      const createdModel = await addModel(payload);
      await linkModelToDealer(dealer.id, createdModel.id);
      if (selectedFile) {
        const imageUrl = await uploadModelHeroImage(createdModel.id, selectedFile);
        await updateModel(createdModel.id, { image_url: imageUrl });
      }
      if (galleryFiles.length > 0) {
        const uploadedGallery = await Promise.all(
          galleryFiles.map(file => uploadModelGalleryImage(createdModel.id, file)),
        );
        const limitedGallery = Array.from(new Set(uploadedGallery)).slice(0, 3);
        await updateModel(createdModel.id, { imageGallery: limitedGallery });
      }
      setNewModelState(defaultModelState);
      handleNewModelImageClear();
      resetNewModelGalleryDrafts();
      addToast(
        t('dealerDashboardPage.toasts.modelCreated', {
          defaultValue: 'Model created and attached successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to create and attach model', error);
      addToast(
        t('dealerDashboardPage.toasts.modelCreateFailed', {
          defaultValue: 'Model could not be created. Please try again.',
        }),
        'error',
      );
    } finally {
      setCreatingModel(false);
    }
  };

  const dealerStaffRole =
    profile?.accountType === 'dealer_staff' && typeof profile.dealerStaffRole === 'string'
      ? profile.dealerStaffRole
      : null;
  const canViewDealerTeam = Boolean(
    dealer &&
      (
        profile?.accountType !== 'dealer_staff' ||
        dealerStaffRole === 'owner' ||
        dealerStaffRole === 'manager' ||
        dealerStaffRole === 'editor'
      ),
  );
  const canManageDealerTeam = Boolean(
    dealer &&
      (
        profile?.accountType !== 'dealer_staff' ||
        dealerStaffRole === 'owner' ||
        dealerStaffRole === 'manager'
      ),
  );
  const canViewDealerPromotions = canManageDealerTeam;
  const canManageDealerPromotions = canManageDealerTeam;
  const dealerId = dealer?.id ?? null;

  useEffect(() => {
    setTeamMembers([]);
    setTeamInvites([]);
    setTeamCapacity(null);
    setTeamLoading(false);
    setTeamLoaded(false);
    setTeamError(null);
  }, [dealerId]);

  useEffect(() => {
    if (!dealerId || !canViewDealerTeam || teamLoaded) {
      return;
    }

    let cancelled = false;
    setTeamLoading(true);
    setTeamError(null);

    void listDealerStaff(dealerId)
      .then(result => {
        if (cancelled) {
          return;
        }
        setTeamMembers(result.staffMembers);
        setTeamInvites(result.invites);
        setTeamCapacity(result.capacity);
        setTeamLoaded(true);
      })
      .catch(error => {
        if (cancelled) {
          return;
        }
        console.error('Failed to load dealer team access', error);
        setTeamError(
          error instanceof Error
            ? error.message
            : 'Dealer team access could not be loaded.',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setTeamLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canViewDealerTeam, dealerId, teamLoaded]);

  useEffect(() => {
    setPlacementProducts([]);
    setPlacementZones([]);
    setPlacementOrders([]);
    setPlacementCampaigns([]);
    setPlacementsLoading(false);
    setPlacementsLoaded(false);
    setPlacementsError(null);
  }, [dealerId]);

  useEffect(() => {
    if (!dealerId || !canViewDealerPromotions || placementsLoaded) {
      return;
    }

    let cancelled = false;
    setPlacementsLoading(true);
    setPlacementsError(null);

    void listDealerPlacements(dealerId)
      .then(result => {
        if (cancelled) {
          return;
        }

        setPlacementProducts(result.products);
        setPlacementZones(result.zones);
        setPlacementOrders(result.orders);
        setPlacementCampaigns(result.campaigns);
        setPlacementsLoaded(true);
      })
      .catch(error => {
        if (cancelled) {
          return;
        }
        console.error('Failed to load dealer placements', error);
        setPlacementsError(
          error instanceof Error
            ? error.message
            : 'Dealer placements could not be loaded.',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setPlacementsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canViewDealerPromotions, dealerId, placementsLoaded]);

  const handleCreateTeamInvite = async () => {
    if (!dealer || !canManageDealerTeam) {
      return;
    }

    const email = teamInviteEmail.trim();
    if (!email) {
      setTeamError(
        t('dealerDashboardPage.teamInviteEmailRequired', {
          defaultValue: 'Enter an email address to invite a team member.',
        }),
      );
      return;
    }

    setTeamInviteSubmitting(true);
    setTeamError(null);
    try {
      const result = await createDealerStaffInvite({
        dealerId: dealer.id,
        email,
        dealerStaffRole: teamInviteRole,
      });
      setTeamInvites(prev => [result.invite, ...prev.filter(invite => invite.id !== result.invite.id)]);
      setTeamCapacity(result.capacity);
      setTeamInviteEmail('');
      setTeamInviteRole('manager');
      addToast(
        t('dealerDashboardPage.teamInviteCreated', {
          defaultValue: 'Team invite created successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to create dealer staff invite', error);
      const message =
        error instanceof Error
          ? error.message
          : t('dealerDashboardPage.teamInviteCreateFailed', {
              defaultValue: 'The dealer team invite could not be created.',
            });
      setTeamError(message);
      addToast(message, 'error');
    } finally {
      setTeamInviteSubmitting(false);
    }
  };

  const handleRevokeTeamInvite = async (inviteId: string) => {
    if (!dealer || !canManageDealerTeam) {
      return;
    }

    setTeamInviteRevokingId(inviteId);
    setTeamError(null);
    try {
      const invite = await revokeDealerStaffInvite({
        dealerId: dealer.id,
        inviteId,
      });
      setTeamInvites(prev => prev.map(entry => (entry.id === invite.id ? invite : entry)));
      setTeamLoaded(false);
      addToast(
        t('dealerDashboardPage.teamInviteRevoked', {
          defaultValue: 'Team invite revoked.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to revoke dealer staff invite', error);
      const message =
        error instanceof Error
          ? error.message
          : t('dealerDashboardPage.teamInviteRevokeFailed', {
              defaultValue: 'The dealer team invite could not be revoked.',
            });
      setTeamError(message);
      addToast(message, 'error');
    } finally {
      setTeamInviteRevokingId(null);
    }
  };

  const handleRemoveTeamMember = async (userUid: string) => {
    if (!dealer || !canManageDealerTeam) {
      return;
    }

    setTeamMemberRemovingId(userUid);
    setTeamError(null);
    try {
      await removeDealerStaffMember({
        dealerId: dealer.id,
        userUid,
      });
      setTeamMembers(prev => prev.filter(member => member.uid !== userUid));
      setTeamLoaded(false);
      addToast(
        t('dealerDashboardPage.teamMemberRemoved', {
          defaultValue: 'Team member removed.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to remove dealer staff member', error);
      const message =
        error instanceof Error
          ? error.message
          : t('dealerDashboardPage.teamMemberRemoveFailed', {
              defaultValue: 'The team member could not be removed.',
            });
      setTeamError(message);
      addToast(message, 'error');
    } finally {
      setTeamMemberRemovingId(null);
    }
  };

  const handleCopyTeamInviteLink = async (invite: AccessInvite) => {
    if (!invite.inviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      addToast(
        t('dealerDashboardPage.teamInviteCopied', {
          defaultValue: 'Invite link copied.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to copy dealer team invite link', error);
      addToast(
        t('dealerDashboardPage.teamInviteCopyFailed', {
          defaultValue: 'The invite link could not be copied.',
        }),
        'error',
      );
    }
  };

  const handleCreatePlacementRequest = async (values: DealerPlacementRequestFormValues) => {
    if (!dealerId || !canManageDealerPromotions) {
      return;
    }

    setPlacementRequestSubmitting(true);
    setPlacementsError(null);
    try {
      const order = await createDealerPlacementRequest({
        dealerId,
        values,
      });
      setPlacementOrders(prev => [order, ...prev.filter(entry => entry.id !== order.id)]);
      addToast(
        t('dealerDashboardPage.promoRequestCreated', {
          defaultValue: 'Promotion request submitted successfully.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to create dealer placement request', error);
      const message =
        error instanceof Error
          ? error.message
          : t('dealerDashboardPage.promoRequestCreateFailed', {
              defaultValue: 'The promotion request could not be submitted.',
            });
      setPlacementsError(message);
      addToast(message, 'error');
    } finally {
      setPlacementRequestSubmitting(false);
    }
  };

  const handleCancelPlacementOrder = async (orderId: string) => {
    if (!dealerId || !canManageDealerPromotions) {
      return;
    }

    setPlacementOrderCancellingId(orderId);
    setPlacementsError(null);
    try {
      const updatedOrder = await cancelDealerPlacementRequest({
        dealerId,
        orderId,
      });
      setPlacementOrders(prev =>
        prev.map(order => (order.id === updatedOrder.id ? updatedOrder : order)),
      );
      addToast(
        t('dealerDashboardPage.promoRequestCancelled', {
          defaultValue: 'Promotion request cancelled.',
        }),
        'success',
      );
    } catch (error) {
      console.error('Failed to cancel dealer placement request', error);
      const message =
        error instanceof Error
          ? error.message
          : t('dealerDashboardPage.promoRequestCancelFailed', {
              defaultValue: 'The promotion request could not be cancelled.',
            });
      setPlacementsError(message);
      addToast(message, 'error');
    } finally {
      setPlacementOrderCancellingId(null);
    }
  };

  if (!dealer) {
    if (dataLoading) {
      return (
        <div className="py-16">
          <div className="max-w-3xl mx-auto px-4 text-center text-white">
            <p>
              {t('dealerDashboardPage.loadingProfile', {
                defaultValue: 'Loading your dealer profile…',
              })}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="py-16">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <p>
            {t('dealerDashboardPage.profileNotFound', {
              defaultValue: 'Your dealer profile could not be found. Please contact support.',
            })}
          </p>
        </div>
      </div>
    );
  }

  const isApprovedDealer = dealer.status === 'approved' && dealer.isActive !== false;
  const isUpdatingDealer = savingProfile || dealerMutations.update.loading || uploadingImage;
  const isCreatingModel = creatingModel || modelMutations.create.loading;
  const newModelGalleryLimit = 3;
  const newModelGalleryUploadDisabled = newModelGalleryDrafts.length >= newModelGalleryLimit;
  const dealerGallery = (dealer.imageGallery ?? []).filter(Boolean);
  const dashboardStats = [
    {
      label: t('dealerDashboardPage.stats.listings', { defaultValue: 'Listings' }),
      value: dealerListings.length.toLocaleString(i18n.language || 'sq'),
      helper: t('dealerDashboardPage.stats.listingsHelper', {
        active: activeDealerListings,
        pending: pendingDealerListings,
        defaultValue: '{{active}} active, {{pending}} pending review',
      }),
    },
    {
      label: t('dealerDashboardPage.stats.models', { defaultValue: 'Models represented' }),
      value: assignedModels.length.toLocaleString(i18n.language || 'sq'),
      helper: t('dealerDashboardPage.stats.modelsHelper', {
        available: availableModels.length,
        defaultValue: '{{available}} available to attach',
      }),
    },
    {
      label: t('dealerDashboardPage.stats.profile', { defaultValue: 'Profile completion' }),
      value: `${profileCompletion}%`,
      helper: t('dealerDashboardPage.stats.profileHelper', {
        defaultValue: 'Complete profiles earn more buyer trust',
      }),
    },
  ];

  const placementEntityOptionsByType = useMemo<
    Record<'dealer' | 'listing' | 'model', DealerPlacementEntityOption[]>
  >(
    () => ({
      dealer: [
        {
          id: dealer.id,
          type: 'dealer',
          label: dealer.name || dealer.companyName || dealer.id,
          description: dealer.city ?? null,
        },
      ],
      listing: dealerListings.map(listing => ({
        id: listing.id,
        type: 'listing',
        label: listing.title,
        description: `${listing.make} ${listing.model} ${listing.year}`,
      })),
      model: assignedModels.map(model => ({
        id: model.id,
        type: 'model',
        label: `${model.brand} ${model.model_name}`,
        description: model.body_type ?? null,
      })),
    }),
    [assignedModels, dealer, dealerListings],
  );

  const placementProductById = useMemo(
    () =>
      placementProducts.reduce<Record<string, SponsorshipProduct>>((acc, product) => {
        acc[product.id] = product;
        return acc;
      }, {}),
    [placementProducts],
  );
  const placementZoneById = useMemo(
    () =>
      placementZones.reduce<Record<string, PlacementZone>>((acc, zone) => {
        acc[zone.id] = zone;
        return acc;
      }, {}),
    [placementZones],
  );
  const placementCampaignById = useMemo(
    () =>
      placementCampaigns.reduce<Record<string, PromotionalCampaign>>((acc, campaign) => {
        acc[campaign.id] = campaign;
        return acc;
      }, {}),
    [placementCampaigns],
  );
  const quotedPlacementOrders = useMemo(
    () => placementOrders.filter(order => order.status === 'quoted').length,
    [placementOrders],
  );
  const livePlacementOrders = useMemo(
    () =>
      placementOrders.filter(
        order =>
          Boolean(order.campaignId) &&
          isPromotionalCampaignPubliclyResolvable(
            order.campaignId ? placementCampaignById[order.campaignId] : null,
          ),
      ).length,
    [placementCampaignById, placementOrders],
  );
  const pendingPaymentOrders = useMemo(
    () =>
      placementOrders.filter(
        order =>
          order.status !== 'cancelled' &&
          order.status !== 'expired' &&
          order.paymentStatus !== 'paid' &&
          order.paymentStatus !== 'waived',
      ).length,
    [placementOrders],
  );

  return (
    <div className="py-16">
      <SEO
        title={metaTitle}
        description={metaDescription}
        keywords={[
          'paneli i dilerëve',
          'menaxhim modeli',
          'makina elektrike',
          'Makina Elektrike dashboard',
        ]}
        canonical={`${BASE_URL}/dealer/dashboard/`}
        robots="noindex, nofollow"
        openGraph={{
          title: metaTitle,
          description: metaDescription,
          url: `${BASE_URL}/dealer/dashboard/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: metaTitle,
          description: metaDescription,
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-white">
        <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">
              {t('dealerDashboardPage.title', { defaultValue: 'Dealer dashboard' })}
            </h1>
            <p className="text-gray-300">
              {t('dealerDashboardPage.subtitle', {
                defaultValue:
                  'Manage your public dealer profile, contact information, imagery, and the models you represent.',
              })}
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm ${isApprovedDealer
              ? 'border border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
              : 'border border-amber-500/60 bg-amber-500/10 text-amber-200'
              }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${isApprovedDealer ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
            />
            {isApprovedDealer
              ? t('dealerDashboardPage.statusApproved', { defaultValue: 'Approved dealer' })
              : t('dealerDashboardPage.statusAwaiting', { defaultValue: 'Awaiting approval' })}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {dashboardStats.map(stat => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{stat.label}</p>
              <p className="mt-2 text-3xl font-black text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-gray-400">{stat.helper}</p>
            </div>
          ))}
        </div>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-cyan">
                {t('dealerDashboardPage.listingSubmissionLabel', { defaultValue: 'Vehicle listings' })}
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {t('dealerDashboardPage.listingSubmissionTitle', { defaultValue: 'Submit vehicles for buyer discovery' })}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-300">
                {t('dealerDashboardPage.listingSubmissionDescription', {
                  defaultValue:
                    'Add complete listing details, pricing, EV specifications, location, and photos. New listings are saved for review so the public marketplace stays accurate and trustworthy.',
                })}
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/dealer/listings?new=1"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-gray-900 transition hover:opacity-90"
                >
                  <FilePlus2 className="h-4 w-4" />
                  {t('dealerDashboardPage.startListingSubmission', { defaultValue: 'Start a listing' })}
                </Link>
                <Link
                  to="/dealer/listings"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <ListChecks className="h-4 w-4" />
                  {t('dealerDashboardPage.manageListings', { defaultValue: 'Manage listings' })}
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: <ListChecks className="h-5 w-5" />,
                  title: t('dealerDashboardPage.listingSteps.detailsTitle', { defaultValue: 'Vehicle details' }),
                  description: t('dealerDashboardPage.listingSteps.detailsDescription', {
                    defaultValue: 'Make, model, year, mileage, body style, battery, and range.',
                  }),
                },
                {
                  icon: <Images className="h-5 w-5" />,
                  title: t('dealerDashboardPage.listingSteps.mediaTitle', { defaultValue: 'Images' }),
                  description: t('dealerDashboardPage.listingSteps.mediaDescription', {
                    defaultValue: 'Main photo plus supporting gallery images for buyer confidence.',
                  }),
                },
                {
                  icon: <ShieldCheck className="h-5 w-5" />,
                  title: t('dealerDashboardPage.listingSteps.reviewTitle', { defaultValue: 'Review' }),
                  description: t('dealerDashboardPage.listingSteps.reviewDescription', {
                    defaultValue: 'Listings are checked before they are promoted publicly.',
                  }),
                },
              ].map(step => (
                <div key={step.title} className="rounded-xl border border-white/10 bg-gray-950/50 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-gray-cyan">
                    {step.icon}
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-gray-400">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              {t('dealerDashboardPage.quickActions', { defaultValue: 'Quick actions' })}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/dealer/listings?new=1"
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
              >
                <PlusCircle className="h-6 w-6 text-gray-cyan mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-center">
                  {t('dealerDashboardPage.quickActionNewListing', { defaultValue: 'New listing' })}
                </span>
              </Link>
              {dealer.id && (
                <Link
                  to={`/dealers/${dealer.id}`}
                  className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                >
                  <ExternalLink className="h-6 w-6 text-gray-cyan mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold text-center">
                    {t('dealerDashboardPage.quickActionPublicProfile', { defaultValue: 'Public profile' })}
                  </span>
                </Link>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t('dealerDashboardPage.recentEnquiries', { defaultValue: 'Recent enquiries' })}
              </h3>
              <span className="bg-cyan-500/10 text-gray-cyan text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {t('dealerDashboardPage.newBadge', {
                  count: dealerEnquiries.length,
                  defaultValue: '{{count}} new',
                })}
              </span>
            </div>
            {dealerEnquiries.length > 0 ? (
              <div className="space-y-3">
                {[...(dealerEnquiries || [])]
                  .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                  .slice(0, 3)
                  .map((enquiry) => (
                  <div key={enquiry.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                    <div className="p-2 rounded-full bg-cyan-500/10 text-gray-cyan shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{enquiry.name}</p>
                        <span className="text-[10px] text-gray-500 flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          {enquiry.createdAt
                            ? enquiryDateFormatter.format(new Date(enquiry.createdAt.seconds * 1000))
                            : t('dealerDashboardPage.justNow', { defaultValue: 'Just now' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {t('dealerDashboardPage.messagePreviewLabel', { defaultValue: 'Message' })}:{' '}
                        <span className="text-gray-200">
                          {enquiry.message?.trim() || t('dealerDashboardPage.generalEnquiry', { defaultValue: 'General enquiry' })}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <p className="text-sm text-gray-500 italic">
                  {t('dealerDashboardPage.noEnquiries', { defaultValue: 'No enquiries yet' })}
                </p>
              </div>
            )}
          </div>
        </div>

        {canViewDealerPromotions && (
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-cyan">
                  {t('dealerDashboardPage.promotionsLabel', { defaultValue: 'Promotions and billing' })}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  {t('dealerDashboardPage.promotionsTitle', {
                    defaultValue: 'Request premium placements and track commercial status',
                  })}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-300">
                  {t('dealerDashboardPage.promotionsDescription', {
                    defaultValue:
                      'Submit paid placement requests for your dealer profile, listings, or EV models, then follow quotes, invoice references, payment state, and live campaign status from one place.',
                  })}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    icon: <Megaphone className="h-4 w-4" />,
                    label: t('dealerDashboardPage.promotionsQuotedStat', { defaultValue: 'Quoted requests' }),
                    value: quotedPlacementOrders,
                  },
                  {
                    icon: <CreditCard className="h-4 w-4" />,
                    label: t('dealerDashboardPage.promotionsPaymentStat', { defaultValue: 'Awaiting payment' }),
                    value: pendingPaymentOrders,
                  },
                  {
                    icon: <ShieldCheck className="h-4 w-4" />,
                    label: t('dealerDashboardPage.promotionsLiveStat', { defaultValue: 'Live public placements' }),
                    value: livePlacementOrders,
                  },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl border border-white/10 bg-gray-950/50 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {stat.icon}
                      <span>{stat.label}</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {placementsError && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {placementsError}
              </div>
            )}

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-gray-cyan" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                    {t('dealerDashboardPage.promoRequestSection', {
                      defaultValue: 'New promotion request',
                    })}
                  </h3>
                </div>

                {placementsLoading && !placementsLoaded ? (
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-300">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-cyan" />
                    <span>{t('common.loading', { defaultValue: 'Loading…' })}</span>
                  </div>
                ) : !(dealerEntitlements?.campaignPurchaseEligibility && dealerEntitlements?.promotionEligibility) ? (
                  <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-5">
                    <p className="text-sm font-semibold text-amber-100">
                      {t('dealerDashboardPage.promoUpgradeTitle', {
                        defaultValue: 'Paid dealer plan required',
                      })}
                    </p>
                    <p className="text-sm leading-6 text-amber-50/90">
                      {t('dealerDashboardPage.promoUpgradeDescription', {
                        defaultValue:
                          'Your current plan does not include paid placement requests. Upgrade the dealer account to unlock featured inventory, richer merchandising, and billing support.',
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-amber-100/90">
                      <span className="rounded-full border border-amber-400/30 bg-black/20 px-3 py-1">
                        {t('dealerDashboardPage.currentPlanLabel', {
                          defaultValue: 'Current plan: {{plan}}',
                          plan: dealerPlan?.name ?? 'Free Dealer',
                        })}
                      </span>
                    </div>
                    <Link
                      to="/contact"
                      className="inline-flex items-center justify-center rounded-xl border border-amber-300/30 bg-black/20 px-4 py-3 text-sm font-semibold text-amber-50 transition hover:bg-black/30"
                    >
                      {t('dealerDashboardPage.contactForUpgrade', {
                        defaultValue: 'Contact us about upgrading',
                      })}
                    </Link>
                  </div>
                ) : placementProducts.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-400">
                    {t('dealerDashboardPage.noPromoProducts', {
                      defaultValue: 'No eligible placement products are available for this dealer account yet.',
                    })}
                  </div>
                ) : (
                  <DealerPlacementRequestForm
                    products={placementProducts}
                    zones={placementZones}
                    entityOptionsByType={placementEntityOptionsByType}
                    onSubmit={handleCreatePlacementRequest}
                    isSubmitting={placementRequestSubmitting}
                  />
                )}
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-cyan" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                      {t('dealerDashboardPage.promoOrderHistoryTitle', {
                        defaultValue: 'Requests, quotes, and invoices',
                      })}
                    </h3>
                  </div>

                  {placementsLoading && !placementsLoaded ? (
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-300">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-cyan" />
                      <span>{t('common.loading', { defaultValue: 'Loading…' })}</span>
                    </div>
                  ) : placementOrders.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-400">
                      {t('dealerDashboardPage.promoOrdersEmpty', {
                        defaultValue: 'No promotion requests have been submitted yet.',
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {placementOrders.map(order => {
                        const product = placementProductById[order.sponsorshipProductId];
                        const linkedCampaign = order.campaignId
                          ? placementCampaignById[order.campaignId]
                          : null;
                        const linkedCampaignIsPublic = isPromotionalCampaignPubliclyResolvable(linkedCampaign);
                        const canCancelOrder =
                          canManageDealerPromotions &&
                          (order.status === 'draft' || order.status === 'quoted');

                        return (
                          <article key={order.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">{order.name}</p>
                              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                                {order.status}
                              </span>
                              <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                                {order.paymentStatus}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                              <span>
                                {t('dealerDashboardPage.promoProductLabel', { defaultValue: 'Placement product' })}:{' '}
                                {product?.name ?? order.sponsorshipProductId}
                              </span>
                              {order.invoiceReference && (
                                <span>
                                  {t('dealerDashboardPage.invoiceReferenceLabel', {
                                    defaultValue: 'Invoice / reference',
                                  })}:{' '}
                                  {order.invoiceReference}
                                </span>
                              )}
                              {(order.priceAmount != null || order.priceLabel) && (
                                <span>
                                  {t('dealerDashboardPage.promoBillingLabel', {
                                    defaultValue: 'Billing',
                                  })}:{' '}
                                  {order.priceAmount != null
                                    ? `${order.currency ?? 'EUR'} ${order.priceAmount}`
                                    : order.priceLabel}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                              {order.startAt && (
                                <span>
                                  {t('dealerDashboardPage.promoStartLabel', { defaultValue: 'Preferred start' })}:{' '}
                                  {enquiryDateFormatter.format(new Date(order.startAt))}
                                </span>
                              )}
                              {order.endAt && (
                                <span>
                                  {t('dealerDashboardPage.promoEndLabel', { defaultValue: 'Preferred end' })}:{' '}
                                  {enquiryDateFormatter.format(new Date(order.endAt))}
                                </span>
                              )}
                              {linkedCampaign && (
                                <span>
                                  {t('dealerDashboardPage.linkedCampaignLabel', {
                                    defaultValue: 'Linked campaign',
                                  })}:{' '}
                                  {linkedCampaign.name} ({linkedCampaign.status})
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                              {linkedCampaignIsPublic ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-100">
                                  {t('dealerDashboardPage.publicPlacementLiveLabel', {
                                    defaultValue: 'Public placement live',
                                  })}
                                </span>
                              ) : linkedCampaign ? (
                                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-100">
                                  {t('dealerDashboardPage.publicPlacementPendingLabel', {
                                    defaultValue: 'Campaign linked, not public yet',
                                  })}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-100">
                                  {t('dealerDashboardPage.publicPlacementMissingCampaignLabel', {
                                    defaultValue: 'Admin approval needed before this appears publicly',
                                  })}
                                </span>
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {order.zoneIds.map(zoneId => (
                                <span
                                  key={`${order.id}-${zoneId}`}
                                  className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-300"
                                >
                                  {placementZoneById[zoneId]?.name ?? zoneId}
                                </span>
                              ))}
                            </div>
                            {order.notes && (
                              <p className="mt-3 text-sm text-gray-300">{order.notes}</p>
                            )}
                            {canCancelOrder && (
                              <button
                                type="button"
                                onClick={() => void handleCancelPlacementOrder(order.id)}
                                disabled={placementOrderCancellingId === order.id}
                                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {placementOrderCancellingId === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                <span>
                                  {t('dealerDashboardPage.cancelPromoRequest', {
                                    defaultValue: 'Cancel request',
                                  })}
                                </span>
                              </button>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {canViewDealerTeam && (
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-cyan">
                  {t('dealerDashboardPage.teamLabel', { defaultValue: 'Team access' })}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  {t('dealerDashboardPage.teamTitle', { defaultValue: 'Manage your dealer team' })}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-300">
                  {t('dealerDashboardPage.teamDescription', {
                    defaultValue:
                      'Invite staff members into the dealer workspace, share secure acceptance links, and remove access when needed. Dealer plan limits still apply.',
                  })}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: t('dealerDashboardPage.teamCapacityTotal', { defaultValue: 'Team capacity' }),
                    value: teamCapacity?.maxTeamAccounts ?? 0,
                  },
                  {
                    label: t('dealerDashboardPage.teamCapacityActive', { defaultValue: 'Active staff' }),
                    value: teamCapacity?.activeStaffCount ?? 0,
                  },
                  {
                    label: t('dealerDashboardPage.teamCapacityRemaining', { defaultValue: 'Available slots' }),
                    value: teamCapacity?.remainingSlots ?? 0,
                  },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl border border-white/10 bg-gray-950/50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
                    <p className="mt-2 text-2xl font-black text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {teamError && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {teamError}
              </div>
            )}

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-gray-cyan" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                    {t('dealerDashboardPage.teamInviteSection', { defaultValue: 'Invite staff' })}
                  </h3>
                </div>

                {canManageDealerTeam ? (
                  <div className="space-y-4">
                    <label className="flex flex-col gap-2 text-sm text-gray-300">
                      <span className="font-medium text-white">
                        {t('dealerDashboardPage.teamInviteEmailLabel', { defaultValue: 'Staff email' })}
                      </span>
                      <input
                        type="email"
                        value={teamInviteEmail}
                        onChange={event => setTeamInviteEmail(event.target.value)}
                        placeholder={t('dealerDashboardPage.teamInviteEmailPlaceholder', {
                          defaultValue: 'staff@example.com',
                        })}
                        className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm text-gray-300">
                      <span className="font-medium text-white">
                        {t('dealerDashboardPage.teamInviteRoleLabel', { defaultValue: 'Workspace role' })}
                      </span>
                      <select
                        value={teamInviteRole}
                        onChange={event => setTeamInviteRole(event.target.value as Extract<DealerStaffRole, 'manager' | 'editor'>)}
                        className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none"
                      >
                        <option value="manager">
                          {t('dealerDashboardPage.teamRoleManager', { defaultValue: 'Manager' })}
                        </option>
                        <option value="editor">
                          {t('dealerDashboardPage.teamRoleEditor', { defaultValue: 'Editor' })}
                        </option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => void handleCreateTeamInvite()}
                      disabled={teamInviteSubmitting || (teamCapacity?.remainingSlots ?? 0) <= 0}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-gray-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {teamInviteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      <span>{t('dealerDashboardPage.teamInviteButton', { defaultValue: 'Create invite link' })}</span>
                    </button>

                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400">
                      {t('dealerDashboardPage.teamInviteHint', {
                        defaultValue:
                          'Managers can invite and remove staff. Editors can work in the dealer workspace but cannot manage team access.',
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-400">
                    {t('dealerDashboardPage.teamReadOnly', {
                      defaultValue: 'Your current dealer role can view the team roster but cannot manage invites.',
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-cyan" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                      {t('dealerDashboardPage.teamMembersTitle', { defaultValue: 'Current staff' })}
                    </h3>
                  </div>

                  {teamLoading && !teamLoaded ? (
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-300">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-cyan" />
                      <span>{t('common.loading', { defaultValue: 'Loading…' })}</span>
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-400">
                      {t('dealerDashboardPage.teamMembersEmpty', {
                        defaultValue: 'No additional staff accounts are active yet.',
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {teamMembers.map(member => (
                        <article key={member.uid} className="rounded-xl border border-white/10 bg-white/5 p-4">
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
                          <p className="mt-2 text-xs text-gray-400">{member.email ?? member.uid}</p>
                          {canManageDealerTeam && (
                            <button
                              type="button"
                              onClick={() => void handleRemoveTeamMember(member.uid)}
                              disabled={teamMemberRemovingId === member.uid}
                              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {teamMemberRemovingId === member.uid ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              <span>{t('dealerDashboardPage.removeTeamMember', { defaultValue: 'Remove access' })}</span>
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Copy className="h-4 w-4 text-gray-cyan" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                      {t('dealerDashboardPage.teamInvitesTitle', { defaultValue: 'Pending and recent invites' })}
                    </h3>
                  </div>

                  {teamInvites.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-400">
                      {t('dealerDashboardPage.teamInvitesEmpty', {
                        defaultValue: 'No dealer team invites have been created yet.',
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {teamInvites.map(invite => (
                        <article key={invite.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
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
                          {invite.inviteUrl && (
                            <p className="mt-2 break-all text-xs text-gray-400">{invite.inviteUrl}</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {invite.inviteUrl && (
                              <button
                                type="button"
                                onClick={() => void handleCopyTeamInviteLink(invite)}
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
                              >
                                <Copy className="h-4 w-4" />
                                <span>{t('dealerDashboardPage.copyTeamInvite', { defaultValue: 'Copy link' })}</span>
                              </button>
                            )}
                            {canManageDealerTeam && invite.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => void handleRevokeTeamInvite(invite.id)}
                                disabled={teamInviteRevokingId === invite.id}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {teamInviteRevokingId === invite.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                <span>{t('dealerDashboardPage.revokeTeamInvite', { defaultValue: 'Revoke' })}</span>
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
          </section>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {t('dealerDashboardPage.contactInformation', { defaultValue: 'Contact information' })}
                </h2>
                <button
                  type="submit"
                  form="dealer-profile-form"
                  className="inline-flex items-center gap-2 rounded-full bg-gray-cyan px-4 py-2 text-sm font-semibold text-gray-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isUpdatingDealer}
                >
                  {isUpdatingDealer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{t('dealerDashboardPage.saveChanges', { defaultValue: 'Save changes' })}</span>
                </button>
              </div>
              <form id="dealer-profile-form" className="space-y-6" onSubmit={handleProfileSubmit}>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="name">
                      {t('dealerDashboardPage.fields.dealershipName', { defaultValue: 'Dealership name' })}
                    </label>
                    <input
                      id="name"
                      name="name"
                      autoComplete="organization"
                      value={profileState.name}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.dealershipNamePlaceholder', {
                        defaultValue: 'Makina Elektrike Dealer',
                      })}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="contactName">
                      {t('dealerDashboardPage.fields.primaryContact', { defaultValue: 'Primary contact' })}
                    </label>
                    <input
                      id="contactName"
                      name="contactName"
                      autoComplete="name"
                      value={profileState.contactName}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.primaryContactPlaceholder', {
                        defaultValue: 'Jane Doe',
                      })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="phone">
                      {t('dealerDashboardPage.fields.phoneNumber', { defaultValue: 'Phone number' })}
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      autoComplete="tel"
                      value={profileState.phone}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.phonePlaceholder', { defaultValue: '+355 69 123 4567' })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="email">
                      {t('common.email')}
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={profileState.email}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.emailPlaceholder', {
                        defaultValue: 'dealer@example.com',
                      })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="website">
                      {t('registerDealerPage.fields.website', { defaultValue: 'Website' })}
                    </label>
                    <input
                      id="website"
                      name="website"
                      autoComplete="url"
                      value={profileState.website}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder="https://"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="city">
                      {t('registerDealerPage.fields.city', { defaultValue: 'City' })}
                    </label>
                    <input
                      id="city"
                      name="city"
                      autoComplete="address-level2"
                      value={profileState.city}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.cityPlaceholder', { defaultValue: 'Tirana' })}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="address">
                      {t('dealerDashboardPage.fields.streetAddress', { defaultValue: 'Street address' })}
                    </label>
                    <input
                      id="address"
                      name="address"
                      autoComplete="street-address"
                      value={profileState.address}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.streetAddressPlaceholder', {
                        defaultValue: '123 Electric Ave',
                      })}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="brands">
                      {t('dealerDashboardPage.fields.brands', { defaultValue: 'Brands you carry' })}
                    </label>
                    <input
                      id="brands"
                      name="brands"
                      value={profileState.brands}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.brandsPlaceholder', {
                        defaultValue: 'Tesla, Hyundai, Kia',
                      })}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      {t('dealerDashboardPage.fields.separateEntries', { defaultValue: 'Separate entries with commas.' })}
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="languages">
                      {t('dealerDashboardPage.fields.languages', { defaultValue: 'Languages spoken' })}
                    </label>
                    <input
                      id="languages"
                      name="languages"
                      value={profileState.languages}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.languagesPlaceholder', {
                        defaultValue: 'Albanian, English, Italian',
                      })}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      {t('dealerDashboardPage.fields.separateEntries', { defaultValue: 'Separate entries with commas.' })}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <fieldset className="rounded-2xl border border-white/10 bg-gray-950/40 p-4">
                      <legend className="px-1 text-sm font-semibold text-gray-100">
                        {t('dealerDashboardPage.fields.serviceCapabilities', {
                          defaultValue: 'Service and customer support capabilities',
                        })}
                      </legend>
                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        {t('dealerDashboardPage.fields.serviceCapabilitiesHelp', {
                          defaultValue:
                            'Select every capability your dealership can genuinely provide. These badges can appear on your public dealer profile and help admins review profile completeness.',
                        })}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {DEALER_SERVICE_CAPABILITY_OPTIONS.map(option => (
                          <label
                            key={option.value}
                            className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-200 transition hover:border-gray-cyan/30 hover:bg-white/10"
                          >
                            <input
                              type="checkbox"
                              checked={profileState.serviceCapabilities.includes(option.value)}
                              onChange={event => handleServiceCapabilityChange(option.value, event.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-white/20 bg-gray-900 text-gray-cyan focus:ring-gray-cyan"
                            />
                            <span>
                              <span className="block font-semibold text-white">
                                {t(option.labelKey, { defaultValue: option.defaultLabel })}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-gray-400">
                                {t(option.descriptionKey, { defaultValue: option.defaultDescription })}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="certificationDetails">
                      {t('dealerDashboardPage.fields.certificationDetails', {
                        defaultValue: 'Certification or service details',
                      })}
                    </label>
                    <textarea
                      id="certificationDetails"
                      name="certificationDetails"
                      value={profileState.certificationDetails}
                      onChange={handleProfileChange}
                      rows={3}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.certificationDetailsPlaceholder', {
                        defaultValue: 'Example: certified BYD service partner, trained high-voltage technicians, warranty process notes...',
                      })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="serviceNotes">
                      {t('dealerDashboardPage.fields.serviceNotes', {
                        defaultValue: 'Additional service notes',
                      })}
                    </label>
                    <textarea
                      id="serviceNotes"
                      name="serviceNotes"
                      value={profileState.serviceNotes}
                      onChange={handleProfileChange}
                      rows={3}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.serviceNotesPlaceholder', {
                        defaultValue: 'Add service coverage, parts availability, appointment requirements, partner workshops, or limitations.',
                      })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="typeOfCars">
                      {t('dealerDashboardPage.fields.vehicleFocus', { defaultValue: 'Vehicle focus' })}
                    </label>
                    <input
                      id="typeOfCars"
                      name="typeOfCars"
                      value={profileState.typeOfCars}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.vehicleFocusPlaceholder', {
                        defaultValue: 'New EVs, Certified Pre-Owned',
                      })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="priceRange">
                      {t('dealerDashboardPage.fields.priceRange', { defaultValue: 'Typical price range' })}
                    </label>
                    <input
                      id="priceRange"
                      name="priceRange"
                      value={profileState.priceRange}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder={t('dealerDashboardPage.fields.priceRangePlaceholder', {
                        defaultValue: '€20,000 - €60,000',
                      })}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="description">
                    {t('dealerDashboardPage.fields.businessDescription', { defaultValue: 'Business description' })}
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={profileState.description}
                    onChange={handleProfileChange}
                    rows={4}
                    className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                    placeholder={t('dealerDashboardPage.fields.businessDescriptionPlaceholder', {
                      defaultValue: 'Tell customers about your dealership, services, and specialties.',
                    })}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="dealer-notes">
                    {t('dealerDashboardPage.fields.highlights', { defaultValue: 'Highlights & notes' })}
                  </label>
                  <textarea
                    id="dealer-notes"
                    name="notes"
                    value={profileState.notes}
                    onChange={handleProfileChange}
                    rows={4}
                    className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                    placeholder={t('dealerDashboardPage.fields.highlightsPlaceholder', {
                      defaultValue: 'Share what makes your dealership unique.',
                    })}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="facebook">
                      {t('admin.fields.facebookUrl', { defaultValue: 'Facebook URL' })}
                    </label>
                    <input
                      id="facebook"
                      name="facebook"
                      value={profileState.facebook}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder="https://facebook.com/your-page"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="instagram">
                      {t('admin.fields.instagramUrl', { defaultValue: 'Instagram URL' })}
                    </label>
                    <input
                      id="instagram"
                      name="instagram"
                      value={profileState.instagram}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder="https://instagram.com/your-handle"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="twitter">
                      {t('dealerDashboardPage.fields.twitterUrl', { defaultValue: 'X / Twitter URL' })}
                    </label>
                    <input
                      id="twitter"
                      name="twitter"
                      value={profileState.twitter}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder="https://x.com/your-handle"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="youtube">
                      {t('admin.fields.youtubeUrl', { defaultValue: 'YouTube URL' })}
                    </label>
                    <input
                      id="youtube"
                      name="youtube"
                      value={profileState.youtube}
                      onChange={handleProfileChange}
                      className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      placeholder="https://youtube.com/@your-channel"
                    />
                  </div>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {t('dealerDashboardPage.modelsTitle', { defaultValue: 'Models you represent' })}
                </h2>
              </div>
              <div className="space-y-6">
                <form className="flex flex-col gap-4 md:flex-row" onSubmit={handleAttachModel}>
                  <select
                    className="flex-1 rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                    value={selectedModelId}
                    onChange={event => setSelectedModelId(event.target.value)}
                  >
                    <option value="">
                      {t('dealerDashboardPage.selectExistingModel', { defaultValue: 'Select an existing model' })}
                    </option>
                    {availableModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.brand} · {model.model_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-gray-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!selectedModelId || dealerMutations.update.loading}
                  >
                    {dealerMutations.update.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    <span>{t('dealerDashboardPage.attachModel', { defaultValue: 'Attach model' })}</span>
                  </button>
                </form>

                {assignedModels.length ? (
                  <ul className="space-y-3">
                    {assignedModels.map(model => (
                      <li
                        key={model.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-gray-900/60 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">
                            {model.brand} · {model.model_name}
                          </p>
                          {model.body_type && (
                            <p className="text-sm text-gray-400">{model.body_type}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDetachModel(model.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-red-500/60 px-3 py-1 text-sm text-red-200 transition hover:bg-red-500/10"
                          disabled={dealerMutations.update.loading}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('common.delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-300">
                    {t('dealerDashboardPage.noModels', {
                      defaultValue:
                        'No models linked yet. Attach an existing model or create a new one below to showcase the vehicles you offer.',
                    })}
                  </p>
                )}

                <div className="rounded-xl border border-white/10 bg-gray-900/50 p-5">
                  <h3 className="text-lg font-semibold">
                    {t('dealerDashboardPage.addNewModelTitle', { defaultValue: 'Add a new model' })}
                  </h3>
                  <p className="mt-1 text-sm text-gray-300">
                    {t('dealerDashboardPage.addNewModelDescription', {
                      defaultValue:
                        "Can't find the model you need? Create it here and we'll automatically attach it to your dealer page.",
                    })}
                  </p>
                  <form className="mt-4 space-y-4" onSubmit={handleCreateModel}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="brand">
                          {t('modelsPage.brand', { defaultValue: 'Brand' })}
                        </label>
                        <input
                          id="brand"
                          name="brand"
                          value={newModelState.brand}
                          onChange={handleNewModelChange}
                          className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                          placeholder={t('dealerDashboardPage.createModel.brandPlaceholder', { defaultValue: 'Brand' })}
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="model_name">
                          {t('admin.fields.modelName', { defaultValue: 'Model name' })}
                        </label>
                        <input
                          id="model_name"
                          name="model_name"
                          value={newModelState.model_name}
                          onChange={handleNewModelChange}
                          className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                          placeholder={t('dealerDashboardPage.createModel.modelPlaceholder', { defaultValue: 'Model' })}
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="body_type">
                          {t('modelsPage.bodyType', { defaultValue: 'Body type' })}
                        </label>
                        <input
                          id="body_type"
                          name="body_type"
                          value={newModelState.body_type}
                          onChange={handleNewModelChange}
                          className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                          placeholder={t('dealerDashboardPage.createModel.bodyTypePlaceholder', {
                            defaultValue: 'SUV, Hatchback...',
                          })}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="range_wltp">
                          {t('admin.fields.rangeWltp', { defaultValue: 'Range (WLTP km)' })}
                        </label>
                        <input
                          id="range_wltp"
                          name="range_wltp"
                          value={newModelState.range_wltp}
                          onChange={handleNewModelChange}
                          className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                          placeholder="480"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="power_kw">
                          {t('admin.fields.powerKw', { defaultValue: 'Power (kW)' })}
                        </label>
                        <input
                          id="power_kw"
                          name="power_kw"
                          value={newModelState.power_kw}
                          onChange={handleNewModelChange}
                          className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                          placeholder="150"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="image_url">
                          {t('dealerDashboardPage.createModel.imageUrlOptional', { defaultValue: 'Image URL (optional)' })}
                        </label>
                        <input
                          id="image_url"
                          name="image_url"
                          value={newModelState.image_url}
                          onChange={handleNewModelChange}
                          className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                          placeholder="https://"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-gray-200">
                          {t('dealerDashboardPage.createModel.uploadModelImage', { defaultValue: 'Upload model image' })}
                        </span>
                        <div className="flex flex-wrap items-center gap-4">
                          <img
                            src={newModelImagePreview || MODEL_PLACEHOLDER_IMAGE}
                            alt={t('dealerDashboardPage.createModel.modelPreviewAlt', {
                              name: newModelState.brand || t('dealerDashboardPage.createModel.modelFallbackName', { defaultValue: 'Model' }),
                              defaultValue: '{{name}} preview',
                            })}
                            className="h-24 w-32 rounded-lg border border-white/10 object-cover bg-gray-900/60"
                          />
                          <div className="flex flex-col gap-2">
                            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-gray-cyan px-4 py-2 text-sm font-semibold text-gray-900 transition hover:opacity-90">
                              {creatingModel ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                              <span>
                                {creatingModel
                                  ? t('dealerDashboardPage.uploading', { defaultValue: 'Uploading…' })
                                  : t('admin.uploadImage', { defaultValue: 'Upload image' })}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleNewModelImageChange}
                                disabled={creatingModel}
                              />
                            </label>
                            {(newModelImageFile || newModelPreviewFromFile) && (
                              <button
                                type="button"
                                onClick={handleNewModelImageClear}
                                className="text-left text-xs text-gray-300 transition hover:text-white"
                                disabled={creatingModel}
                              >
                                {t('dealerDashboardPage.createModel.removeSelectedImage', { defaultValue: 'Remove selected image' })}
                              </button>
                            )}
                            <p className="text-xs text-gray-400">
                              {t('admin.imageUploadHint', { defaultValue: 'JPEG or PNG recommended, up to 5MB.' })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-gray-200">
                          {t('dealerDashboardPage.createModel.galleryImages', { defaultValue: 'Gallery images' })}
                        </span>
                        <p className="mb-3 text-xs text-gray-400">
                          {t('dealerDashboardPage.createModel.galleryDescription', {
                            defaultValue:
                              'Add up to three supporting images for this model. They will appear on the public page below the dealer list.',
                          })}
                        </p>
                        <div className="flex flex-wrap gap-4">
                          {newModelGalleryDrafts.map((draft, index) => (
                            <div key={draft.preview} className="relative">
                              <img
                                src={draft.preview}
                                alt={t('dealerDashboardPage.createModel.galleryPreviewAlt', {
                                  defaultValue: 'Model gallery preview',
                                })}
                                className="h-24 w-32 rounded-lg border border-dashed border-white/20 object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => handleNewModelGalleryRemove(index)}
                                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white transition hover:bg-black/80"
                                disabled={creatingModel}
                              >
                                {t('common.delete')}
                              </button>
                            </div>
                          ))}
                          {newModelGalleryDrafts.length === 0 && (
                            <p className="text-sm text-gray-400">
                              {t('dealerDashboardPage.createModel.noGalleryImages', {
                                defaultValue: 'No gallery images selected yet.',
                              })}
                            </p>
                          )}
                        </div>
                        <label className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${newModelGalleryUploadDisabled
                          ? 'cursor-not-allowed border border-white/10 bg-white/5 text-gray-400'
                          : 'cursor-pointer bg-gray-cyan text-gray-900 hover:opacity-90'
                          }`}>
                          {creatingModel ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          <span>
                            {newModelGalleryUploadDisabled
                              ? t('admin.modelGalleryLimitReached', { defaultValue: 'Gallery limit reached' })
                              : creatingModel
                                ? t('dealerDashboardPage.uploading', { defaultValue: 'Uploading…' })
                                : t('dealerDashboardPage.createModel.uploadGalleryImages', {
                                    defaultValue: 'Upload gallery images',
                                  })}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleNewModelGalleryChange}
                            disabled={creatingModel || newModelGalleryUploadDisabled}
                          />
                        </label>
                        <p className="mt-1 text-xs text-gray-400">
                          {t('dealerDashboardPage.createModel.galleryImageHint', {
                            defaultValue: 'JPEG or PNG recommended, up to 5MB each.',
                          })}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="model-notes">
                        {t('dealerDashboardPage.createModel.notes', { defaultValue: 'Model notes' })}
                      </label>
                      <textarea
                        id="model-notes"
                        name="notes"
                        value={newModelState.notes}
                        onChange={handleNewModelChange}
                        rows={3}
                        className="w-full rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                        placeholder={t('dealerDashboardPage.createModel.notesPlaceholder', {
                          defaultValue: 'Charging speeds, standout features, etc.',
                        })}
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isCreatingModel}
                    >
                      {isCreatingModel ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      <span>
                        {t('dealerDashboardPage.createModel.createAndAttach', {
                          defaultValue: 'Create & attach model',
                        })}
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl">
              <h2 className="text-xl font-semibold">
                {t('dealerDashboardPage.heroTitle', { defaultValue: 'Hero imagery' })}
              </h2>
              <p className="mt-2 text-sm text-gray-300">
                {t('dealerDashboardPage.heroDescription', {
                  defaultValue:
                    'Upload a feature image that appears on your public dealer page. High-resolution landscape photos work best.',
                })}
              </p>
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-gray-900/60">
                <img
                  src={profileState.imageUrl || DEALERSHIP_PLACEHOLDER_IMAGE}
                  alt={profileState.name || t('dealerDashboardPage.heroPreviewAlt', { defaultValue: 'Dealer image preview' })}
                  className="h-48 w-full object-cover"
                />
              </div>
              {!profileState.imageUrl && (
                <p className="mt-2 text-xs text-gray-400">
                  {t('dealerDashboardPage.heroHint', {
                    defaultValue: "We're showing a placeholder image until you upload your own photo.",
                  })}
                </p>
              )}
              <label className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gray-cyan px-4 py-2 text-sm font-semibold text-gray-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {uploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>
                  {uploadingImage
                    ? t('dealerDashboardPage.uploading', { defaultValue: 'Uploading…' })
                    : t('dealerDashboardPage.uploadHeroImage', { defaultValue: 'Upload image' })}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
              </label>
              {profileState.imageUrl && (
                <button
                  type="button"
                  onClick={handleImageRemove}
                  className="mt-3 inline-flex items-center gap-2 text-sm text-gray-300 transition hover:text-white"
                  disabled={dealerMutations.update.loading}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('dealerDashboardPage.removeCurrentImage', { defaultValue: 'Remove image' })}
                </button>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-xl font-semibold">
                {t('dealerDashboardPage.galleryTitle', { defaultValue: 'Gallery' })}
              </h2>
              <p className="mt-2 text-sm text-gray-300">
                {t('dealerDashboardPage.galleryDescription', {
                  defaultValue:
                    'Showcase up to three additional photos. They appear beneath your model line-up on the public page.',
                })}
              </p>
              <div className="mt-4 flex flex-col gap-4">
                {dealerGallery.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {dealerGallery.map(imageUrl => (
                      <div key={imageUrl} className="relative">
                        <img
                          src={imageUrl}
                          alt={t('dealerDashboardPage.galleryImageAlt', { defaultValue: 'Dealer gallery image' })}
                          className="h-24 w-32 rounded-lg border border-white/10 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleGalleryImageRemove(imageUrl)}
                          className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white transition hover:bg-black/80"
                          disabled={galleryRemoving === imageUrl || dealerMutations.update.loading}
                        >
                          {galleryRemoving === imageUrl
                            ? t('dealerDashboardPage.removing', { defaultValue: 'Removing…' })
                            : t('common.delete')}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    {t('dealerDashboardPage.noGalleryImages', { defaultValue: 'No gallery images yet.' })}
                  </p>
                )}
                <label className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${galleryUploading
                  ? 'cursor-wait border border-white/10 bg-white/5 text-gray-400'
                  : dealerGallery.length >= 3
                    ? 'cursor-not-allowed border border-white/10 bg-white/5 text-gray-400'
                    : 'cursor-pointer bg-gray-cyan text-gray-900 hover:opacity-90'
                  }`}>
                  {galleryUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>
                    {galleryUploading
                      ? t('dealerDashboardPage.uploading', { defaultValue: 'Uploading…' })
                      : dealerGallery.length >= 3
                        ? t('admin.modelGalleryLimitReached', { defaultValue: 'Gallery limit reached' })
                        : t('dealerDashboardPage.uploadGalleryImage', { defaultValue: 'Upload gallery image' })}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleGalleryUpload}
                    disabled={galleryUploading || dealerGallery.length >= 3}
                  />
                </label>
                <p className="text-xs text-gray-400">
                  {t('dealerDashboardPage.galleryHelp', {
                    defaultValue: 'JPEG or PNG recommended. Maximum of 3 gallery images.',
                  })}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-xl font-semibold">
                {t('dealerDashboardPage.helpTitle', { defaultValue: 'Need help?' })}
              </h2>
              <p className="mt-2 text-sm text-gray-300">
                {t('dealerDashboardPage.helpDescription', {
                  defaultValue:
                    'Changes go live immediately after they are saved. If you need assistance with imagery, copywriting, or have other questions, reach out to our support team anytime.',
                })}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DealerDashboardPage;
