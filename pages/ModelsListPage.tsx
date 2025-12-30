import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Model } from '../types';
import ModelCard from '../components/ModelCard';
import CustomSelect from '../components/CustomSelect';
import { Car, Tag, Gauge, ListFilter, Scale } from 'lucide-react';
import ComparisonModal from '../components/ComparisonModal';
import { DataContext } from '../contexts/DataContext';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';

const ModelsListPage: React.FC = () => {
    const { t } = useTranslation();
    const { models, loading } = useContext(DataContext);
    const [allModels, setAllModels] = useState<Model[]>(models);
    const [filteredModels, setFilteredModels] = useState<Model[]>([]);
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
    const insights = t('modelsPage.insights', { returnObjects: true }) as Array<{ title: string; description: string }>;
    const faqItems = t('modelsPage.faqItems', { returnObjects: true }) as Array<{ question: string; answer: string }>;

    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: t('modelsPage.metaTitle'),
        description: t('modelsPage.metaDescription'),
        itemListElement: allModels.map((model, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: `${model.brand} ${model.model_name}`,
            url: `${BASE_URL}/models/${model.id}`,
        })),
    };

    // Filter states
    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedBodyType, setSelectedBodyType] = useState('');
    const [minRange, setMinRange] = useState('');
    const [sortBy, setSortBy] = useState('model_asc');

    useEffect(() => {
        setAllModels(models);
    }, [models]);

    const filterOptions = useMemo(() => {
        const brands = [...new Set(allModels.map(m => m.brand))].sort();
        const bodyTypes = [...new Set(allModels.map(m => m.body_type).filter(bt => bt))].sort() as string[];
        return { brands, bodyTypes };
    }, [allModels]);

    useEffect(() => {
        let models = [...allModels];

        if (selectedBrand) {
            models = models.filter(m => m.brand === selectedBrand);
        }
        if (selectedBodyType) {
            models = models.filter(m => m.body_type === selectedBodyType);
        }
        if (minRange) {
            models = models.filter(m => m.range_wltp && m.range_wltp >= parseInt(minRange, 10));
        }

        models.sort((a, b) => {
            switch (sortBy) {
                case 'model_desc':
                    return b.model_name.localeCompare(a.model_name);
                case 'brand_asc':
                    return a.brand.localeCompare(b.brand);
                case 'brand_desc':
                    return b.brand.localeCompare(a.brand);
                case 'range_desc':
                    return (b.range_wltp || 0) - (a.range_wltp || 0);
                case 'range_asc':
                    return (a.range_wltp || 0) - (b.range_wltp || 0);
                case 'model_asc':
                default:
                    return a.model_name.localeCompare(b.model_name);
            }
        });

        setFilteredModels(models);
    }, [allModels, selectedBrand, selectedBodyType, minRange, sortBy]);

    const clearFilters = () => {
        setSelectedBrand('');
        setSelectedBodyType('');
        setMinRange('');
        setSortBy('model_asc');
    };

    const rangeValues = [300, 400, 500, 600];
    const rangeOptions = [
        { value: '', label: t('modelsPage.rangeOptions.any') },
        ...rangeValues.map(value => ({ value: value.toString(), label: t('modelsPage.rangeOptions.min', { value }) })),
    ];

    const sortOptions = [
        { value: 'model_asc', label: t('modelsPage.sortOptions.model_asc') },
        { value: 'model_desc', label: t('modelsPage.sortOptions.model_desc') },
        { value: 'brand_asc', label: t('modelsPage.sortOptions.brand_asc') },
        { value: 'brand_desc', label: t('modelsPage.sortOptions.brand_desc') },
        { value: 'range_desc', label: t('modelsPage.sortOptions.range_desc') },
        { value: 'range_asc', label: t('modelsPage.sortOptions.range_asc') },
    ];

    if (loading) {
        return <div className="py-10 text-center text-white">{t('modelsPage.loading')}</div>;
    }

    return (
        <>
            <SEO
                title={t('modelsPage.metaTitle')}
                description={t('modelsPage.metaDescription')}
                keywords={t('modelsPage.metaKeywords', { returnObjects: true }) as string[]}
                canonical={`${BASE_URL}/models/`}
                openGraph={{
                    title: t('modelsPage.metaTitle'),
                    description: t('modelsPage.metaDescription'),
                    url: `${BASE_URL}/models/`,
                    type: 'website',
                    images: [DEFAULT_OG_IMAGE],
                }}
                twitter={{
                    title: t('modelsPage.metaTitle'),
                    description: t('modelsPage.metaDescription'),
                    image: DEFAULT_OG_IMAGE,
                    site: '@makinaelektrike',
                }}
                structuredData={structuredData}
            />
            <div className="py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-10">
                        <h1 className="text-4xl font-extrabold text-white">{t('modelsPage.title')}</h1>
                        <p className="mt-4 text-lg text-gray-300 max-w-3xl mx-auto">{t('modelsPage.subtitle')}</p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-12 shadow-2xl">
                        <h2 className="text-2xl font-bold text-white text-center">{t('modelsPage.introTitle')}</h2>
                        <p className="mt-4 text-gray-300 leading-relaxed text-center max-w-4xl mx-auto">{t('modelsPage.introSubtitle')}</p>
                    </div>

                    <div className="relative z-30 mb-12 rounded-xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white">{t('common.filters')}</h2>
                            <span className="text-gray-400 font-medium bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                {filteredModels.length} {t('common.results')}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end">
                            <CustomSelect
                                icon={<Car size={16} />}
                                placeholder={t('modelsPage.allBrands')}
                                options={[{ value: '', label: t('modelsPage.allBrands') }, ...filterOptions.brands.map(b => ({ value: b, label: b }))]}
                                value={selectedBrand}
                                onChange={setSelectedBrand}
                            />
                            <CustomSelect
                                icon={<Tag size={16} />}
                                placeholder={t('modelsPage.allBodyTypes')}
                                options={[{ value: '', label: t('modelsPage.allBodyTypes') }, ...filterOptions.bodyTypes.map(bt => ({ value: bt, label: bt }))]}
                                value={selectedBodyType}
                                onChange={setSelectedBodyType}
                            />
                            <CustomSelect
                                icon={<Gauge size={16} />}
                                placeholder={t('modelsPage.range')}
                                options={rangeOptions}
                                value={minRange}
                                onChange={setMinRange}
                            />
                            <CustomSelect
                                icon={<ListFilter size={16} />}
                                placeholder={t('modelsPage.sortBy')}
                                options={sortOptions}
                                value={sortBy}
                                onChange={setSortBy}
                            />
                            <button
                                onClick={() => setIsCompareModalOpen(true)}
                                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-md bg-gray-cyan px-6 py-2.5 font-bold text-white transition-colors hover:bg-opacity-90 sm:col-span-2 xl:col-span-1"
                            >
                                <Scale size={16} />
                                {t('modelsPage.compare')}
                            </button>
                            <button
                                onClick={clearFilters}
                                className="flex h-[46px] w-full items-center justify-center rounded-md bg-vivid-red px-6 py-2.5 font-bold text-white transition-colors hover:bg-opacity-90 sm:col-span-2 xl:col-span-1"
                            >
                                {t('modelsPage.clearFilters')}
                            </button>
                        </div>
                    </div>

                    {filteredModels.length > 0 ? (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredModels.map(model => <ModelCard key={model.id} model={model} />)}
                        </div>
                    ) : (
                        <p className="text-center text-gray-400 py-10">{t('modelsPage.noResults')}</p>
                    )}

                    <section className="mt-16">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl sm:p-10">
                            <h2 className="text-center text-3xl font-bold text-white">{t('modelsPage.insightsTitle')}</h2>
                            <p className="mt-4 mx-auto max-w-4xl text-center text-gray-300">{t('modelsPage.insightsSubtitle')}</p>
                            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                {insights.map(item => (
                                    <div key={item.title} className="rounded-xl border border-gray-800 bg-black/30 p-6">
                                        <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                                        <p className="mt-3 text-gray-300 leading-relaxed">{item.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="mt-16">
                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-3xl font-bold text-white text-center">{t('modelsPage.faqTitle')}</h2>
                            <p className="mt-3 text-gray-300 text-center">{t('modelsPage.faqSubtitle')}</p>
                            <div className="mt-8 space-y-6">
                                {faqItems.map(faq => (
                                    <div key={faq.question} className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-lg">
                                        <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                                        <p className="mt-2 text-gray-300 leading-relaxed">{faq.answer}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
            <ComparisonModal
                isOpen={isCompareModalOpen}
                onClose={() => setIsCompareModalOpen(false)}
                allModels={allModels}
            />
        </>
    );
};

export default ModelsListPage;