import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContextCore';
import { ToastContext } from '../contexts/ToastContext';
import ListingForm, { ListingFormValues } from '../components/dashboard/ListingForm';
import { Listing, ListingStatus, Model } from '../types';
import ModalLayout from '../components/ModalLayout';
import SEO from '../components/SEO';
import { BASE_URL } from '../constants/seo';
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
    XCircle,
    Search
} from 'lucide-react';
import { uploadListingImage, uploadListingGalleryImage } from '../services/listings';
import Link from '../components/LocalizedLink';
import DashboardInfoTooltip from '../components/DashboardInfoTooltip';

const DealerListingsPage: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, profile } = useContext(AuthContext);
    const { listings, dealers, models, getModelsForDealer, addListing, updateListing, deleteListing } = useContext(DataContext);
    const { addToast } = useContext(ToastContext);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingListing, setEditingListing] = useState<Listing | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | ListingStatus>('all');

    const dealer = useMemo(() => {
        if (!user) return undefined;
        const dealerStaffDealerId =
            profile?.accountType === 'dealer_staff' && typeof profile.dealerId === 'string'
                ? profile.dealerId
                : null;
        return (
            dealers.find(entry => entry.ownerUid === user.uid) ||
            dealers.find(entry => entry.id === user.uid) ||
            (dealerStaffDealerId ? dealers.find(entry => entry.id === dealerStaffDealerId) : undefined)
        );
    }, [dealers, profile, user]);

    const availableListingModels: Model[] = useMemo(() => {
        const sortByName = (entries: Model[]) =>
            [...entries].sort((first, second) => {
                const brandComparison = (first.brand ?? '').localeCompare(second.brand ?? '', undefined, {
                    sensitivity: 'base',
                });
                if (brandComparison !== 0) {
                    return brandComparison;
                }
                return (first.model_name ?? '').localeCompare(second.model_name ?? '', undefined, {
                    sensitivity: 'base',
                });
            });

        if (!dealer) {
            return sortByName(models);
        }

        const assignedModels = getModelsForDealer(dealer.id);
        const assignedIds = new Set(assignedModels.map(model => model.id));
        const remainingModels = models.filter(model => !assignedIds.has(model.id));

        return [...sortByName(assignedModels), ...sortByName(remainingModels)];
    }, [dealer, getModelsForDealer, models]);

    // Filter listings for the current dealer
    const dealerListings = useMemo(() => {
        if (!dealer) return [];
        return listings.filter(l => l.dealerId === dealer.id && l.status !== 'deleted');
    }, [dealer, listings]);

    const listingCounts = useMemo(() => {
        return dealerListings.reduce<Record<string, number>>((counts, listing) => {
            counts[listing.status] = (counts[listing.status] || 0) + 1;
            return counts;
        }, {});
    }, [dealerListings]);

    const filteredListings = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return dealerListings.filter(listing => {
            const matchesStatus = statusFilter === 'all' || listing.status === statusFilter;
            if (!matchesStatus) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            return [
                listing.title,
                listing.make,
                listing.model,
                String(listing.year),
                listing.priceCurrency,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(normalizedSearch);
        });
    }, [dealerListings, searchTerm, statusFilter]);

    useEffect(() => {
        if (searchParams.get('new') === '1') {
            setEditingListing(undefined);
            setIsModalOpen(true);
        }
    }, [searchParams]);

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingListing(undefined);

        if (searchParams.has('new')) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('new');
            setSearchParams(nextParams, { replace: true });
        }
    };

    const handleEdit = (listing: Listing) => {
        setEditingListing(listing);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingListing(undefined);
        setIsModalOpen(true);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('new', '1');
        setSearchParams(nextParams, { replace: true });
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
                return {
                    icon: <CheckCircle className="h-3 w-3" />,
                    className: 'bg-green-500/10 text-green-400',
                    label: t('dealerListingsPage.statusApproved', { defaultValue: 'Approved' }),
                };
            case 'active':
                return { icon: <Eye className="h-3 w-3" />, className: 'bg-cyan-500/10 text-gray-cyan', label: t('admin.statusActive', { defaultValue: 'Active' }) };
            case 'inactive':
                return { icon: <EyeOff className="h-3 w-3" />, className: 'bg-yellow-500/10 text-yellow-400', label: t('admin.statusInactive', { defaultValue: 'Inactive' }) };
            case 'pending':
                return { icon: <Clock className="h-3 w-3" />, className: 'bg-blue-500/10 text-blue-400', label: t('admin.statusPending', { defaultValue: 'Pending' }) };
            case 'rejected':
                return { icon: <XCircle className="h-3 w-3" />, className: 'bg-red-500/10 text-red-400', label: t('admin.statusRejected', { defaultValue: 'Rejected' }) };
            default:
                return { icon: <AlertCircle className="h-3 w-3" />, className: 'bg-gray-500/10 text-gray-400', label: status };
        }
    };

    const statusFilterOptions: Array<{ value: 'all' | ListingStatus; label: string; count: number }> = [
        {
            value: 'all',
            label: t('dealerListingsPage.filters.all', { defaultValue: 'All' }),
            count: dealerListings.length,
        },
        {
            value: 'pending',
            label: t('admin.statusPending', { defaultValue: 'Pending' }),
            count: listingCounts.pending || 0,
        },
        {
            value: 'active',
            label: t('admin.statusActive', { defaultValue: 'Active' }),
            count: listingCounts.active || 0,
        },
        {
            value: 'inactive',
            label: t('admin.statusInactive', { defaultValue: 'Inactive' }),
            count: listingCounts.inactive || 0,
        },
        {
            value: 'approved',
            label: t('dealerListingsPage.statusApproved', { defaultValue: 'Approved' }),
            count: listingCounts.approved || 0,
        },
        {
            value: 'rejected',
            label: t('admin.statusRejected', { defaultValue: 'Rejected' }),
            count: listingCounts.rejected || 0,
        },
    ];

    const handleFormSubmit = async (values: ListingFormValues) => {
        if (!user || !dealer) {
            addToast(t('dealer.notFound', { defaultValue: 'Dealer profile not found.' }), 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            let mainImageUrl = values.images?.[0];
            const storageId = values.id || `temp_${Date.now()}`;

            // Upload main image if provided
            if (values.imageFile) {
                mainImageUrl = await uploadListingImage(dealer.id, storageId, values.imageFile);
            }

            // Upload gallery images
            const galleryUrls = [...(values.imageGallery || [])];
            if (values.galleryFiles && values.galleryFiles.length > 0) {
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
            closeModal();
        } catch (error) {
            console.error("Submit failed", error);
            addToast(t('common.saveFailed', { defaultValue: 'Failed to save listing' }), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-10 text-white sm:px-6 lg:px-8">
            <div className="mb-6">
                <Link to="/dealer/dashboard" className="text-gray-400 hover:text-gray-cyan flex items-center gap-2 text-sm transition-colors group">
                    <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    {t('dealerListingsPage.backToDashboard', { defaultValue: 'Back to dashboard' })}
                </Link>
            </div>
            <SEO
                title={t('dealerListingsPage.metaTitle', { defaultValue: 'Manage listings | Dealer dashboard' })}
                description={t('dealerListingsPage.metaDescription', { defaultValue: 'Manage your car listings.' })}
                canonical={`${BASE_URL}/dealer/listings/`}
                robots="noindex, nofollow"
            />

            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold">{t('dealer.listings', { defaultValue: 'My Listings' })}</h1>
                        <DashboardInfoTooltip
                            label={t('dealerListingsPage.tooltips.pageTitle', {
                                defaultValue: 'Dealer inventory manager for creating, editing, filtering, hiding, and deleting vehicle listings.',
                            })}
                        />
                    </div>
                    <p className="mt-2 max-w-2xl text-sm text-gray-400">
                        {t('dealerListingsPage.pageIntro', {
                            defaultValue: 'Create, review, and manage the vehicles buyers can discover on Makina Elektrike.',
                        })}
                    </p>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                    <button
                        type="button"
                        onClick={handleCreate}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-cyan px-6 py-2.5 font-bold text-gray-900 shadow-[0_0_20px_rgba(79,248,210,0.2)] transition-all hover:bg-cyan-400 sm:flex-none"
                    >
                        <Plus className="h-5 w-5" />
                        {t('dealer.addListing', { defaultValue: 'Add Listing' })}
                    </button>
                    <DashboardInfoTooltip
                        label={t('dealerListingsPage.tooltips.addListing', {
                            defaultValue: 'Open the listing form. New listings are submitted for review before they appear publicly.',
                        })}
                        side="left"
                    />
                </div>
            </div>

            <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-6">
                <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr] lg:items-center">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-cyan">
                            {t('dealerListingsPage.submissionLabel', { defaultValue: 'Listing submission' })}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                            <h2 className="text-2xl font-bold text-white">
                                {t('dealerListingsPage.submissionTitle', { defaultValue: 'Add a vehicle in a few guided steps' })}
                            </h2>
                            <DashboardInfoTooltip
                                label={t('dealerListingsPage.tooltips.submissionGuide', {
                                    defaultValue: 'Explains the core flow for publishing vehicles: details, price, media, then platform moderation.',
                                })}
                            />
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-300">
                            {t('dealerListingsPage.submissionDescription', {
                                defaultValue:
                                    'Start with the core vehicle data, add pricing and location, then upload clear images. New listings are saved as pending so the platform can review them before public promotion.',
                            })}
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {[
                            t('dealerListingsPage.submissionSteps.vehicle', { defaultValue: 'Vehicle details' }),
                            t('dealerListingsPage.submissionSteps.price', { defaultValue: 'Pricing and availability' }),
                            t('dealerListingsPage.submissionSteps.media', { defaultValue: 'Photos and review' }),
                        ].map((step, index) => (
                            <div key={step} className="rounded-xl border border-white/10 bg-gray-950/50 p-4">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-cyan text-sm font-black text-gray-950">
                                    {index + 1}
                                </span>
                                <p className="mt-3 text-sm font-semibold text-white">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {dealerListings.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-gray-400 text-lg mb-4">{t('dealer.noListings', { defaultValue: 'You have no listings yet.' })}</p>
                    <div className="inline-flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="text-primary hover:underline"
                            style={{ color: '#4ff8d2' }}
                        >
                            {t('dealer.createFirst', { defaultValue: 'Create your first listing' })}
                        </button>
                        <DashboardInfoTooltip
                            label={t('dealerListingsPage.tooltips.createFirstListing', {
                                defaultValue: 'Start the first listing for this dealership. You can save it as pending while completing media and details.',
                            })}
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex w-full items-center gap-2 lg:max-w-sm">
                                <div className="relative min-w-0 flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="search"
                                        value={searchTerm}
                                        onChange={event => setSearchTerm(event.target.value)}
                                        placeholder={t('dealerListingsPage.searchPlaceholder', {
                                            defaultValue: 'Search your listings...',
                                        })}
                                        className="w-full rounded-lg border border-white/10 bg-gray-950/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-gray-cyan focus:outline-none"
                                    />
                                </div>
                                <DashboardInfoTooltip
                                    label={t('dealerListingsPage.tooltips.searchListings', {
                                        defaultValue: 'Search your dealer inventory by title, make, model, year, or currency.',
                                    })}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
                                    {statusFilterOptions.map(option => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setStatusFilter(option.value)}
                                            className={`flex-none rounded-lg border px-3 py-2 text-xs font-bold transition ${
                                                statusFilter === option.value
                                                    ? 'border-gray-cyan bg-gray-cyan text-gray-900'
                                                    : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                                            }`}
                                            aria-pressed={statusFilter === option.value}
                                        >
                                            {option.label}
                                            <span className="ml-2 rounded bg-black/20 px-1.5 py-0.5">{option.count}</span>
                                        </button>
                                    ))}
                                </div>
                                <DashboardInfoTooltip
                                    label={t('dealerListingsPage.tooltips.statusFilters', {
                                        defaultValue: 'Filter listings by moderation and visibility state: pending, active, hidden, approved, or rejected.',
                                    })}
                                    side="left"
                                />
                            </div>
                        </div>
                    </div>

                    {filteredListings.length === 0 ? (
                        <div className="rounded-lg border border-white/10 bg-white/5 px-6 py-14 text-center">
                            <p className="text-gray-400">
                                {t('dealerListingsPage.noFilteredListings', {
                                    defaultValue: 'No listings match the current search or status filter.',
                                })}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {filteredListings.map(listing => (
                                <div key={listing.id} className="group overflow-hidden rounded-lg border border-white/10 bg-white/5">
                                    <div className="aspect-video relative overflow-hidden bg-gray-900">
                                        {listing.images && listing.images[0] ? (
                                            <img
                                                src={listing.images[0]}
                                                alt={t('dealerListingsPage.listingImageAlt', {
                                                    make: listing.make,
                                                    model: listing.model,
                                                    defaultValue: '{{make}} {{model}} listing image',
                                                })}
                                                className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                {t('dealerListingsPage.noImage', { defaultValue: 'No image' })}
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

                                        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                                            <DashboardInfoTooltip
                                                label={t('dealerListingsPage.tooltips.listingActions', {
                                                    defaultValue: 'Use these listing actions to edit details, temporarily hide an active listing, reactivate it, or delete it from your inventory.',
                                                })}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(listing)}
                                                className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-gray-400 hover:text-white"
                                                title={t('common.edit')}
                                                aria-label={t('dealerListingsPage.editListingAria', {
                                                    make: listing.make,
                                                    model: listing.model,
                                                    defaultValue: 'Edit {{make}} {{model}}',
                                                })}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>

                                            {(listing.status === 'active' || listing.status === 'inactive' || listing.status === 'approved') && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStatus(listing)}
                                                    className={`flex min-w-[8rem] flex-1 items-center justify-center gap-2 rounded-lg border border-white/5 p-2.5 text-xs font-bold transition-all ${listing.status === 'active'
                                                        ? 'bg-yellow-500/5 text-yellow-500/80 hover:bg-yellow-500/10'
                                                        : 'bg-cyan-500/5 text-gray-cyan hover:bg-cyan-500/10'
                                                        }`}
                                                    aria-label={listing.status === 'active'
                                                        ? t('dealerListingsPage.deactivateListingAria', {
                                                            make: listing.make,
                                                            model: listing.model,
                                                            defaultValue: 'Deactivate {{make}} {{model}}',
                                                        })
                                                        : t('dealerListingsPage.activateListingAria', {
                                                            make: listing.make,
                                                            model: listing.model,
                                                            defaultValue: 'Activate {{make}} {{model}}',
                                                        })}
                                                >
                                                    {listing.status === 'active' ? (
                                                        <><EyeOff className="h-4 w-4" /> {t('dealerListingsPage.deactivate', { defaultValue: 'Deactivate' })}</>
                                                    ) : (
                                                        <><Eye className="h-4 w-4" /> {t('dealerListingsPage.activate', { defaultValue: 'Activate' })}</>
                                                    )}
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(listing.id)}
                                                className="rounded-lg border border-white/5 bg-red-500/5 p-2.5 text-red-400/80 transition-all hover:bg-red-500/10"
                                                title={t('common.delete')}
                                                aria-label={t('dealerListingsPage.deleteListingAria', {
                                                    make: listing.make,
                                                    model: listing.model,
                                                    defaultValue: 'Delete {{make}} {{model}}',
                                                })}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal for Form */}
            {isModalOpen && (
                <ModalLayout
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    title={editingListing ? t('dealer.editListing', { defaultValue: 'Edit Listing' }) : t('dealer.newListing', { defaultValue: 'New Listing' })}
                >
                    <ListingForm
                        initialValues={editingListing}
                        availableModels={availableListingModels}
                        onSubmit={handleFormSubmit}
                        onCancel={closeModal}
                        isSubmitting={isSubmitting}
                    />
                </ModalLayout>
            )}
        </div>
    );
};

export default DealerListingsPage;
