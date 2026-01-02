import React from 'react';
import { Link } from 'react-router-dom';
import { Listing } from '../../types';
import { MapPin, Calendar, Gauge, Fuel } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ListingCardProps {
    listing: Listing;
}

const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
    const { t } = useTranslation();
    const mainImage = listing.images && listing.images.length > 0 ? listing.images[0] : '/placeholder-car.jpg';

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-gray-cyan/50 transition duration-300 group flex flex-col h-full">
            <Link to={`/listings/${listing.id}`} className="relative aspect-[16/10] overflow-hidden block">
                <img
                    src={mainImage}
                    alt={`${listing.make} ${listing.model}`}
                    className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=2070&auto=format&fit=crop';
                    }}
                />
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <span className="text-gray-cyan font-bold font-mono">
                        {listing.price.toLocaleString()} {listing.priceCurrency}
                    </span>
                </div>
                {listing.isFeatured && (
                    <div className="absolute top-3 left-3 bg-yellow-500/90 text-black px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                        Featured
                    </div>
                )}
            </Link>

            <div className="p-5 flex flex-col flex-grow">
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-gray-cyan transition-colors">
                        {listing.make} {listing.model}
                    </h3>
                    <p className="text-gray-400 text-sm line-clamp-1">{listing.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-gray-300 mb-6 font-medium">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-500" />
                        <span>{listing.year}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Gauge size={16} className="text-gray-500" />
                        <span>{listing.mileage.toLocaleString()} km</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Fuel size={16} className="text-gray-500" />
                        <span>{listing.fuelType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-gray-500" />
                        <span className="truncate">{listing.location?.city || 'Albania'}</span>
                    </div>
                </div>

                <div className="mt-auto">
                    <Link
                        to={`/listings/${listing.id}`}
                        className="block w-full text-center py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition border border-white/5"
                    >
                        {t('common.viewDetails', { defaultValue: 'View Details' })}
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ListingCard;
