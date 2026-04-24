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
  User
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
import type { Dealer, Model, Enquiry } from '../types';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import { DEALERSHIP_PLACEHOLDER_IMAGE, MODEL_PLACEHOLDER_IMAGE } from '../constants/media';
import Link from '../components/LocalizedLink';

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
  const { user } = useAuth();
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

  const dealer: Dealer | null = useMemo(() => {
    if (!user) {
      return null;
    }
    return (
      dealers.find(entry => entry.id === user.uid || entry.ownerUid === user.uid) ?? null
    );
  }, [dealers, user]);

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
        typeOfCars: profileState.typeOfCars.trim() || dealer.typeOfCars || 'Electric Vehicles',
        priceRange: profileState.priceRange.trim() || undefined,
        image_url: profileState.imageUrl.trim() || undefined,
        logo_url: profileState.imageUrl.trim() || undefined,
        social_links: Object.keys(sanitizedSocialLinks).length
          ? sanitizedSocialLinks
          : undefined,
        ownerUid: dealer.ownerUid ?? user?.uid,
      });
    } catch (error) {
      console.error('Failed to update dealer profile', error);
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
    } catch (error) {
      console.error('Failed to create and attach model', error);
    } finally {
      setCreatingModel(false);
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

        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              {t('dealerDashboardPage.quickActions', { defaultValue: 'Quick actions' })}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/dealer/listings"
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
