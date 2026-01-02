import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Listing, ListingFinancialOptions } from '../../types';

export interface ListingFormValues extends Omit<Listing, 'id' | 'createdAt' | 'updatedAt' | 'dealerId'> {
    id?: string;
    imageFile?: File | null;
    galleryFiles?: File[];
}

interface ListingFormProps {
    initialValues?: Listing;
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
};

const ListingForm: React.FC<ListingFormProps> = ({ initialValues, onSubmit, onCancel, isSubmitting }) => {
    const { t } = useTranslation();
    const [formState, setFormState] = useState<ListingFormValues>(defaultState);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [galleryDrafts, setGalleryDrafts] = useState<{ file: File; preview: string }[]>([]);
    const [existingGallery, setExistingGallery] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (initialValues) {
            setFormState({
                ...initialValues,
                // Ensure arrays are initialized
                features: initialValues.features || [],
                images: initialValues.images || [],
                imageGallery: initialValues.imageGallery || [],
            });
            // Handle main image preview
            if (initialValues.images && initialValues.images.length > 0) {
                setImagePreview(initialValues.images[0]);
            }
            setExistingGallery(initialValues.imageGallery || []);
        }
    }, [initialValues]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormState(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value,
        }));
        // Clear error for field
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files) as File[];
            const newDrafts = files.map(file => ({
                file,
                preview: URL.createObjectURL(file),
            }));
            setGalleryDrafts(prev => [...prev, ...newDrafts]);
        }
    };

    const removeGalleryDraft = (index: number) => {
        setGalleryDrafts(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingGalleryImage = (url: string) => {
        setExistingGallery(prev => prev.filter(img => img !== url));
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formState.make) newErrors.make = t('admin.required');
        if (!formState.model) newErrors.model = t('admin.required');
        if (!formState.year) newErrors.year = t('admin.required');
        if (!formState.price) newErrors.price = t('admin.required');

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        const values = {
            ...formState,
            imageFile,
            galleryFiles: galleryDrafts.map(d => d.file),
            // Update existing gallery to exclude removed ones
            imageGallery: existingGallery,
        };

        await onSubmit(values);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.make', { defaultValue: 'Make' })}</label>
                    <input
                        type="text"
                        name="make"
                        value={formState.make}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    />
                    {errors.make && <p className="text-red-400 text-xs mt-1">{errors.make}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.model', { defaultValue: 'Model' })}</label>
                    <input
                        type="text"
                        name="model"
                        value={formState.model}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    />
                    {errors.model && <p className="text-red-400 text-xs mt-1">{errors.model}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.year', { defaultValue: 'Year' })}</label>
                    <input
                        type="number"
                        name="year"
                        value={formState.year}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    />
                    {errors.year && <p className="text-red-400 text-xs mt-1">{errors.year}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.mileage', { defaultValue: 'Mileage (km)' })}</label>
                    <input
                        type="number"
                        name="mileage"
                        value={formState.mileage}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.price', { defaultValue: 'Price' })}</label>
                    <input
                        type="number"
                        name="price"
                        value={formState.price}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    />
                    {errors.price && <p className="text-red-400 text-xs mt-1">{errors.price}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.currency', { defaultValue: 'Currency' })}</label>
                    <select
                        name="priceCurrency"
                        value={formState.priceCurrency}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="ALL">ALL</option>
                    </select>
                </div>
            </div>

            {/* Image Upload Section */}
            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-300">{t('admin.mainImage', { defaultValue: 'Main Image' })}</label>
                <div className="flex items-center gap-4">
                    {imagePreview && (
                        <img src={imagePreview} alt="Preview" className="h-24 w-32 object-cover rounded-md" />
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="text-gray-300"
                    />
                </div>

                <label className="block text-sm font-medium text-gray-300">{t('admin.gallery', { defaultValue: 'Gallery' })}</label>
                <div className="flex flex-wrap gap-2">
                    {existingGallery.map((url) => (
                        <div key={url} className="relative">
                            <img src={url} alt="Gallery" className="h-20 w-20 object-cover rounded-md" />
                            <button
                                type="button"
                                onClick={() => removeExistingGalleryImage(url)}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs"
                            >
                                X
                            </button>
                        </div>
                    ))}
                    {galleryDrafts.map((draft, idx) => (
                        <div key={idx} className="relative">
                            <img src={draft.preview} alt="Draft" className="h-20 w-20 object-cover rounded-md" />
                            <button
                                type="button"
                                onClick={() => removeGalleryDraft(idx)}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs"
                            >
                                X
                            </button>
                        </div>
                    ))}
                </div>
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryChange}
                    className="text-gray-300 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-cyan file:text-gray-900 hover:file:bg-cyan-400"
                />
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-white/10">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-lg text-gray-300 hover:text-white transition"
                >
                    {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 rounded-lg bg-gray-cyan text-gray-900 font-semibold hover:bg-cyan-400 transition disabled:opacity-50"
                >
                    {isSubmitting ? t('common.saving', { defaultValue: 'Saving...' }) : t('common.save', { defaultValue: 'Save Listing' })}
                </button>
            </div>
        </form>
    );
};

export default ListingForm;
