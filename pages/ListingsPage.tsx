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
        const uniqueMakes = new Set((listings || []).map(l => l.make));
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

    const resetFilters = () => {
        setSelectedMake('');
        setPriceRange([0, 200000]);
        setYearRange([2010, new Date().getFullYear()]);
    };

    return (
        <div className="min-h-screen bg-[#020817] py-8 text-white sm:py-12">
            <SEO
                title={t('listings.seoTitle')}
                description={t('listings.seoDesc')}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                            {t('listings.title')}
                        </h1>
                        <p className="text-gray-400 mt-2">
                            {filteredListings.length} {t('listings.countSuffix')}
                        </p>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
                        <button
                            type="button"
                            className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold md:hidden"
                            onClick={() => setShowMobileFilters(!showMobileFilters)}
                            aria-expanded={showMobileFilters}
                            aria-controls="listings-filter-panel"
                        >
                            <Filter size={18} /> {t('common.filters')}
                        </button>
                        <label className="sr-only" htmlFor="listings-sort">{t('listings.sortLabel')}</label>
                        <select
                            id="listings-sort"
                            name="listings-sort"
                            aria-label={t('listings.sortLabel')}
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm focus:border-gray-cyan focus:outline-none sm:w-auto"
                        >
                            <option value="newest">{t('filter.newest')}</option>
                            <option value="price_asc">{t('filter.price_asc')}</option>
                            <option value="price_desc">{t('filter.price_desc')}</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Filters Sidebar */}
                    <aside
                        id="listings-filter-panel"
                        className={`lg:block ${showMobileFilters ? 'fixed inset-0 z-50 flex flex-col bg-[#020817]/95 p-4 backdrop-blur-xl lg:static lg:z-auto lg:flex-none lg:bg-transparent lg:p-0 lg:backdrop-blur-none' : 'hidden'}`}
                    >
                        <div className="mb-4 flex items-center justify-between lg:hidden">
                            <h2 className="text-xl font-bold">{t('common.filters')}</h2>
                            <button
                                type="button"
                                onClick={() => setShowMobileFilters(false)}
                                className="rounded-lg border border-white/10 bg-white/5 p-2"
                                aria-label={t('common.close')}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:sticky lg:top-24 lg:h-fit lg:overflow-visible lg:p-6">
                            <div>
                                <label htmlFor="listings-make-filter" className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">
                                    {t('listings.make')}
                                </label>
                                <select
                                    id="listings-make-filter"
                                    name="listings-make-filter"
                                    aria-label={t('listings.make')}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 focus:border-gray-cyan outline-none"
                                    value={selectedMake}
                                    onChange={(e) => setSelectedMake(e.target.value)}
                                >
                                    <option value="">{t('listings.allMakes')}</option>
                                    {makes.map(make => (
                                        <option key={make} value={make}>{make}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="listings-max-price-filter" className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">
                                    {t('listings.priceRange')}
                                </label>
                                <div className="flex gap-2 text-sm text-gray-400 mb-2">
                                    <span>€{priceRange[0].toLocaleString()}</span>
                                    <span className="ml-auto">€{priceRange[1].toLocaleString()}+</span>
                                </div>
                                <input
                                    id="listings-max-price-filter"
                                    name="listings-max-price-filter"
                                    aria-label={t('listings.priceRange')}
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
                                <label htmlFor="listings-min-year-filter" className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">
                                    {t('listings.year')}
                                </label>
                                <div className="flex gap-2 text-sm text-gray-400 mb-2">
                                    <span>{yearRange[0]}</span>
                                    <span className="ml-auto">{yearRange[1]}</span>
                                </div>
                                <input
                                    id="listings-min-year-filter"
                                    name="listings-min-year-filter"
                                    aria-label={t('listings.year')}
                                    type="range"
                                    min="2010"
                                    max={new Date().getFullYear()}
                                    value={yearRange[0]}
                                    onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                                    className="w-full accent-gray-cyan h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={resetFilters}
                                className="w-full py-2 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg transition"
                            >
                                {t('common.clearFilters')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowMobileFilters(false)}
                                className="w-full rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-gray-900 transition hover:opacity-90 lg:hidden"
                            >
                                {t('listings.applyFilters')}
                            </button>
                        </div>
                    </aside>

                    {/* Listings Grid */}
                    <div className="lg:col-span-3">
                        {loading ? (
                            <div className="flex justify-center items-center h-96">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-cyan"></div>
                            </div>
                        ) : filteredListings.length > 0 ? (
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredListings.map(listing => (
                                    <ListingCard key={listing.id} listing={listing} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10 border-dashed">
                                <Search className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                                <h3 className="text-xl font-bold text-gray-300 mb-2">
                                    {t('listings.noResults')}
                                </h3>
                                <p className="text-gray-500">
                                    {t('listings.tryAdjusting')}
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
