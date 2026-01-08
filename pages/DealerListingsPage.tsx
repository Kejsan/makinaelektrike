import React, { useContext, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { ToastContext } from '../contexts/ToastContext';
import ListingForm, { ListingFormValues } from '../components/dashboard/ListingForm';
import { Listing } from '../types';
import ModalLayout from '../components/ModalLayout';
import SEO from '../components/SEO';
import { 
    Plus, 
    Edit, 
    Trash2, 
    Eye, 
    EyeOff, 
    ChevronLeft,
    Clock,
    CheckCircle,
    AlertCircle,
    XCircle
} from 'lucide-react';
import { uploadListingImage, uploadListingGalleryImage } from '../services/listings';
import { Link } from 'react-router-dom';

const DealerListingsPage: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);
    const { listings, dealers, addListing, updateListing, deleteListing } = useContext(DataContext);
    const { addToast } = useContext(ToastContext);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingListing, setEditingListing] = useState<Listing | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const dealer = useMemo(() => {
        if (!user) return undefined;
        return (
            dealers.find(entry => entry.ownerUid === user.uid) ||
            dealers.find(entry => entry.id === user.uid)
        );
    }, [dealers, user]);

    // Filter listings for the current dealer
    const dealerListings = useMemo(() => {
        if (!dealer) return [];
        return listings.filter(l => l.dealerId === dealer.id && l.status !== 'deleted');
    }, [dealer, listings]);

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

    const handleToggleStatus = async (listing: Listing) => {
        const newStatus = listing.status === 'active' ? 'inactive' : 'active';
        try {
            await updateListing(listing.id, { status: newStatus as any });
            addToast(t('common.statusUpdated', { defaultValue: 'Status updated successfully' }), 'success');
        } catch (error) {
            console.error("Status update failed", error);
            addToast(t('common.updateFailed', { defaultValue: 'Update failed' }), 'error');
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'approved':
                return { icon: <CheckCircle className="h-3 w-3" />, className: 'bg-green-500/10 text-green-400', label: 'Approved' };
            case 'active':
                return { icon: <Eye className="h-3 w-3" />, className: 'bg-cyan-500/10 text-gray-cyan', label: 'Active' };
            case 'inactive':
                return { icon: <EyeOff className="h-3 w-3" />, className: 'bg-yellow-500/10 text-yellow-400', label: 'Inactive' };
            case 'pending':
                return { icon: <Clock className="h-3 w-3" />, className: 'bg-blue-500/10 text-blue-400', label: 'Pending' };
            case 'rejected':
                return { icon: <XCircle className="h-3 w-3" />, className: 'bg-red-500/10 text-red-400', label: 'Rejected' };
            default:
                return { icon: <AlertCircle className="h-3 w-3" />, className: 'bg-gray-500/10 text-gray-400', label: status };
        }
    };

    const handleFormSubmit = async (values: ListingFormValues) => {
        if (!user || !dealer) {
            addToast(t('dealer.notFound', { defaultValue: 'Dealer profile not found.' }), 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            let mainImageUrl = values.images?.[0];

            // Upload main image if provided
            if (values.imageFile) {
                // We need an ID for storage path, use temp or existing
                const storageId = values.id || `temp_${Date.now()}`;
                mainImageUrl = await uploadListingImage(dealer.id, storageId, values.imageFile);
            }

            // Upload gallery images
            const galleryUrls = [...(values.imageGallery || [])];
            if (values.galleryFiles && values.galleryFiles.length > 0) {
                const storageId = values.id || `temp_${Date.now()} `;
                const newUrls = await Promise.all(
                    values.galleryFiles.map((file: File) => uploadListingGalleryImage(dealer.id, storageId, file))
                );
                galleryUrls.push(...newUrls);
            }

            const payload = {
                ...values,
                images: mainImageUrl ? [mainImageUrl] : values.images,
                imageGallery: galleryUrls,
                dealerId: dealer.id,
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
            <div className="mb-6">
                <Link to="/dealer/dashboard" className="text-gray-400 hover:text-gray-cyan flex items-center gap-2 text-sm transition-colors group">
                    <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboard
                </Link>
            </div>
            <SEO title="Manage Listings | Dealer Dashboard" description="Manage your car listings" />

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">{t('dealer.listings', { defaultValue: 'My Listings' })}</h1>
                <button
                    onClick={handleCreate}
                    className="bg-gray-cyan text-gray-900 px-6 py-2.5 rounded-xl font-bold hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(79,248,210,0.2)] flex items-center gap-2"
                >
                    <Plus className="h-5 w-5" />
                    {t('dealer.addListing', { defaultValue: 'Add Listing' })}
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
                                {(() => {
                                    const info = getStatusInfo(listing.status);
                                    return (
                                        <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border border-white/5 flex items-center gap-1.5 ${info.className}`}>
                                            {info.icon}
                                            {info.label}
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="space-y-1">
                                    <h3 className="font-bold text-lg leading-tight group-hover:text-gray-cyan transition-colors truncate">
                                        {listing.make} {listing.model}
                                    </h3>
                                    <div className="flex items-center justify-between text-sm text-gray-400">
                                        <span>{listing.year}</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-white/10"></span>
                                        <span>{listing.mileage.toLocaleString()} km</span>
                                    </div>
                                </div>

                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-gray-cyan tracking-tight">
                                        {listing.price.toLocaleString()}
                                    </span>
                                    <span className="text-xs font-bold text-gray-500 uppercase">{listing.priceCurrency}</span>
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-white/5">
                                    <button
                                        onClick={() => handleEdit(listing)}
                                        className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-gray-400 hover:text-white"
                                        title="Edit"
                                    >
                                        <Edit className="h-4 w-4" />
                                    </button>
                                    
                                    {(listing.status === 'active' || listing.status === 'inactive' || listing.status === 'approved') && (
                                        <button
                                            onClick={() => handleToggleStatus(listing)}
                                            className={`p-2.5 rounded-xl border border-white/5 transition-all flex-1 flex items-center justify-center gap-2 text-xs font-bold ${
                                                listing.status === 'active' 
                                                    ? 'bg-yellow-500/5 text-yellow-500/80 hover:bg-yellow-500/10' 
                                                    : 'bg-cyan-500/5 text-gray-cyan hover:bg-cyan-500/10'
                                            }`}
                                        >
                                            {listing.status === 'active' ? (
                                                <><EyeOff className="h-4 w-4" /> Deactivate</>
                                            ) : (
                                                <><Eye className="h-4 w-4" /> Activate</>
                                            )}
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleDelete(listing.id)}
                                        className="p-2.5 rounded-xl bg-red-500/5 border border-white/5 text-red-400/80 hover:bg-red-500/10 transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
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
