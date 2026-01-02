import React, { useContext, useState, useMemo } from 'react';
import { DataContext } from '../contexts/DataContext';
import ListingCard from '../components/listings/ListingCard';
import SEO from '../components/SEO';
import { useTranslation } from 'react-i18next';
import { Search, Filter, X } from 'lucide-react';

const ListingsPage: React.FC = () => {
    const { t } = useTranslation();
    const { listings, loading } = useContext(DataContext);

    // Filter states
    const [selectedMake, setSelectedMake] = useState<string>('');
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000]);
    const [yearRange, setYearRange] = useState<[number, number]>([2010, new Date().getFullYear()]);
    const [sortBy, setSortBy] = useState<string>('newest');
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    // Derived unique values for filters
    const makes = useMemo(() => {
        const uniqueMakes = new Set(listings.map(l => l.make));
        return Array.from(uniqueMakes).sort();
    }, [listings]);

    // Filter logic
    const filteredListings = useMemo(() => {
        return listings.filter(listing => {
            // If dealer is approved, we assume their listings in 'listings' context are approved/active if the user is anonymous
            // But we should double check status just in case context includes 'pending' for some reason (e.g. slight race condition or simple query)
            // For public view, strictly 'approved' and 'active' (if active flag exists, or status 'approved')
            if (listing.status !== 'approved' && listing.status !== 'active') return false;

            if (selectedMake && listing.make !== selectedMake) return false;
            if (listing.price < priceRange[0] || listing.price > priceRange[1]) return false;
            if (listing.year < yearRange[0] || listing.year > yearRange[1]) return false;

            return true;
        }).sort((a, b) => {
            if (sortBy === 'newest') return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
            if (sortBy === 'price_asc') return a.price - b.price;
            if (sortBy === 'price_desc') return b.price - a.price;
            return 0;
        });
    }, [listings, selectedMake, priceRange, yearRange, sortBy]);

    return (
        <div className="min-h-screen bg-[#020817] text-white py-12">
            <SEO
                title={t('listings.seoTitle', { defaultValue: 'Electric Cars for Sale | Makina Elektrike' })}
                description={t('listings.seoDesc', { defaultValue: 'Browse the best collection of electric vehicles in Albania.' })}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            {t('listings.title', { defaultValue: 'Find Your Electric Car' })}
                        </h1>
                        <p className="text-gray-400 mt-2">
                            {filteredListings.length} {t('listings.countSuffix', { defaultValue: 'vehicles available' })}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            className="md:hidden flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg"
                            onClick={() => setShowMobileFilters(!showMobileFilters)}
                        >
                            <Filter size={18} /> Filters
                        </button>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-gray-cyan"
                        >
                            <option value="newest">{t('sort.newest', { defaultValue: 'Newest Listed' })}</option>
                            <option value="price_asc">{t('sort.priceLow', { defaultValue: 'Price: Low to High' })}</option>
                            <option value="price_desc">{t('sort.priceHigh', { defaultValue: 'Price: High to Low' })}</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Filters Sidebar */}
                    <div className={`lg:block ${showMobileFilters ? 'fixed inset-0 z-50 bg-[#020817] p-6 overflow-y-auto' : 'hidden'}`}>
                        <div className="flex justify-between items-center lg:hidden mb-6">
                            <h2 className="text-xl font-bold">Filters</h2>
                            <button onClick={() => setShowMobileFilters(false)}><X size={24} /></button>
                        </div>

                        <div className="space-y-8 bg-white/5 p-6 rounded-2xl border border-white/10 sticky top-24">
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">
                                    {t('listings.make', { defaultValue: 'Make' })}
                                </label>
                                <select
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 focus:border-gray-cyan outline-none"
                                    value={selectedMake}
                                    onChange={(e) => setSelectedMake(e.target.value)}
                                >
                                    <option value="">All Makes</option>
                                    {makes.map(make => (
                                        <option key={make} value={make}>{make}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">
                                    {t('listings.priceRange', { defaultValue: 'Price Range' })}
                                </label>
                                <div className="flex gap-2 text-sm text-gray-400 mb-2">
                                    <span>€{priceRange[0].toLocaleString()}</span>
                                    <span className="ml-auto">€{priceRange[1].toLocaleString()}+</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="150000"
                                    step="1000"
                                    value={priceRange[1]}
                                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                                    className="w-full accent-gray-cyan h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">
                                    {t('listings.year', { defaultValue: 'Year' })}
                                </label>
                                <div className="flex gap-2 text-sm text-gray-400 mb-2">
                                    <span>{yearRange[0]}</span>
                                    <span className="ml-auto">{yearRange[1]}</span>
                                </div>
                                <input
                                    type="range"
                                    min="2010"
                                    max={new Date().getFullYear()}
                                    value={yearRange[0]}
                                    onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                                    className="w-full accent-gray-cyan h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            <button
                                onClick={() => {
                                    setSelectedMake('');
                                    setPriceRange([0, 200000]);
                                    setYearRange([2010, new Date().getFullYear()]);
                                }}
                                className="w-full py-2 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg transition"
                            >
                                {t('common.clearFilters', { defaultValue: 'Clear Filters' })}
                            </button>
                        </div>
                    </div>

                    {/* Listings Grid */}
                    <div className="lg:col-span-3">
                        {loading ? (
                            <div className="flex justify-center items-center h-96">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-cyan"></div>
                            </div>
                        ) : filteredListings.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {filteredListings.map(listing => (
                                    <ListingCard key={listing.id} listing={listing} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10 border-dashed">
                                <Search className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                                <h3 className="text-xl font-bold text-gray-300 mb-2">
                                    {t('listings.noResults', { defaultValue: 'No Result Found' })}
                                </h3>
                                <p className="text-gray-500">
                                    {t('listings.tryAdjusting', { defaultValue: 'Try adjusting your filters or search criteria.' })}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ListingsPage;
