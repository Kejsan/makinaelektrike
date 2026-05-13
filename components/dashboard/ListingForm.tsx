import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
    Listing,
    ListingModelProfileChangeReason,
    ListingModelProfileSnapshot,
    Model,
} from '../../types';

export interface ListingFormValues extends Omit<Listing, 'id' | 'createdAt' | 'updatedAt' | 'dealerId'> {
    id?: string;
    imageFile?: File | null;
    galleryFiles?: File[];
}

interface ListingFormProps {
    initialValues?: Listing;
    availableModels?: Model[];
    onSubmit: (values: ListingFormValues) => void | Promise<void>;
    onCancel: () => void;
    isSubmitting?: boolean;
}

const defaultState: ListingFormValues = {
    make: '',
    model: '',
    year: new Date().getFullYear(),
    price: 0,
    priceCurrency: 'EUR',
    mileage: 0,
    fuelType: 'Electric',
    title: '',
    description: '',
    status: 'pending',
    images: [],
    imageGallery: [],
    bodyType: 'SUV',
    batteryCapacity: undefined,
    range: undefined,
    modelProfileChangeReason: null,
    modelProfileChangeNotes: '',
    modelProfileChangeFields: [],
    modelProfileSnapshot: null,
    location: {
        city: '',
        address: '',
    },
    financialOptions: {
        loanSupported: false,
        leasingSupported: false,
    },
    isForRent: false,
    isForSubscription: false,
};

const galleryLimit = 8;
const optionalNumberFields = new Set(['batteryCapacity', 'range']);
const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-gray-500 focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan/40';
const selectClass = `${inputClass} [color-scheme:dark]`;
const checkboxClass = 'h-4 w-4 rounded border-white/20 bg-white/10 text-gray-cyan focus:ring-gray-cyan';

const sanitizeOptionalNumber = (value?: number) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

const getModelProfileLabel = (model: Model) =>
    [model.brand, model.model_name].filter(Boolean).join(' ').trim();

const modelProfileChangeReasonOptions: Array<{
    value: ListingModelProfileChangeReason;
    labelKey: string;
    defaultLabel: string;
}> = [
    {
        value: 'submodel_or_trim',
        labelKey: 'dealerListingsPage.form.modelChangeReasons.submodelOrTrim',
        defaultLabel: 'Different submodel, trim, or variant',
    },
    {
        value: 'catalog_error',
        labelKey: 'dealerListingsPage.form.modelChangeReasons.catalogError',
        defaultLabel: 'Error in the existing model card',
    },
    {
        value: 'market_variant',
        labelKey: 'dealerListingsPage.form.modelChangeReasons.marketVariant',
        defaultLabel: 'Market/import version differs',
    },
    {
        value: 'dealer_specific_configuration',
        labelKey: 'dealerListingsPage.form.modelChangeReasons.dealerSpecificConfiguration',
        defaultLabel: 'Dealer-specific configuration',
    },
    {
        value: 'other',
        labelKey: 'dealerListingsPage.form.modelChangeReasons.other',
        defaultLabel: 'Other reason',
    },
];

const normalizeComparableString = (value?: string | null) => (value ?? '').trim().toLocaleLowerCase();

const normalizeComparableNumber = (value?: number | null) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

const getModelProfileSnapshot = (model: Model): ListingModelProfileSnapshot => ({
    modelId: model.id,
    brand: model.brand ?? null,
    modelName: model.model_name ?? null,
    bodyType: model.body_type ?? null,
    batteryCapacity: model.battery_capacity ?? null,
    rangeWltp: model.range_wltp ?? null,
    capturedAt: new Date().toISOString(),
});

