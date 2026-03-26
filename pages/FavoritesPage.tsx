import React, { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFavorites } from '../hooks/useFavorites';
import { Dealer, Model } from '../types';
import DealerCard from '../components/DealerCard';
import ModelCard from '../components/ModelCard';
import { Heart, Share2, Download, Copy, Search, LayoutGrid, List as ListIcon, Info, ArrowUpDown, X, CheckCircle2, ClipboardList } from 'lucide-react';
import { DataContext } from '../contexts/DataContext';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import { MODEL_PLACEHOLDER_IMAGE } from '../constants/media';
import { useToast } from '../contexts/ToastContext';
import ListingCard from '../components/listings/ListingCard';

const FavoritesPage: React.FC = () => {
    const { t } = useTranslation();
    const { entries, loading: favoritesLoading } = useFavorites();
    const { dealers, models, listings, loading: dataLoading } = useContext(DataContext);
    const { addToast } = useToast();
    
    // UI State
    const [activeTab, setActiveTab] = useState<'models' | 'listings' | 'dealers'>('models');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<string>('newest');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [compareMode, setCompareMode] = useState(false);
    const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
    const [showCompareModal, setShowCompareModal] = useState(false);

    const favoriteDealers = useMemo<Dealer[]>(() => {
        const ids = entries.filter(f => f.collection === 'dealers').map(f => f.itemId);
        return dealers.filter(d => ids.includes(d.id));
    }, [dealers, entries]);

    const favoriteModels = useMemo<Model[]>(() => {
        const ids = entries.filter(f => f.collection === 'models').map(f => f.itemId);
        return models.filter(m => ids.includes(m.id));
    }, [models, entries]);

    const favoriteListings = useMemo(() => {
        const ids = entries.filter(f => f.collection === 'listings').map(f => f.itemId);
        return listings.filter(l => ids.includes(l.id));
    }, [listings, entries]);

    const insights = t('favoritesPage.insights', { returnObjects: true }) as Array<{ title: string; description: string }> || [];
    const faqItems = t('favoritesPage.faqItems', { returnObjects: true }) as Array<{ question: string; answer: string }> || [];

    // Filtered and Sorted items based on active tab
    const displayItems = useMemo(() => {
        let items: any[] = [];
        if (activeTab === 'models') items = favoriteModels;
        else if (activeTab === 'listings') items = favoriteListings;
        else if (activeTab === 'dealers') items = favoriteDealers;

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(item => {
                const name = item.name || `${item.brand} ${item.model_name}` || item.title || '';
                return name.toLowerCase().includes(q);
            });
        }

        // Sort
        return [...items].sort((a, b) => {
            if (sortBy === 'alphabetical') {
                const nameA = a.name || `${a.brand} ${a.model_name}` || a.title || '';
                const nameB = b.name || `${b.brand} ${b.model_name}` || b.title || '';
                return nameA.localeCompare(nameB);
            }
            if (sortBy === 'price-asc') return (a.price || 0) - (b.price || 0);
            if (sortBy === 'price-desc') return (b.price || 0) - (a.price || 0);
            if (sortBy === 'year-desc') return (b.year || b.year_start || 0) - (a.year || a.year_start || 0);
            if (sortBy === 'year-asc') return (a.year || a.year_start || 0) - (b.year || b.year_start || 0);
            return 0; // Default: newest (but we don't have dates in favorites yet)
        });
    }, [activeTab, favoriteModels, favoriteListings, favoriteDealers, searchQuery, sortBy]);

    const totalCount = favoriteModels.length + favoriteDealers.length + favoriteListings.length;

    const handleShareList = async () => {
        try {
            const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/favorites` : `${BASE_URL}/favorites`;
            const shareText = t('favoritesPage.shareMessage', { count: totalCount });

            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({ title: t('favoritesPage.shareTitle'), text: shareText, url: shareUrl });
                addToast(t('favoritesPage.shareSuccess'), 'success');
                return;
            }

            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(`${shareText} ${shareUrl}`.trim());
                addToast(t('favoritesPage.copySuccess'), 'success');
                return;
            }

            addToast(t('favoritesPage.shareError'), 'info');
        } catch (error) {
            console.error('Unable to share favorites', error);
            addToast(t('favoritesPage.shareError'), 'error');
        }
    };

    const handleExportList = () => {
        const timestamp = new Date().toISOString().split('T')[0];
        const lines: string[] = [t('favoritesPage.exportHeading'), ''];

        if (favoriteDealers.length) {
            lines.push(`--- ${t('favoritesPage.dealers')} ---`);
            favoriteDealers.forEach(dealer => lines.push(`- ${dealer.name} (${dealer.city})`));
            lines.push('');
        }

        if (favoriteModels.length) {
            lines.push(`--- ${t('favoritesPage.models')} ---`);
            favoriteModels.forEach(model => lines.push(`- ${model.brand} ${model.model_name}`));
            lines.push('');
        }

        if (favoriteListings.length) {
            lines.push(`--- ${t('listings.title')} ---`);
            favoriteListings.forEach(l => lines.push(`- ${l.title} (${l.price}€)`));
            lines.push('');
        }

        if (totalCount === 0) lines.push(t('favoritesPage.noItemsToExport'));

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `favorites-${timestamp}.txt`;
        link.click();
        URL.revokeObjectURL(url);
        addToast(t('favoritesPage.exportSuccess'), 'success');
    };

    const toggleCompareSelection = (id: string) => {
        setSelectedForCompare(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id].slice(-3) // Max 3 items
        );
    };

    const selectedModels = useMemo(() => 
        models.filter(m => selectedForCompare.includes(m.id)),
    [models, selectedForCompare]);

    return (
        <div className="min-h-screen pb-20 bg-[#0A0A0A]">
            <SEO
                title={t('favoritesPage.metaTitle')}
                description={t('favoritesPage.metaDescription')}
                canonical={`${BASE_URL}/favorites/`}
            />

            {/* Header Section */}
            <div className="bg-gradient-to-b from-gray-900/40 to-black pt-24 pb-16 border-b border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,255,255,0.05),transparent_50%)]" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 text-red-500 text-xs font-black uppercase tracking-widest mb-6 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                                <Heart size={14} className="fill-current animate-pulse" />
                                {t('favoritesPage.collection')}
                            </div>
                            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4">
                                {t('favoritesPage.title')}
                                <span className="text-red-500">.</span>
                            </h1>
                            <p className="text-xl text-gray-400 max-w-2xl leading-relaxed font-medium">
                                {t('favoritesPage.subtitle')}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <button
                                onClick={handleShareList}
                                className="group inline-flex items-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3.5 text-sm font-black text-white transition-all hover:scale-105 active:scale-95 hover:shadow-neon-cyan/20"
                            >
                                <Share2 size={20} className="text-gray-cyan group-hover:rotate-12 transition-transform" />
                                {t('favoritesPage.share')}
                            </button>
                            <button
                                onClick={handleExportList}
                                className="group inline-flex items-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3.5 text-sm font-black text-white transition-all hover:scale-105 active:scale-95 hover:shadow-neon-cyan/20"
                            >
                                <Download size={20} className="text-gray-cyan group-hover:bounce transition-all" />
                                {t('favoritesPage.export')}
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex mt-16 overflow-x-auto no-scrollbar gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl max-w-fit backdrop-blur-md">
                        {[
                            { id: 'models', label: t('favoritesPage.models'), count: favoriteModels.length },
                            { id: 'listings', label: t('listings.title'), count: favoriteListings.length },
                            { id: 'dealers', label: t('favoritesPage.dealers'), count: favoriteDealers.length }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-3 px-8 py-3.5 text-sm font-black transition-all rounded-xl ${
                                    activeTab === tab.id 
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {tab.label}
                                <span className={`flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-lg text-[10px] font-black ${
                                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-500'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
                {/* Search & Filters */}
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8 mb-12 bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative w-full lg:max-w-xl">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-red-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder={t('search.placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white text-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all placeholder-gray-600 focus:bg-black/80 shadow-inner"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-end relative z-10">
                        <div className="flex items-center gap-1 bg-black/60 border border-white/10 rounded-2xl p-1.5 shadow-inner">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <LayoutGrid size={20} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <ListIcon size={20} />
                            </button>
                        </div>

                        <div className="relative group/select">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="appearance-none bg-black/60 border border-white/10 rounded-2xl py-4 px-6 pr-12 text-white text-sm font-black focus:outline-none focus:ring-2 focus:ring-red-500/30 cursor-pointer shadow-inner hover:bg-black/80 transition-all"
                            >
                                <option value="newest">{t('filter.newest')}</option>
                                <option value="alphabetical">{t('filter.alphabetical')}</option>
                                {activeTab !== 'dealers' && (
                                    <>
                                        <option value="price-asc">{t('filter.price_asc')}</option>
                                        <option value="price-desc">{t('filter.price_desc')}</option>
                                        <option value="year-desc">{t('filter.year_desc', { defaultValue: 'Year (Newest)' })}</option>
                                        <option value="year-asc">{t('filter.year_asc', { defaultValue: 'Year (Oldest)' })}</option>
                                    </>
                                )}
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover/select:text-white transition-colors">
                                <ArrowUpDown size={14} />
                            </div>
                        </div>

                        {activeTab === 'models' && favoriteModels.length > 1 && (
                            <button
                                onClick={() => {
                                    setCompareMode(!compareMode);
                                    if (compareMode) setSelectedForCompare([]);
                                }}
                                className={`inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-sm font-black transition-all ${
                                    compareMode 
                                        ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)] scale-105' 
                                        : 'bg-white/10 text-white border border-white/10 hover:bg-white/20 hover:scale-105'
                                }`}
                            >
                                <ArrowUpDown size={20} />
                                {compareMode ? t('favoritesPage.exitCompare') : t('favoritesPage.startCompare')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Compare Bar */}
                {compareMode && activeTab === 'models' && (
                    <div className="mb-12 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 animate-fadeIn shadow-2xl backdrop-blur-md relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-red-500/5 animate-pulse" />
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="p-4 bg-red-500/20 rounded-2xl shadow-inner">
                                <Info className="text-red-500" size={28} />
                            </div>
                            <div>
                                <h3 className="font-black text-white text-lg">{t('favoritesPage.compareTitle')}</h3>
                                <p className="text-sm text-gray-400 font-medium">
                                    {t('favoritesPage.compareInstruction', { count: selectedForCompare.length })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="flex -space-x-3 mr-4">
                                {selectedModels.map((m, i) => (
                                    <div key={m.id} className="w-12 h-12 rounded-xl border-2 border-gray-900 overflow-hidden shadow-xl" style={{ zIndex: 3 - i }}>
                                        <img src={m.image_url || MODEL_PLACEHOLDER_IMAGE} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                            {selectedForCompare.length >= 2 && (
                                <button 
                                    onClick={() => setShowCompareModal(true)}
                                    className="bg-white text-black px-10 py-4 rounded-2xl font-black text-sm shadow-[0_10px_30px_rgba(255,255,255,0.2)] transition-all hover:scale-110 active:scale-95 hover:bg-gray-100"
                                >
                                    {t('favoritesPage.compareNow')}
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    setCompareMode(false);
                                    setSelectedForCompare([]);
                                }}
                                className="p-4 text-gray-400 hover:text-white transition-all hover:rotate-90"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Items Grid */}
                {dataLoading || favoritesLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-white/5 border border-white/5 rounded-3xl h-[450px] animate-pulse relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                            </div>
                        ))}
                    </div>
                ) : displayItems.length > 0 ? (
                    <div className={`grid gap-10 ${
                        viewMode === 'grid' 
                            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                            : 'grid-cols-1'
                    }`}>
                        {displayItems.map(item => {
                            if (activeTab === 'models') {
                                return (
                                    <div key={item.id} className="relative group transition-all duration-500">
                                        {compareMode && (
                                            <button
                                                onClick={() => toggleCompareSelection(item.id)}
                                                className={`absolute top-6 left-6 z-20 p-3 rounded-2xl border transition-all duration-300 ${
                                                    selectedForCompare.includes(item.id)
                                                        ? 'bg-red-500 border-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] scale-110 rounded-full'
                                                        : 'bg-black/60 border-white/20 text-white hover:bg-black/80 backdrop-blur-md'
                                                }`}
                                            >
                                                {selectedForCompare.includes(item.id) ? <CheckCircle2 size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-white/30" />}
                                                {selectedForCompare.includes(item.id) && (
                                                    <span className="absolute -top-2 -right-2 bg-white text-red-500 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-red-500">
                                                        {selectedForCompare.indexOf(item.id) + 1}
                                                    </span>
                                                )}
                                            </button>
                                        )}
                                        <div className={`transition-all duration-500 ${selectedForCompare.includes(item.id) ? 'scale-[0.98] ring-4 ring-red-500/50 rounded-2xl' : ''}`}>
                                            <ModelCard model={item} />
                                        </div>
                                    </div>
                                );
                            }
                            if (activeTab === 'listings') return <div key={item.id} className="hover:scale-[1.02] transition-transform duration-300"><ListingCard listing={item} /></div>;
                            if (activeTab === 'dealers') return <div key={item.id} className="hover:scale-[1.02] transition-transform duration-300"><DealerCard dealer={item} /></div>;
                            return null;
                        })}
                    </div>
                ) : (
                    <div className="text-center py-32 bg-white/5 rounded-[3rem] border border-white/5 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.03),transparent_70%)]" />
                        <div className="relative z-10">
                            <div className="bg-white/5 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-10 border border-white/10 shadow-inner">
                                <Heart className="text-gray-800" size={56} strokeWidth={1}/>
                            </div>
                            <h3 className="text-3xl font-black text-white mb-4 tracking-tight">
                                {t('favoritesPage.emptyTitle', { tab: activeTab })}
                            </h3>
                            <p className="text-gray-400 max-w-sm mx-auto text-lg leading-relaxed">
                                {t('favoritesPage.emptyText', { tab: activeTab })}
                            </p>
                        </div>
                    </div>
                )}

                {/* Insights Section */}
                {insights.length > 0 && (
                    <section className="mt-40 mb-20">
                        <div className="bg-gradient-to-br from-white/10 via-white/5 to-transparent border border-white/10 rounded-[3rem] p-16 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-12 text-white/5 transition-transform duration-700 group-hover:scale-125 group-hover:rotate-12">
                                <Info size={200} strokeWidth={1}/>
                            </div>
                            <div className="relative z-10">
                                <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight line-clamp-1">{t('favoritesPage.insightsTitle')}</h2>
                                <p className="text-xl text-gray-400 max-w-3xl mb-16 font-medium leading-relaxed">{t('favoritesPage.insightsSubtitle')}</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                    {insights.map((item, i) => (
                                        <div key={i} className="bg-black/60 border border-white/10 rounded-[2rem] p-10 hover:border-red-500/50 transition-all duration-500 hover:-translate-y-4 shadow-2xl group/item relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-8 text-red-500 text-2xl font-black shadow-inner border border-red-500/20">0{i+1}</div>
                                            <h3 className="text-2xl font-bold text-white mb-5 group-hover/item:text-red-500 transition-colors">{item.title}</h3>
                                            <p className="text-gray-400 leading-relaxed text-lg">{item.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* FAQ Section */}
                {faqItems.length > 0 && (
                    <section className="mt-32 max-w-5xl mx-auto pb-40">
                        <div className="text-center mb-20">
                            <div className="flex justify-center mb-6">
                                <div className="p-4 bg-red-500/10 rounded-3xl border border-red-500/20 text-red-500">
                                    <ClipboardList size={32} />
                                </div>
                            </div>
                            <h2 className="text-4xl font-black text-white tracking-tight mb-6">{t('favoritesPage.faqTitle')}</h2>
                            <p className="text-xl text-gray-400 font-medium">{t('favoritesPage.faqSubtitle')}</p>
                        </div>
                        <div className="grid gap-6">
                            {faqItems.map((faq, i) => (
                                <details key={i} className="group bg-white/5 border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:bg-white/10 hover:border-white/20">
                                    <summary className="flex items-center justify-between p-8 cursor-pointer text-white text-xl font-bold list-none">
                                        {faq.question}
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-red-500 transition-all group-open:rotate-180 group-open:bg-red-500 group-open:text-white">
                                            <ArrowUpDown size={20} />
                                        </div>
                                    </summary>
                                    <div className="p-8 pt-0 text-gray-400 text-lg leading-relaxed border-t border-white/5 bg-black/20 font-medium">
                                        {faq.answer}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Compare Modal */}
            {showCompareModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 transition-all duration-500 animate-fadeIn">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setShowCompareModal(false)} />
                    <div className="relative bg-[#0F0F0F] border border-white/10 rounded-[3rem] w-full max-w-7xl max-h-[90vh] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col scale-in">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <div className="flex items-center gap-6">
                                <div className="p-3 bg-red-500 rounded-2xl shadow-lg shadow-red-500/30">
                                    <ArrowUpDown size={28} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tighter">{t('favoritesPage.compareModalTitle')}</h2>
                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">{t('favoritesPage.sideBySide') || 'Side-by-side spec comparison'}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCompareModal(false)} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500 hover:border-red-500 transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-10 custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr>
                                        <th className="p-6 border-b border-white/10 text-gray-500 font-black uppercase text-xs tracking-widest w-1/4 select-none">{t('favoritesPage.spec')}</th>
                                        {selectedModels.map(model => (
                                            <th key={model.id} className="p-6 border-b border-white/10 min-w-[250px] relative">
                                                <div className="flex flex-col gap-6">
                                                    <div className="relative group/img overflow-hidden rounded-2xl aspect-video border border-white/10 shadow-2xl">
                                                        <img src={model.image_url || MODEL_PLACEHOLDER_IMAGE} alt={model.model_name} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                                        <div className="absolute bottom-4 left-4">
                                                            <div className="text-white font-black text-xl tracking-tight leading-none">{model.model_name}</div>
                                                            <div className="text-red-500 font-bold text-xs uppercase tracking-widest mt-1">{model.brand}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="text-base">
                                    {[
                                        { key: 'year_start', label: t('favoritesPage.year', { defaultValue: 'Year' }) },
                                        { key: 'battery_capacity', label: t('model_detail.battery'), format: (v: any) => v ? `${v} kWh` : '-' },
                                        { key: 'range_wltp', label: t('model_detail.range'), format: (v: any) => v ? `${v} km` : '-' },
                                        { key: 'acceleration_0_100', label: t('model_detail.acceleration'), format: (v: any) => v ? `${v}s` : '-' },
                                        { key: 'top_speed', label: t('model_detail.top_speed'), format: (v: any) => v ? `${v} km/h` : '-' },
                                        { key: 'power_kw', label: t('model_detail.power'), format: (v: any) => v ? `${v} kW` : '-' },
                                        { key: 'torque_nm', label: t('model_detail.torque', { defaultValue: 'Torque' }), format: (v: any) => v ? `${v} Nm` : '-' },
                                        { key: 'drive_type', label: t('model_detail.drive_type', { defaultValue: 'Drive' }) },
                                        { key: 'seats', label: t('model_detail.seats', { defaultValue: 'Seats' }) },
                                        { key: 'weight_kg', label: t('model_detail.weight', { defaultValue: 'Weight' }), format: (v: any) => v ? `${v} kg` : '-' },
                                        { key: 'cargo_volume_l', label: t('model_detail.cargo', { defaultValue: 'Cargo' }), format: (v: any) => v ? `${v} L` : '-' },
                                    ].map((spec, idx) => (
                                        <tr key={spec.key} className={`group/row transition-all ${idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}`}>
                                            <td className="p-6 border-white/5 text-gray-400 font-black text-sm group-hover/row:text-white transition-colors">{spec.label}</td>
                                            {selectedModels.map(model => (
                                                <td key={model.id} className="p-6 border-white/5 text-white font-medium group-hover/row:bg-red-500/5 transition-all">
                                                    <span className="bg-white/5 px-4 py-2 rounded-xl inline-block border border-white/5 shadow-inner group-hover/row:border-red-500/20 group-hover/row:text-red-500 transition-all">
                                                        {spec.format ? spec.format(model[spec.key as keyof Model]) : (model[spec.key as keyof Model] || '-')}
                                                    </span>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-8 border-t border-white/5 bg-white/2 flex justify-end">
                            <button 
                                onClick={() => setShowCompareModal(false)}
                                className="bg-white text-black px-10 py-4 rounded-2xl font-black text-sm shadow-xl transition-all hover:scale-105 active:scale-95 hover:bg-gray-100"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FavoritesPage;
