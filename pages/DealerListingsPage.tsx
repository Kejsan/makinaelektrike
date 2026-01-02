import React, { useContext, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { ToastContext } from '../contexts/ToastContext';
import ListingForm, { ListingFormValues } from '../components/dashboard/ListingForm';
import { Listing } from '../types';
import ModalLayout from '../components/ModalLayout';
import SEO from '../components/SEO';
import { uploadListingImage, uploadListingGalleryImage } from '../services/listings';

const DealerListingsPage: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);
    const { listings, addListing, updateListing, deleteListing } = useContext(DataContext);
    const { addToast } = useContext(ToastContext);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingListing, setEditingListing] = useState<Listing | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter listings for the current dealer
    const dealerListings = useMemo(() => {
        if (!user) return [];
        return listings.filter(l => l.dealerId === user.uid && !l.isDeleted);
    }, [listings, user]);

    const handleEdit = (listing: Listing) => {
        setEditingListing(listing);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingListing(undefined);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm(t('common.confirmDelete', { defaultValue: 'Are you sure you want to delete this listing?' }))) {
            try {
                await deleteListing(id);
                addToast(t('common.deletedSuccess', { defaultValue: 'Deleted successfully' }), 'success');
            } catch (error) {
                console.error("Delete failed", error);
                addToast(t('common.deleteFailed', { defaultValue: 'Delete failed' }), 'error');
            }
        }
    };

    const handleFormSubmit = async (values: ListingFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            let mainImageUrl = values.images?.[0];

            // Upload main image if provided
            if (values.imageFile) {
                // We need an ID for storage path, use temp or existing
                const storageId = values.id || `temp_${Date.now()}`;
                mainImageUrl = await uploadListingImage(user.uid, storageId, values.imageFile);
            }

            // Upload gallery images
            const galleryUrls = [...(values.imageGallery || [])];
            if (values.galleryFiles && values.galleryFiles.length > 0) {
                const storageId = values.id || `temp_${Date.now()} `;
                const newUrls = await Promise.all(
                    values.galleryFiles.map(file => uploadListingGalleryImage(user.uid, storageId, file))
                );
                galleryUrls.push(...newUrls);
            }

            const payload = {
                ...values,
                images: mainImageUrl ? [mainImageUrl] : values.images,
                imageGallery: galleryUrls,
                dealerId: user.uid,
            };

            // Ensure we don't pass File objects to Firestore
            delete (payload as any).imageFile;
            delete (payload as any).galleryFiles;

            if (values.id) {
                await updateListing(values.id, payload);
                addToast(t('common.updatedSuccess', { defaultValue: 'Listing updated successfully' }), 'success');
            } else {
                await addListing(payload as any); // Type assertion needed until strict type coherence
                addToast(t('common.createdSuccess', { defaultValue: 'Listing created successfully' }), 'success');
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Submit failed", error);
            addToast(t('common.saveFailed', { defaultValue: 'Failed to save listing' }), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-white">
            <SEO title="Manage Listings | Dealer Dashboard" description="Manage your car listings" />

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">{t('dealer.listings', { defaultValue: 'My Listings' })}</h1>
                <button
                    onClick={handleCreate}
                    className="bg-primary text-gray-900 px-4 py-2 rounded-lg font-semibold hover:bg-primary/90 transition"
                    style={{ backgroundColor: '#4ff8d2' }} // Hardcoded primary color fallback
                >
                    {t('dealer.addListing', { defaultValue: '+ Add Listing' })}
                </button>
            </div>

            {dealerListings.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-gray-400 text-lg mb-4">{t('dealer.noListings', { defaultValue: 'You have no listings yet.' })}</p>
                    <button
                        onClick={handleCreate}
                        className="text-primary hover:underline"
                        style={{ color: '#4ff8d2' }}
                    >
                        {t('dealer.createFirst', { defaultValue: 'Create your first listing' })}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dealerListings.map(listing => (
                        <div key={listing.id} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden group">
                            <div className="aspect-video relative overflow-hidden bg-gray-900">
                                {listing.images && listing.images[0] ? (
                                    <img
                                        src={listing.images[0]}
                                        alt={listing.model}
                                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        No Image
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-black/60 backdrop-blur-sm">
                                    {listing.status}
                                </div>
                            </div>
                            <div className="p-4 space-y-2">
                                <h3 className="font-bold text-lg truncate">{listing.make} {listing.model}</h3>
                                <p className="text-primary font-mono text-xl" style={{ color: '#4ff8d2' }}>
                                    {listing.price.toLocaleString()} {listing.currency}
                                </p>
                                <div className="flex justify-between text-sm text-gray-400">
                                    <span>{listing.year}</span>
                                    <span>{listing.mileage.toLocaleString()} km</span>
                                </div>

                                <div className="flex gap-2 pt-4 mt-2 border-t border-white/10">
                                    <button
                                        onClick={() => handleEdit(listing)}
                                        className="flex-1 py-2 text-center rounded bg-white/10 hover:bg-white/20 transition text-sm font-medium"
                                    >
                                        {t('common.edit', { defaultValue: 'Edit' })}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(listing.id)}
                                        className="flex-1 py-2 text-center rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-sm font-medium"
                                    >
                                        {t('common.delete', { defaultValue: 'Delete' })}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal for Form */}
            {isModalOpen && (
                <ModalLayout
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editingListing ? t('dealer.editListing', { defaultValue: 'Edit Listing' }) : t('dealer.newListing', { defaultValue: 'New Listing' })}
                >
                    <ListingForm
                        initialValues={editingListing}
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsModalOpen(false)}
                        isSubmitting={isSubmitting}
                    />
                </ModalLayout>
            )}
        </div>
    );
};

export default DealerListingsPage;
