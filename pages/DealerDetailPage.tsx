import React, { useMemo, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dealer, Model } from '../types';
import { MapPin, Phone, Mail, Globe, ArrowLeft, Heart, ShieldCheck } from 'lucide-react';
import ModelCard from '../components/ModelCard';
import GoogleMap from '../components/GoogleMap';
import { useFavorites } from '../hooks/useFavorites';
import { DataContext } from '../contexts/DataContext';
import SEO from '../components/SEO';
import { BASE_URL } from '../constants/seo';
import { DEALERSHIP_PLACEHOLDER_IMAGE } from '../constants/media';
import GallerySection from '../components/GallerySection';

const DealerDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { dealers, loading, getModelsForDealer } = useContext(DataContext);
    const dealer = useMemo<Dealer | null>(() => (dealers.find(d => d.id === id) ?? null), [dealers, id]);
    const dealerModels = useMemo<Model[]>(() => (dealer ? getModelsForDealer(dealer.id) : []), [dealer, getModelsForDealer]);
    const faqItems = t('dealerDetails.faqItems', { returnObjects: true }) as Array<{ question: string; answer: string }>;
    const { isFavorite, toggleFavorite } = useFavorites();

    if (loading) return <div className="text-center py-10 text-white">Loading...</div>;
    if (!dealer) {
        return (
            <div className="text-center py-10 text-white">
                <SEO
                    title="Dealeri nuk u gjet | Makina Elektrike"
                    description="Dealeri i kërkuar nuk ekziston më ose është zhvendosur."
                    canonical={id ? `${BASE_URL}/dealers/${id}/` : `${BASE_URL}/dealers/`}
                    openGraph={{
                        title: 'Dealeri nuk u gjet | Makina Elektrike',
                        description: 'Dealeri i kërkuar nuk ekziston më ose është zhvendosur.',
                        url: id ? `${BASE_URL}/dealers/${id}/` : `${BASE_URL}/dealers/`,
                        type: 'business.business',
                    }}
                    twitter={{
                        title: 'Dealeri nuk u gjet | Makina Elektrike',
                        description: 'Dealeri i kërkuar nuk ekziston më ose është zhvendosur.',
                        site: '@makinaelektrike',
                    }}
                />
                Dealer not found.
            </div>
        );
    }

    const status = dealer.status ?? (dealer.approved === false ? 'pending' : 'approved');
    const isActive = dealer.isActive !== false;
    const isDeleted = dealer.isDeleted === true;
    const isApproved = status === 'approved';

    if (!isApproved || !isActive || isDeleted) {
        return (
            <div className="text-center py-10 text-white">
                <SEO
                    title={t('dealerDetails.notAvailableTitle', { defaultValue: 'Dealer unavailable' })}
                    description={t('dealerDetails.notAvailableDescription', {
                        defaultValue: 'This dealership is no longer available or is undergoing review.',
                    })}
                    canonical={id ? `${BASE_URL}/dealers/${id}/` : `${BASE_URL}/dealers/`}
                    openGraph={{
                        title: t('dealerDetails.notAvailableTitle', { defaultValue: 'Dealer unavailable' }),
                        description: t('dealerDetails.notAvailableDescription', {
                            defaultValue: 'This dealership is no longer available or is undergoing review.',
                        }),
                        url: id ? `${BASE_URL}/dealers/${id}/` : `${BASE_URL}/dealers/`,
                        type: 'business.business',
                    }}
                    twitter={{
                        title: t('dealerDetails.notAvailableTitle', { defaultValue: 'Dealer unavailable' }),
                        description: t('dealerDetails.notAvailableDescription', {
                            defaultValue: 'This dealership is no longer available or is undergoing review.',
                        }),
                        site: '@makinaelektrike',
                    }}
                />
                {t('dealerDetails.notAvailableMessage', {
                    defaultValue: 'This dealer is not currently active on Makina Elektrike.',
                })}
            </div>
        );
    }

    const favorited = isFavorite(dealer.id);
    const galleryImages = (dealer.imageGallery ?? []).filter(Boolean);
    const heroImage = dealer.logo_url || dealer.image_url || galleryImages[0] || DEALERSHIP_PLACEHOLDER_IMAGE;
    const displayAddress = dealer.location || [dealer.address, dealer.city].filter(Boolean).join(', ');
    const canonical = `${BASE_URL}/dealers/${dealer.id}/`;
    const description = t('dealerDetails.metaDescription', {
        name: dealer.name,
        city: dealer.location || dealer.city,
        brands: dealer.brands.join(', '),
        description: dealer.description ?? '',
    });
    const formattedBrands = dealer.brands?.length ? dealer.brands : [];
    const keywords = [
        dealer.name,
        dealer.city,
        ...formattedBrands,
        `${dealer.city} electric cars`,
        'Makina Elektrike dealer',
    ];
    
    // Safety check for coordinates
    const mapMarkers = (dealer.lat && dealer.lng) 
        ? [{ lat: Number(dealer.lat), lng: Number(dealer.lng), title: dealer.name }] 
        : [];

    const structuredData = [
        {
            '@context': 'https://schema.org',
            '@type': 'AutoDealer',
            name: dealer.name,
            url: canonical,
            image: heroImage,
            telephone: dealer.contact_phone ?? dealer.phone ?? undefined,
            email: dealer.contact_email ?? dealer.email ?? undefined,
            address: {
                '@type': 'PostalAddress',
                streetAddress: displayAddress || dealer.city,
                addressLocality: dealer.city,
                addressCountry: 'AL',
            },
            geo: (dealer.lat && dealer.lng) ? {
                '@type': 'GeoCoordinates',
                latitude: dealer.lat,
                longitude: dealer.lng,
            } : undefined,
            makesOffer: formattedBrands.map(brand => ({
                '@type': 'Offer',
                itemOffered: {
                    '@type': 'Product',
                    name: `${brand} electric vehicles`,
                },
            })),
        },
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map(item => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: item.answer,
                },
            })),
        },
    ];

    return (
        <div className="py-12">
            <SEO
                title={`${dealer.name} | ${t('dealerDetails.metaTitleSuffix')}`}
                description={description}
                keywords={keywords}
                canonical={canonical}
                openGraph={{
                    title: `${dealer.name} | ${t('dealerDetails.metaTitleSuffix')}`,
                    description,
                    url: canonical,
                    type: 'business.business',
                    images: [heroImage],
                }}
                twitter={{
                    title: `${dealer.name} | ${t('dealerDetails.metaTitleSuffix')}`,
                    description,
                    image: heroImage,
                    site: '@makinaelektrike',
                }}
                structuredData={structuredData}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Link to="/dealers" className="inline-flex items-center text-gray-cyan hover:underline mb-8 group">
                    <ArrowLeft size={18} className="mr-2 transform group-hover:-translate-x-1 transition-transform" />
                    {t('dealerDetails.backLink')}
                </Link>

                <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden">
                    <div className="lg:grid lg:grid-cols-3">
                        <div className="lg:col-span-2 relative">
                            <img src={heroImage} alt={dealer.name} className="w-full h-64 lg:h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent lg:bg-gradient-to-r"></div>
                        </div>

                        <div className="p-8 space-y-6 relative">
                            <button
                                onClick={() => toggleFavorite(dealer.id)}
                                className="absolute top-6 right-6 z-10 p-3 bg-white/10 rounded-full text-white hover:text-vivid-red transition-colors"
                                aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <Heart size={24} className={`${favorited ? 'fill-vivid-red text-vivid-red' : 'fill-transparent'}`} />
                            </button>
                            <h1 className="text-3xl font-extrabold text-white pr-12">{dealer.name}</h1>
                            <div className="flex flex-wrap gap-3">
                                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                                    <ShieldCheck size={14} />
                                    {t('dealerDetails.approved', { defaultValue: 'Approved dealer' })}
                                </span>
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-white">{t('dealerDetails.contactInfo')}</h2>
                                <p className="flex items-start text-gray-300">
                                    <MapPin className="text-gray-cyan mt-1 mr-3 flex-shrink-0" size={20} />
                                    <span>{displayAddress}</span>
                                </p>
                                {(dealer.contact_phone || dealer.phone) && (
                                    <p className="flex items-center text-gray-300">
                                        <Phone className="text-gray-cyan mr-3" size={20} />
                                        <a
                                            href={`tel:${dealer.contact_phone || dealer.phone}`}
                                            className="hover:underline"
                                        >
                                            {dealer.contact_phone || dealer.phone}
                                        </a>
                                    </p>
                                )}
                                {(dealer.contact_email || dealer.email) && (
                                    <p className="flex items-center text-gray-300">
                                        <Mail className="text-gray-cyan mr-3" size={20} />
                                        <a
                                            href={`mailto:${dealer.contact_email || dealer.email}`}
                                            className="hover:underline"
                                        >
                                            {dealer.contact_email || dealer.email}
                                        </a>
                                    </p>
                                )}
                                {dealer.website && <p className="flex items-center text-gray-300"><Globe className="text-gray-cyan mr-3" size={20} /><a href={dealer.website} target="_blank" rel="noopener noreferrer" className="hover:underline">Visit Website</a></p>}
                            </div>

                            {dealer.description && (
                                <div>
                                    <h3 className="font-semibold text-white">{t('dealerDetails.aboutDealer')}</h3>
                                    <p className="text-gray-300">{dealer.description}</p>
                                </div>
                            )}

                            <div>
                                <h3 className="font-semibold text-white">{t('dealerDetails.brandsSold')}</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {(dealer.brands || []).map(brand => <span key={brand} className="text-sm bg-gray-700/50 rounded-full px-3 py-1">{brand}</span>)}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-white">{t('dealerDetails.languagesSpoken')}</h3>
                                <p className="text-gray-300">{dealer.languages?.length ? dealer.languages.join(', ') : t('dealerDetails.noLanguages', { defaultValue: 'No languages specified' })}</p>
                            </div>
                            {(dealer.description || dealer.notes) && <div>
                                <h3 className="font-semibold text-white">{t('dealerDetails.notes')}</h3>
                                <p className="text-gray-300">{dealer.description || dealer.notes}</p>
                            </div>}
                        </div>
                    </div>
                </div>

                {dealer.lat && dealer.lng ? (
                    <div className="mt-16">
                        <h2 className="text-3xl font-bold text-center mb-8 text-white">{t('dealerDetails.locationOnMap')}</h2>
                        <GoogleMap
                            center={{ lat: Number(dealer.lat), lng: Number(dealer.lng) }}
                            zoom={15}
                            markers={mapMarkers}
                            className="h-96 w-full"
                        />
                    </div>
                ) : null}

                <div className="mt-16 bg-white/5 border border-white/10 rounded-2xl p-10 shadow-2xl">
                    <h2 className="text-3xl font-bold text-white text-center">{t('dealerDetails.aboutTitle', { name: dealer.name })}</h2>
                    <p className="mt-4 text-gray-300 text-center max-w-4xl mx-auto">
                        {t('dealerDetails.aboutDescription', {
                            name: dealer.name,
                            city: dealer.city,
                            brands: (dealer.brands || []).join(', '),
                        })}
                    </p>
                </div>

                <div className="mt-16">
                    <h2 className="text-3xl font-bold text-center mb-8 text-white">{t('dealerDetails.modelsAvailable')}</h2>
                    {dealerModels.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {dealerModels.map(model => <ModelCard key={model.id} model={model} />)}
                        </div>
                    ) : (
                        <p className="text-center text-gray-400">No specific models listed for this dealer.</p>
                    )}
                </div>

                <GallerySection
                    title={t('dealerDetails.galleryTitle', { defaultValue: 'Showroom gallery' })}
                    description={t('dealerDetails.gallerySubtitle', {
                        defaultValue: 'Take a closer look at the dealership environment and recent deliveries.',
                    })}
                    images={galleryImages}
                />

                <section className="mt-16 max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center">{t('dealerDetails.faqTitle')}</h2>
                    <p className="mt-3 text-gray-300 text-center">{t('dealerDetails.faqSubtitle')}</p>
                    <div className="mt-8 space-y-6">
                        {faqItems.map(faq => (
                            <div key={faq.question} className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-lg">
                                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                                <p className="mt-2 text-gray-300 leading-relaxed">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div >
    );
};

export default DealerDetailPage;