const ListingForm: React.FC<ListingFormProps> = ({
    initialValues,
    availableModels = [],
    onSubmit,
    onCancel,
    isSubmitting,
}) => {
    const { t } = useTranslation();
    const [formState, setFormState] = useState<ListingFormValues>(defaultState);
    const [selectedModelId, setSelectedModelId] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [galleryDrafts, setGalleryDrafts] = useState<{ file: File; preview: string }[]>([]);
    const [existingGallery, setExistingGallery] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const imagePreviewObjectUrlRef = useRef<string | null>(null);
    const galleryDraftsRef = useRef<{ file: File; preview: string }[]>([]);

    const bodyTypeOptions = [
        { value: 'SUV', label: t('dealerListingsPage.form.bodyTypes.suv') },
        { value: 'Sedan', label: t('dealerListingsPage.form.bodyTypes.sedan') },
        { value: 'Hatchback', label: t('dealerListingsPage.form.bodyTypes.hatchback') },
        { value: 'Wagon', label: t('dealerListingsPage.form.bodyTypes.wagon') },
        { value: 'Van', label: t('dealerListingsPage.form.bodyTypes.van') },
        { value: 'Coupe', label: t('dealerListingsPage.form.bodyTypes.coupe') },
        { value: 'Pickup', label: t('dealerListingsPage.form.bodyTypes.pickup') },
    ];

    const fuelTypeOptions = [
        { value: 'Electric', label: t('dealerListingsPage.form.fuelTypes.electric') },
        { value: 'Plug-in Hybrid', label: t('dealerListingsPage.form.fuelTypes.pluginHybrid') },
        { value: 'Hybrid', label: t('dealerListingsPage.form.fuelTypes.hybrid') },
    ];

    const visibleBodyTypeOptions = formState.bodyType && !bodyTypeOptions.some(option => option.value === formState.bodyType)
        ? [{ value: formState.bodyType, label: formState.bodyType }, ...bodyTypeOptions]
        : bodyTypeOptions;
    const visibleFuelTypeOptions = formState.fuelType && !fuelTypeOptions.some(option => option.value === formState.fuelType)
        ? [{ value: formState.fuelType, label: formState.fuelType }, ...fuelTypeOptions]
        : fuelTypeOptions;
    const selectedModelProfile = availableModels.find(model => model.id === selectedModelId);
    const selectedModelLabel = selectedModelProfile ? getModelProfileLabel(selectedModelProfile) : '';
    const totalGalleryCount = existingGallery.length + galleryDrafts.length;
    const modifiedModelProfileFields = selectedModelProfile
        ? [
            normalizeComparableString(formState.make) !== normalizeComparableString(selectedModelProfile.brand)
                ? t('admin.make', { defaultValue: 'Make' })
                : null,
            normalizeComparableString(formState.model) !== normalizeComparableString(selectedModelProfile.model_name)
                ? t('admin.model', { defaultValue: 'Model' })
                : null,
            normalizeComparableString(formState.bodyType) !== normalizeComparableString(selectedModelProfile.body_type)
                ? t('listings.fields.bodyType', { defaultValue: 'Body type' })
                : null,
            normalizeComparableNumber(formState.batteryCapacity) !== normalizeComparableNumber(selectedModelProfile.battery_capacity)
                ? t('dealerListingsPage.form.batteryCapacity', { defaultValue: 'Battery capacity' })
                : null,
            normalizeComparableNumber(formState.range) !== normalizeComparableNumber(selectedModelProfile.range_wltp)
                ? t('dealerListingsPage.form.range', { defaultValue: 'Range' })
                : null,
        ].filter((field): field is string => Boolean(field))
        : [];
    const requiresModelProfileChangeReason = Boolean(selectedModelProfile && modifiedModelProfileFields.length > 0);

    useEffect(() => {
        galleryDraftsRef.current = galleryDrafts;
    }, [galleryDrafts]);

    useEffect(() => {
        return () => {
            if (imagePreviewObjectUrlRef.current) {
                URL.revokeObjectURL(imagePreviewObjectUrlRef.current);
            }
            galleryDraftsRef.current.forEach(draft => URL.revokeObjectURL(draft.preview));
        };
    }, []);

    useEffect(() => {
        if (imagePreviewObjectUrlRef.current) {
            URL.revokeObjectURL(imagePreviewObjectUrlRef.current);
            imagePreviewObjectUrlRef.current = null;
        }

        setImageFile(null);
        setGalleryDrafts(prev => {
            prev.forEach(draft => URL.revokeObjectURL(draft.preview));
            return [];
        });
        setErrors({});

        if (initialValues) {
            setSelectedModelId(initialValues.modelId ?? '');
            setFormState({
                ...defaultState,
                ...initialValues,
                images: initialValues.images || [],
                imageGallery: initialValues.imageGallery || [],
                location: {
                    city: initialValues.location?.city ?? '',
                    address: initialValues.location?.address ?? '',
                    lat: initialValues.location?.lat,
                    lng: initialValues.location?.lng,
                },
                financialOptions: {
                    loanSupported: Boolean(initialValues.financialOptions?.loanSupported),
                    leasingSupported: Boolean(initialValues.financialOptions?.leasingSupported),
                    monthlyPaymentEstimate: initialValues.financialOptions?.monthlyPaymentEstimate,
                    loanTermMonths: initialValues.financialOptions?.loanTermMonths,
                    downPaymentMin: initialValues.financialOptions?.downPaymentMin,
                },
            });
            setImagePreview(initialValues.images?.[0] || '');
            setExistingGallery(initialValues.imageGallery || []);
        } else {
            setSelectedModelId('');
            setFormState(defaultState);
            setImagePreview('');
            setExistingGallery([]);
        }
    }, [initialValues]);

    const clearError = (name: string) => {
        if (!errors[name]) {
            return;
        }

        setErrors(prev => {
            const nextErrors = { ...prev };
            delete nextErrors[name];
            return nextErrors;
        });
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = event.target;
        const fieldValue =
            type === 'number'
                ? value === '' && optionalNumberFields.has(name)
                    ? undefined
                    : Number(value)
                : value;

        setFormState(prev => ({
            ...prev,
            [name]: fieldValue,
        }));
        clearError(name);
    };

    const handleModelProfileChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const modelId = event.target.value;
        setSelectedModelId(modelId);

        if (!modelId) {
            setFormState(prev => ({
                ...prev,
                modelId: undefined,
                modelProfileChangeReason: null,
                modelProfileChangeNotes: '',
                modelProfileChangeFields: [],
                modelProfileSnapshot: null,
            }));
            return;
        }

        const profile = availableModels.find(model => model.id === modelId);
        if (!profile) {
            return;
        }

        const primaryImage = profile.image_url?.trim() || '';
        const profileGallery = (profile.imageGallery ?? []).filter(Boolean).slice(0, galleryLimit);

        setFormState(prev => {
            const generatedTitle = `${prev.year || new Date().getFullYear()} ${getModelProfileLabel(profile)}`.trim();
            const shouldUseProfileImage = Boolean(primaryImage) && !imageFile;
            const shouldUseProfileGallery = profileGallery.length > 0 && galleryDrafts.length === 0;

            return {
                ...prev,
                modelId: profile.id,
                title: prev.title.trim() ? prev.title : generatedTitle,
                make: profile.brand || prev.make,
                model: profile.model_name || prev.model,
                bodyType: profile.body_type || prev.bodyType,
                batteryCapacity: profile.battery_capacity ?? prev.batteryCapacity,
                range: profile.range_wltp ?? prev.range,
                images: shouldUseProfileImage ? [primaryImage] : prev.images,
                imageGallery: shouldUseProfileGallery ? profileGallery : prev.imageGallery,
                modelProfileChangeReason: null,
                modelProfileChangeNotes: '',
                modelProfileChangeFields: [],
                modelProfileSnapshot: getModelProfileSnapshot(profile),
            };
        });

        if (primaryImage && !imageFile) {
            setImagePreview(primaryImage);
        }

        if (profileGallery.length > 0 && galleryDrafts.length === 0) {
            setExistingGallery(profileGallery);
        }

        clearError('make');
        clearError('model');
    };

    const handleLocationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormState(prev => ({
            ...prev,
            location: {
                ...(prev.location ?? {}),
                [name]: value,
            },
        }));
    };

    const handleFinancialNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormState(prev => ({
            ...prev,
            financialOptions: {
                ...(prev.financialOptions ?? {}),
                [name]: value === '' ? undefined : Number(value),
            },
        }));
    };

    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;

        if (name === 'isForRent' || name === 'isForSubscription') {
            setFormState(prev => ({
                ...prev,
                [name]: checked,
            }));
            return;
        }

        setFormState(prev => ({
            ...prev,
            financialOptions: {
                ...(prev.financialOptions ?? {}),
                [name]: checked,
            },
        }));
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        if (imagePreviewObjectUrlRef.current) {
            URL.revokeObjectURL(imagePreviewObjectUrlRef.current);
        }

        const preview = URL.createObjectURL(file);
        imagePreviewObjectUrlRef.current = preview;
        setImageFile(file);
        setImagePreview(preview);
        clearError('image');
    };

    const handleMainImageRemove = () => {
        if (imagePreviewObjectUrlRef.current) {
            URL.revokeObjectURL(imagePreviewObjectUrlRef.current);
            imagePreviewObjectUrlRef.current = null;
        }

        setImageFile(null);
        setImagePreview('');
        setFormState(prev => ({
            ...prev,
            images: [],
        }));
    };

    const handleGalleryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []) as File[];
        if (files.length === 0) {
            return;
        }

        const availableSlots = Math.max(0, galleryLimit - existingGallery.length - galleryDrafts.length);
        if (availableSlots <= 0) {
            setErrors(prev => ({
                ...prev,
                gallery: t('dealerListingsPage.form.galleryLimit', { count: galleryLimit }),
            }));
            event.target.value = '';
            return;
        }

        const selectedFiles = files.slice(0, availableSlots);
        if (selectedFiles.length < files.length) {
            setErrors(prev => ({
                ...prev,
                gallery: t('dealerListingsPage.form.galleryLimit', { count: galleryLimit }),
            }));
        } else {
            clearError('gallery');
        }

        const newDrafts = selectedFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file),
        }));
        setGalleryDrafts(prev => [...prev, ...newDrafts]);
        event.target.value = '';
    };

    const removeGalleryDraft = (index: number) => {
        setGalleryDrafts(prev => {
            const draft = prev[index];
            if (draft) {
                URL.revokeObjectURL(draft.preview);
            }
            return prev.filter((_, draftIndex) => draftIndex !== index);
        });
        clearError('gallery');
    };

    const removeExistingGalleryImage = (url: string) => {
        setExistingGallery(prev => prev.filter(image => image !== url));
        clearError('gallery');
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        const requiredMessage = t('dealerListingsPage.form.required');
        const yearMax = new Date().getFullYear() + 2;

        if (!formState.make.trim()) newErrors.make = requiredMessage;
        if (!formState.model.trim()) newErrors.model = requiredMessage;
        if (!formState.year || formState.year < 1900 || formState.year > yearMax) newErrors.year = requiredMessage;
        if (!formState.price || formState.price <= 0) newErrors.price = requiredMessage;
        if (requiresModelProfileChangeReason && !formState.modelProfileChangeReason) {
            newErrors.modelProfileChangeReason = t('dealerListingsPage.form.modelChangeReasonRequired', {
                defaultValue: 'Choose why the listing differs from the selected model card.',
            });
        }
        if (
            requiresModelProfileChangeReason &&
            formState.modelProfileChangeReason === 'other' &&
            !formState.modelProfileChangeNotes?.trim()
        ) {
            newErrors.modelProfileChangeNotes = t('dealerListingsPage.form.modelChangeNotesRequired', {
                defaultValue: 'Add notes when choosing Other.',
            });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!validate()) {
            return;
        }

        const city = formState.location?.city?.trim();
        const address = formState.location?.address?.trim();
        const location = city || address
            ? {
                ...(formState.location?.lat !== undefined ? { lat: formState.location.lat } : {}),
                ...(formState.location?.lng !== undefined ? { lng: formState.location.lng } : {}),
                ...(city ? { city } : {}),
                ...(address ? { address } : {}),
            }
            : undefined;

        const monthlyPaymentEstimate = sanitizeOptionalNumber(formState.financialOptions?.monthlyPaymentEstimate);
        const financialOptions =
            formState.financialOptions?.loanSupported ||
            formState.financialOptions?.leasingSupported ||
            monthlyPaymentEstimate
                ? {
                    loanSupported: Boolean(formState.financialOptions?.loanSupported),
                    leasingSupported: Boolean(formState.financialOptions?.leasingSupported),
                    ...(monthlyPaymentEstimate ? { monthlyPaymentEstimate } : {}),
                }
                : undefined;

        const generatedTitle = `${formState.year} ${formState.make.trim()} ${formState.model.trim()}`.trim();
        const values: ListingFormValues = {
            ...formState,
            title: formState.title.trim() || generatedTitle,
            description: formState.description.trim(),
            make: formState.make.trim(),
            model: formState.model.trim(),
            bodyType: formState.bodyType.trim(),
            fuelType: formState.fuelType.trim(),
            modelId: formState.modelId || undefined,
            batteryCapacity: sanitizeOptionalNumber(formState.batteryCapacity),
            range: sanitizeOptionalNumber(formState.range),
            modelProfileChangeReason: requiresModelProfileChangeReason
                ? formState.modelProfileChangeReason
                : null,
            modelProfileChangeNotes: requiresModelProfileChangeReason
                ? formState.modelProfileChangeNotes?.trim() || undefined
                : undefined,
            modelProfileChangeFields: requiresModelProfileChangeReason ? modifiedModelProfileFields : [],
            modelProfileSnapshot: selectedModelProfile ? getModelProfileSnapshot(selectedModelProfile) : null,
            location,
            financialOptions,
            imageFile,
            galleryFiles: galleryDrafts.map(draft => draft.file),
            imageGallery: existingGallery,
        };

        await onSubmit(values);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <section className="space-y-4">
                <div>
                    <h3 className="text-base font-semibold text-white">{t('dealerListingsPage.form.sections.vehicle')}</h3>
                    <p className="mt-1 text-sm text-gray-400">{t('dealerListingsPage.form.sections.vehicleHelp')}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <label htmlFor="listing-model-profile" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('dealerListingsPage.form.modelProfile')}
                        </label>
                        <select
                            id="listing-model-profile"
                            value={selectedModelId}
                            onChange={handleModelProfileChange}
                            disabled={availableModels.length === 0}
                            className={selectClass}
                        >
                            <option value="">{t('dealerListingsPage.form.modelProfilePlaceholder')}</option>
                            {availableModels.map(model => {
                                const specs = [
                                    model.year_start ? String(model.year_start) : '',
                                    model.range_wltp ? `${model.range_wltp} km` : '',
                                ].filter(Boolean).join(' - ');
                                const label = getModelProfileLabel(model);
                                return (
                                    <option key={model.id} value={model.id}>
                                        {specs ? `${label} (${specs})` : label}
                                    </option>
                                );
                            })}
                        </select>
                        <p className="mt-2 text-xs text-gray-400">
                            {availableModels.length > 0
                                ? t('dealerListingsPage.form.modelProfileHelp')
                                : t('dealerListingsPage.form.modelProfileUnavailable')}
                        </p>
                        {selectedModelProfile && (
                            <p className="mt-2 text-xs font-medium text-gray-cyan">
                                {t('dealerListingsPage.form.modelProfileApplied', { model: selectedModelLabel })}
                            </p>
                        )}
                        {selectedModelProfile && (
                            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-white">
                                            {t('dealerListingsPage.form.modelGovernanceTitle', {
                                                defaultValue: 'Model-card governance',
                                            })}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-gray-400">
                                            {t('dealerListingsPage.form.modelGovernanceHelp', {
                                                defaultValue:
                                                    'If you change technical fields copied from the selected model card, explain why. This keeps the canonical catalog separate from dealer-specific listing data.',
                                            })}
                                        </p>
                                    </div>
                                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                        requiresModelProfileChangeReason
                                            ? 'bg-amber-500/15 text-amber-200'
                                            : 'bg-emerald-500/15 text-emerald-200'
                                    }`}>
                                        {requiresModelProfileChangeReason
                                            ? t('dealerListingsPage.form.modelChangesDetected', {
                                                defaultValue: 'Changes detected',
                                            })
                                            : t('dealerListingsPage.form.modelChangesNone', {
                                                defaultValue: 'No catalog changes',
                                            })}
                                    </span>
                                </div>

                                {modifiedModelProfileFields.length > 0 && (
                                    <p className="mt-3 text-xs text-gray-300">
                                        {t('dealerListingsPage.form.modifiedModelFields', {
                                            defaultValue: 'Changed fields: {{fields}}',
                                            fields: modifiedModelProfileFields.join(', '),
                                        })}
                                    </p>
                                )}

                                {requiresModelProfileChangeReason && (
                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label htmlFor="listing-model-change-reason" className="mb-1 block text-sm font-medium text-gray-300">
                                                {t('dealerListingsPage.form.modelChangeReason', {
                                                    defaultValue: 'Why is listing data different?',
                                                })}
                                            </label>
                                            <select
                                                id="listing-model-change-reason"
                                                name="modelProfileChangeReason"
                                                value={formState.modelProfileChangeReason ?? ''}
                                                onChange={handleChange}
                                                aria-invalid={Boolean(errors.modelProfileChangeReason)}
                                                className={selectClass}
                                            >
                                                <option value="">
                                                    {t('dealerListingsPage.form.modelChangeReasonPlaceholder', {
                                                        defaultValue: 'Choose a reason',
                                                    })}
                                                </option>
                                                {modelProfileChangeReasonOptions.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {t(option.labelKey, { defaultValue: option.defaultLabel })}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.modelProfileChangeReason && (
                                                <p className="mt-1 text-xs text-red-400">{errors.modelProfileChangeReason}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label htmlFor="listing-model-change-notes" className="mb-1 block text-sm font-medium text-gray-300">
                                                {t('dealerListingsPage.form.modelChangeNotes', {
                                                    defaultValue: 'Notes for admin review',
                                                })}
                                            </label>
                                            <textarea
                                                id="listing-model-change-notes"
                                                name="modelProfileChangeNotes"
                                                value={formState.modelProfileChangeNotes ?? ''}
                                                onChange={handleChange}
                                                rows={3}
                                                aria-invalid={Boolean(errors.modelProfileChangeNotes)}
                                                placeholder={t('dealerListingsPage.form.modelChangeNotesPlaceholder', {
                                                    defaultValue:
                                                        'Required for Other. Recommended when the selected catalog card appears wrong.',
                                                })}
                                                className={inputClass}
                                            />
                                            {errors.modelProfileChangeNotes && (
                                                <p className="mt-1 text-xs text-red-400">{errors.modelProfileChangeNotes}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="md:col-span-2">
                        <label htmlFor="listing-title" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('dealerListingsPage.form.title')}
                        </label>
                        <input
                            id="listing-title"
                            type="text"
                            name="title"
                            value={formState.title}
                            onChange={handleChange}
                            placeholder={t('dealerListingsPage.form.titlePlaceholder')}
                            autoComplete="off"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="listing-make" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('admin.make')}
                        </label>
                        <input
                            id="listing-make"
                            type="text"
                            name="make"
                            value={formState.make}
                            onChange={handleChange}
                            required
                            autoComplete="organization"
                            aria-invalid={Boolean(errors.make)}
                            className={inputClass}
                        />
                        {errors.make && <p className="mt-1 text-xs text-red-400">{errors.make}</p>}
                    </div>

                    <div>
                        <label htmlFor="listing-model" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('admin.model')}
                        </label>
                        <input
                            id="listing-model"
                            type="text"
                            name="model"
                            value={formState.model}
                            onChange={handleChange}
                            required
                            autoComplete="off"
                            aria-invalid={Boolean(errors.model)}
                            className={inputClass}
                        />
                        {errors.model && <p className="mt-1 text-xs text-red-400">{errors.model}</p>}
                    </div>

                    <div>
                        <label htmlFor="listing-year" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('admin.year')}
                        </label>
                        <input
                            id="listing-year"
                            type="number"
                            name="year"
                            value={formState.year}
                            onChange={handleChange}
                            min={1900}
                            max={new Date().getFullYear() + 2}
                            required
                            inputMode="numeric"
                            aria-invalid={Boolean(errors.year)}
                            className={inputClass}
                        />
                        {errors.year && <p className="mt-1 text-xs text-red-400">{errors.year}</p>}
                    </div>

                    <div>
                        <label htmlFor="listing-mileage" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('admin.mileage')}
                        </label>
                        <input
                            id="listing-mileage"
                            type="number"
                            name="mileage"
                            value={formState.mileage}
                            onChange={handleChange}
                            min={0}
                            inputMode="numeric"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="listing-body-type" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('listings.fields.bodyType')}
                        </label>
                        <select
                            id="listing-body-type"
                            name="bodyType"
                            value={formState.bodyType}
                            onChange={handleChange}
                            className={selectClass}
                        >
                            {visibleBodyTypeOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="listing-fuel-type" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('listings.fields.fuelType')}
                        </label>
                        <select
                            id="listing-fuel-type"
                            name="fuelType"
                            value={formState.fuelType}
                            onChange={handleChange}
                            className={selectClass}
                        >
                            {visibleFuelTypeOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="listing-battery" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('dealerListingsPage.form.batteryCapacity')}
                        </label>
                        <input
                            id="listing-battery"
                            type="number"
                            name="batteryCapacity"
                            value={formState.batteryCapacity ?? ''}
                            onChange={handleChange}
                            min={0}
                            inputMode="decimal"
                            placeholder="75"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="listing-range" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('dealerListingsPage.form.range')}
                        </label>
                        <input
                            id="listing-range"
                            type="number"
                            name="range"
                            value={formState.range ?? ''}
                            onChange={handleChange}
                            min={0}
                            inputMode="numeric"
                            placeholder="450"
                            className={inputClass}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label htmlFor="listing-description" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('dealerListingsPage.form.description')}
                        </label>
                        <textarea
                            id="listing-description"
                            name="description"
                            value={formState.description}
                            onChange={handleChange}
                            rows={4}
                            placeholder={t('dealerListingsPage.form.descriptionPlaceholder')}
                            className={inputClass}
                        />
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <div>
                    <h3 className="text-base font-semibold text-white">{t('dealerListingsPage.form.sections.price')}</h3>
                    <p className="mt-1 text-sm text-gray-400">{t('dealerListingsPage.form.sections.priceHelp')}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label htmlFor="listing-price" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('admin.price')}
                        </label>
                        <input
                            id="listing-price"
                            type="number"
                            name="price"
                            value={formState.price}
                            onChange={handleChange}
                            min={0}
                            required
                            inputMode="decimal"
                            aria-invalid={Boolean(errors.price)}
                            className={inputClass}
                        />
                        {errors.price && <p className="mt-1 text-xs text-red-400">{errors.price}</p>}
                    </div>

                    <div>
                        <label htmlFor="listing-currency" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('admin.currency')}
                        </label>
                        <select
                            id="listing-currency"
                            name="priceCurrency"
                            value={formState.priceCurrency}
                            onChange={handleChange}
                            className={selectClass}
                        >
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="ALL">ALL</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="listing-monthly-payment" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('dealerListingsPage.form.monthlyPaymentEstimate')}
                        </label>
                        <input
                            id="listing-monthly-payment"
                            type="number"
                            name="monthlyPaymentEstimate"
                            value={formState.financialOptions?.monthlyPaymentEstimate ?? ''}
                            onChange={handleFinancialNumberChange}
                            min={0}
                            inputMode="decimal"
                            placeholder="399"
                            className={inputClass}
                        />
                    </div>

                    <div className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
                        <label className="flex items-start gap-3 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                name="loanSupported"
                                checked={Boolean(formState.financialOptions?.loanSupported)}
                                onChange={handleCheckboxChange}
                                className={checkboxClass}
                            />
                            <span>{t('dealerListingsPage.form.loanSupported')}</span>
                        </label>
                        <label className="flex items-start gap-3 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                name="leasingSupported"
                                checked={Boolean(formState.financialOptions?.leasingSupported)}
                                onChange={handleCheckboxChange}
                                className={checkboxClass}
                            />
                            <span>{t('dealerListingsPage.form.leasingSupported')}</span>
                        </label>
                        <label className="flex items-start gap-3 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                name="isForRent"
                                checked={Boolean(formState.isForRent)}
                                onChange={handleCheckboxChange}
                                className={checkboxClass}
                            />
                            <span>{t('dealerListingsPage.form.availableForRent')}</span>
                        </label>
                        <label className="flex items-start gap-3 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                name="isForSubscription"
                                checked={Boolean(formState.isForSubscription)}
                                onChange={handleCheckboxChange}
                                className={checkboxClass}
                            />
                            <span>{t('dealerListingsPage.form.availableForSubscription')}</span>
                        </label>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <div>
                    <h3 className="text-base font-semibold text-white">{t('dealerListingsPage.form.sections.location')}</h3>
                    <p className="mt-1 text-sm text-gray-400">{t('dealerListingsPage.form.sections.locationHelp')}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label htmlFor="listing-location-city" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('dealerListingsPage.form.city')}
                        </label>
                        <input
                            id="listing-location-city"
                            type="text"
                            name="city"
                            value={formState.location?.city ?? ''}
                            onChange={handleLocationChange}
                            autoComplete="address-level2"
                            placeholder={t('dealerDashboardPage.fields.cityPlaceholder')}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label htmlFor="listing-location-address" className="mb-1 block text-sm font-medium text-gray-300">
                            {t('dealerListingsPage.form.address')}
                        </label>
                        <input
                            id="listing-location-address"
                            type="text"
                            name="address"
                            value={formState.location?.address ?? ''}
                            onChange={handleLocationChange}
                            autoComplete="street-address"
                            placeholder={t('dealerDashboardPage.fields.streetAddressPlaceholder')}
                            className={inputClass}
                        />
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <div>
                    <h3 className="text-base font-semibold text-white">{t('dealerListingsPage.form.sections.media')}</h3>
                    <p className="mt-1 text-sm text-gray-400">{t('dealerListingsPage.form.sections.mediaHelp')}</p>
                </div>

                <div>
                    <label htmlFor="listing-main-image" className="mb-2 block text-sm font-medium text-gray-300">
                        {t('admin.mainImage')}
                    </label>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        {imagePreview ? (
                            <img
                                src={imagePreview}
                                alt={t('dealerListingsPage.form.mainImagePreview')}
                                className="h-28 w-full max-w-[180px] rounded-lg border border-white/10 object-cover"
                            />
                        ) : (
                            <div className="flex h-28 w-full max-w-[180px] items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5 text-sm text-gray-500">
                                {t('dealerListingsPage.noImage')}
                            </div>
                        )}
                        <div className="flex-1 space-y-2">
                            <input
                                id="listing-main-image"
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-cyan file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-900 hover:file:bg-cyan-400"
                            />
                            {imagePreview && (
                                <button
                                    type="button"
                                    onClick={handleMainImageRemove}
                                    className="text-sm text-gray-400 transition hover:text-white"
                                >
                                    {t('dealerListingsPage.form.removeMainImage')}
                                </button>
                            )}
                            <p className="text-xs text-gray-500">{t('dealerListingsPage.form.mainImageHint')}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="listing-gallery" className="mb-2 block text-sm font-medium text-gray-300">
                        {t('admin.gallery')}
                    </label>
                    <div className="mb-3 flex flex-wrap gap-2">
                        {existingGallery.map((url, index) => (
                            <div key={url} className="relative">
                                <img
                                    src={url}
                                    alt={t('dealerListingsPage.form.galleryImage', { index: index + 1 })}
                                    className="h-20 w-20 rounded-lg border border-white/10 object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeExistingGalleryImage(url)}
                                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-red-500 text-sm font-bold text-white"
                                    aria-label={t('dealerListingsPage.form.removeGalleryImage', { index: index + 1 })}
                                >
                                    <span aria-hidden="true">x</span>
                                </button>
                            </div>
                        ))}
                        {galleryDrafts.map((draft, index) => (
                            <div key={draft.preview} className="relative">
                                <img
                                    src={draft.preview}
                                    alt={t('dealerListingsPage.form.galleryDraft', { index: index + 1 })}
                                    className="h-20 w-20 rounded-lg border border-white/10 object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeGalleryDraft(index)}
                                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-red-500 text-sm font-bold text-white"
                                    aria-label={t('dealerListingsPage.form.removeDraftImage', { index: index + 1 })}
                                >
                                    <span aria-hidden="true">x</span>
                                </button>
                            </div>
                        ))}
                    </div>
                    <input
                        id="listing-gallery"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleGalleryChange}
                        disabled={totalGalleryCount >= galleryLimit}
                        className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-cyan file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-900 hover:file:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                        {t('dealerListingsPage.form.galleryHint', {
                            count: galleryLimit,
                            current: totalGalleryCount,
                        })}
                    </p>
                    {errors.gallery && <p className="mt-1 text-xs text-red-400">{errors.gallery}</p>}
                </div>
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    className="w-full rounded-lg px-4 py-2 text-gray-300 transition hover:text-white sm:w-auto"
                >
                    {t('common.cancel')}
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-gray-cyan px-6 py-2 font-semibold text-gray-900 transition hover:bg-cyan-400 disabled:opacity-50 sm:w-auto"
                >
                    {isSubmitting
                        ? t('dealerListingsPage.form.savingListing')
                        : t('dealerListingsPage.form.saveListing')}
                </button>
            </div>
        </form>
    );
};

export default ListingForm;
