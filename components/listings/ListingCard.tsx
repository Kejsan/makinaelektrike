import React from 'react';
import { useTranslation } from 'react-i18next';
import { Listing } from '../../types';
import { MapPin, Calendar, Gauge, Fuel, Heart } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';
import OptimizedImage from '../OptimizedImage';
import { MODEL_PLACEHOLDER_IMAGE } from '../../constants/media';
import Link from '../LocalizedLink';

interface ListingCardProps {
    listing: Listing;
}

const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
    const { t } = useTranslation();
    const { isFavorite, toggleFavorite } = useFavorites();
    const favorited = isFavorite(listing.id);
    const mainImage = listing.images && listing.images.length > 0 ? listing.images[0] : listing.image_url || MODEL_PLACEHOLDER_IMAGE;

    return (
        <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-white/10 bg-white/5 transition duration-300 hover:border-gray-cyan/50">
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite(listing.id, 'listings');
                }}
                className="absolute left-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:text-vivid-red"
                aria-label={favorited ? t('common.favoriteRemove') : t('common.favoriteAdd')}
            >
                <Heart size={18} className={`${favorited ? 'fill-vivid-red text-vivid-red' : 'fill-transparent'}`} />
            </button>
            <Link to={`/listings/${listing.id}`} className="relative aspect-[16/10] overflow-hidden block">
                <OptimizedImage
                    src={mainImage}
                    alt={`${listing.make} ${listing.model}`}
                    fallbackSrc={MODEL_PLACEHOLDER_IMAGE}
                    sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                />
                <div className="absolute right-3 top-3 max-w-[calc(100%-4.5rem)] rounded-lg border border-white/10 bg-black/70 px-3 py-1 backdrop-blur-md">
                    <span className="block truncate font-mono text-sm font-bold text-gray-cyan">
                        {listing.price.toLocaleString()} {listing.priceCurrency}
                    </span>
                </div>
                {listing.isFeatured && (
                    <div className="absolute bottom-3 left-3 rounded bg-yellow-500/90 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-black">
                        {t('common.featured')}
                    </div>
                )}
            </Link>

            <div className="flex flex-grow flex-col p-5">
                <div className="mb-4">
                    <h3 className="mb-1 text-xl font-bold leading-tight text-white transition-colors group-hover:text-gray-cyan">
                        {listing.make} {listing.model}
                    </h3>
                    <p className="text-gray-400 text-sm line-clamp-1">{listing.title}</p>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-3 text-sm font-medium text-gray-300 sm:grid-cols-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Calendar size={16} className="shrink-0 text-gray-500" />
                        <span>{listing.year}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                        <Gauge size={16} className="shrink-0 text-gray-500" />
                        <span className="truncate">{listing.mileage.toLocaleString()} km</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                        <Fuel size={16} className="shrink-0 text-gray-500" />
                        <span className="truncate">{listing.fuelType}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                        <MapPin size={16} className="shrink-0 text-gray-500" />
                        <span className="truncate">{listing.location?.city || t('listings.locationFallback')}</span>
                    </div>
                </div>

                <div className="mt-auto">
                    <Link
                        to={`/listings/${listing.id}`}
                        className="block w-full rounded-lg border border-white/5 bg-white/10 py-2.5 text-center font-semibold text-white transition hover:bg-white/20"
                    >
                        {t('common.viewDetails')}
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ListingCard;
