import React, { useContext, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DataContext } from '../contexts/DataContext';
import SEO from '../components/SEO';
import OptimizedImage from '../components/OptimizedImage';
import { useTranslation } from 'react-i18next';
import { MapPin, Gauge, ChevronLeft, ChevronRight, Phone, MessageSquare, ShieldCheck, ArrowLeft } from 'lucide-react';
import EnquiryModal from '../components/listings/EnquiryModal';
import { DEALERSHIP_PLACEHOLDER_IMAGE, MODEL_PLACEHOLDER_IMAGE } from '../constants/media';
import Link from '../components/LocalizedLink';

const ListingDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { listings, dealers, loading } = useContext(DataContext);
    const { t } = useTranslation();

    // Find listing
    const listing = useMemo(() => listings.find(l => l.id === id), [listings, id]);

    // Find dealer
    const dealer = useMemo(() => {
        if (!listing) return undefined;
        return dealers.find(d => d.id === listing.dealerId || d.ownerUid === listing.dealerId);
    }, [listing, dealers]);

    // Image gallery state
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-[#020817]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-cyan"></div>
            </div>
        );
    }

    if (!listing) {
        return (
            <div className="min-h-screen bg-[#020817] flex flex-col justify-center items-center text-white p-4">
                <h2 className="text-2xl font-bold mb-4">{t('listings.notFoundTitle')}</h2>
                <Link to="/listings" className="text-gray-cyan hover:underline">
                    {t('common.backToListings')}
                </Link>
            </div>
        );
    }

    const allImages = listing.images && listing.images.length > 0
        ? listing.images
        : [listing.image_url || MODEL_PLACEHOLDER_IMAGE]; // Fallback to legacy or placeholder

    // Add gallery images if they exist and are not already in listing.images (which should handle it, but just in case of data structure migration)
    if (listing.imageGallery && listing.imageGallery.length > 0) {
        // This depends on how we stored it. If listing.images includes all, we are good.
        // Assuming listing.images IS the main gallery array based on ListingForm
    }

    // Previous implementation might have used image_url as separate. 
    // ListingForm saves to `images` array. So `allImages` logic above should be fine.

    const displayImages = allImages;
    const specificationRows = [
        { label: t('listings.fields.make'), value: listing.make },
        { label: t('listings.fields.model'), value: listing.model },
        { label: t('listings.fields.year'), value: listing.year },
        { label: t('listings.fields.mileage'), value: `${listing.mileage.toLocaleString()} km` },
        { label: t('listings.fields.fuelType'), value: listing.fuelType },
        { label: t('listings.fields.transmission'), value: listing.transmission },
        { label: t('listings.fields.drivetrain'), value: listing.drivetrain },
        { label: t('listings.fields.bodyType'), value: listing.bodyType },
        { label: t('listings.fields.color'), value: listing.color },
        ...(listing.batteryCapacity
            ? [{ label: t('listings.fields.battery'), value: `${listing.batteryCapacity} kWh` }]
            : []),
        ...(listing.range
            ? [{ label: t('listings.fields.range'), value: `${listing.range} km` }]
            : []),
    ];

    const nextImage = () => setActiveImageIndex((prev) => (prev + 1) % displayImages.length);
    const prevImage = () => setActiveImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);

    return (
        <div className="min-h-screen bg-[#020817] text-white py-12">
            <SEO
                title={`${listing.make} ${listing.model} (${listing.year}) | Makina Elektrike`}
                description={listing.description || `Check out this ${listing.year} ${listing.make} ${listing.model} for sale.`}
                image={displayImages[0]}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Link to="/listings" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition">
                    <ArrowLeft size={20} />
                    {t('common.backToListings')}
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    {/* Left Column: Gallery */}
                    <div className="space-y-4">
                        <div className="relative aspect-[16/10] bg-black/40 rounded-3xl overflow-hidden border border-white/10 group">
                            <OptimizedImage
                                src={displayImages[activeImageIndex]}
                                alt={`${listing.make} ${listing.model}`}
                                fallbackSrc={MODEL_PLACEHOLDER_IMAGE}
                                priority
                                className="w-full h-full object-cover"
                            />

                            {displayImages.length > 1 && (
                                <>
                                    <button
                                        onClick={(e) => { e.preventDefault(); prevImage(); }}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-gray-cyan/80 p-2 rounded-full backdrop-blur text-white transition opacity-0 group-hover:opacity-100"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.preventDefault(); nextImage(); }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-gray-cyan/80 p-2 rounded-full backdrop-blur text-white transition opacity-0 group-hover:opacity-100"
                                    >
                                        <ChevronRight size={24} />
                                    </button>

                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-xs font-mono">
                                        {activeImageIndex + 1} / {displayImages.length}
                                    </div>
                                </>
                            )}
                        </div>

                        {displayImages.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {displayImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImageIndex(idx)}
                                        className={`relative w-24 aspect-[16/10] flex-shrink-0 rounded-lg overflow-hidden border-2 transition ${activeImageIndex === idx ? 'border-gray-cyan' : 'border-transparent opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <OptimizedImage src={img} fallbackSrc={MODEL_PLACEHOLDER_IMAGE} className="w-full h-full object-cover" alt="thumbnail" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Details */}
                    <div>
                        <div className="mb-6">
                            <h1 className="text-3xl md:text-4xl font-extrabold mb-2 text-white">
                                {listing.make} {listing.model}
                            </h1>
                            <div className="flex items-center gap-4 text-gray-400 text-sm">
                                <span className="bg-white/10 px-2 py-0.5 rounded">{listing.year}</span>
                                <span className="flex items-center gap-1"><Gauge size={14} /> {listing.mileage.toLocaleString()} km</span>
                                <span className="flex items-center gap-1"><MapPin size={14} /> {listing.location?.city}</span>
                            </div>
                        </div>

                        <div className="text-4xl font-mono text-gray-cyan font-bold mb-8">
                            {listing.price.toLocaleString()} {listing.priceCurrency}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <button
                                onClick={() => setIsEnquiryOpen(true)}
                                className="flex items-center justify-center gap-2 bg-gray-cyan text-gray-900 font-bold py-4 rounded-xl hover:bg-cyan-400 transition transform hover:-translate-y-0.5 shadow-lg shadow-cyan-500/20"
                            >
                                <MessageSquare size={20} />
                                {t('listings.contactSeller')}
                            </button>
                            {dealer?.contact_phone && (
                                <a
                                    href={`tel:${dealer.contact_phone}`}
                                    className="flex items-center justify-center gap-2 bg-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/20 transition border border-white/10"
                                    title={dealer.contact_phone}
                                >
                                    <Phone size={20} />
                                    {t('listings.callNow')}
                                </a>
                            )}
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                            <h3 className="text-lg font-bold mb-4 border-b border-white/10 pb-2">
                                {t('listings.specifications')}
                            </h3>
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                {specificationRows.map(row => (
                                    <React.Fragment key={row.label}>
                                        <div className="text-gray-400">{row.label}</div>
                                        <div className="font-medium text-right">{row.value}</div>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {listing.description && (
                            <div className="mb-8">
                                <h3 className="text-lg font-bold mb-4 text-white">
                                    {t('listings.description')}
                                </h3>
                                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm border-l-2 border-gray-cyan pl-4">
                                    {listing.description}
                                </p>
                            </div>
                        )}

                        {dealer && (
                            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
                                <OptimizedImage
                                    src={dealer.logo_url || dealer.image_url || DEALERSHIP_PLACEHOLDER_IMAGE}
                                    alt={dealer.name}
                                    fallbackSrc={DEALERSHIP_PLACEHOLDER_IMAGE}
                                    className="w-20 h-20 rounded-full object-cover bg-white"
                                />
                                <div className="text-center sm:text-left">
                                    <div className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">
                                        {t('listings.soldBy')}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{dealer.name}</h3>

                                    <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-sm text-gray-400">
                                        {dealer.isVerified && (
                                            <div className="flex items-center gap-1 text-green-400">
                                                <ShieldCheck size={14} /> {t('listings.verifiedDealer')}
                                            </div>
                                        )}
                                        <Link to={`/dealers/${dealer.id}`} className="text-gray-cyan hover:underline">
                                            {t('common.viewProfile')}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            <EnquiryModal
                listing={listing}
                dealer={dealer}
                isOpen={isEnquiryOpen}
                onClose={() => setIsEnquiryOpen(false)}
            />
        </div>
    );
};

export default ListingDetailPage;
