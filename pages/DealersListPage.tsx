import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { DataContext } from '../contexts/DataContext';
import DealerCard from '../components/DealerCard';
import CustomSelect from '../components/CustomSelect';
import { Building, Car, Globe, ListFilter } from 'lucide-react';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import type { Dealer } from '../types';

const DealersListPage: React.FC = () => {
    const { t } = useTranslation();
    const { dealers: allDealers, loading } = useContext(DataContext);
    const visibleDealers = useMemo(
        () =>
            allDealers.filter(dealer => {
                const status = dealer.status ?? (dealer.approved === false ? 'pending' : 'approved');
                if (dealer.isDeleted === true) {
                    return false;
                }
                if (status !== 'approved') {
                    return false;
                }
                if (dealer.isActive === false) {
                    return false;
                }
                return true;
            }),
        [allDealers],
    );
    const [filteredDealers, setFilteredDealers] = useState(visibleDealers);
    const insights = t('dealersPage.insights', { returnObjects: true }) as Array<{ title: string; description: string }>;
    const faqItems = t('dealersPage.faqItems', { returnObjects: true }) as Array<{ question: string; answer: string }>;

    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: t('dealersPage.metaTitle'),
        description: t('dealersPage.metaDescription'),
        itemListElement: visibleDealers.map((dealer, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: dealer.name,
            url: `${BASE_URL}/dealers/${dealer.id}`,
        })),
    };

    // Filter states
    const [selectedCity, setSelectedCity] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState('');
    const [sortBy, setSortBy] = useState('name_asc');

    const filterOptions = useMemo(() => {
        const cities = [...new Set(visibleDealers.map(d => d.city))].sort();
        const brands = [...new Set(visibleDealers.flatMap(d => d.brands))].sort();
        const languages = [...new Set(visibleDealers.flatMap(d => d.languages))].sort();
        return { cities, brands, languages };
    }, [visibleDealers]);

    useEffect(() => {
        let dealers = [...visibleDealers];

        if (selectedCity) {
            dealers = dealers.filter(d => d.city === selectedCity);
        }
        if (selectedBrand) {
            dealers = dealers.filter(d => d.brands.includes(selectedBrand));
        }
        if (selectedLanguage) {
            dealers = dealers.filter(d => d.languages.includes(selectedLanguage));
        }

        dealers.sort((a, b) => {
            switch (sortBy) {
                case 'name_desc':
                    return b.name.localeCompare(a.name);
                case 'city_asc':
                    return a.city.localeCompare(b.city);
                case 'city_desc':
                    return b.city.localeCompare(a.city);
                case 'name_asc':
                default:
                    return a.name.localeCompare(b.name);
            }
        });

        setFilteredDealers(dealers);
    }, [visibleDealers, selectedCity, selectedBrand, selectedLanguage, sortBy]);

    const clearFilters = () => {
        setSelectedCity('');
        setSelectedBrand('');
        setSelectedLanguage('');
        setSortBy('name_asc');
    };

    const sortOptions = [
        { value: 'name_asc', label: t('dealersPage.sortOptions.name_asc') },
        { value: 'name_desc', label: t('dealersPage.sortOptions.name_desc') },
        { value: 'city_asc', label: t('dealersPage.sortOptions.city_asc') },
        { value: 'city_desc', label: t('dealersPage.sortOptions.city_desc') },
    ];


    if (loading) {
        return <div className="py-10 text-center text-white">{t('dealersPage.loading')}</div>;
    }

    return (
        <div className="py-12">
            <SEO
                title={t('dealersPage.metaTitle')}
                description={t('dealersPage.metaDescription')}
                keywords={t('dealersPage.metaKeywords', { returnObjects: true }) as string[]}
                canonical={`${BASE_URL}/dealers/`}
                openGraph={{
                    title: t('dealersPage.metaTitle'),
                    description: t('dealersPage.metaDescription'),
                    url: `${BASE_URL}/dealers/`,
                    type: 'website',
                    images: [DEFAULT_OG_IMAGE],
                }}
                twitter={{
                    title: t('dealersPage.metaTitle'),
                    description: t('dealersPage.metaDescription'),
                    image: DEFAULT_OG_IMAGE,
                    site: '@makinaelektrike',
                }}
                structuredData={structuredData}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-white">{t('dealersPage.title')}</h1>
                    <p className="mt-4 text-lg text-gray-300 max-w-3xl mx-auto">{t('dealersPage.subtitle')}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-12 shadow-2xl">
                    <h2 className="text-2xl font-bold text-white text-center">{t('dealersPage.introTitle')}</h2>
                    <p className="mt-4 text-gray-300 leading-relaxed text-center max-w-4xl mx-auto">{t('dealersPage.introSubtitle')}</p>
                </div>

                <div className="relative z-30 mb-12 rounded-xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">{t('common.filters')}</h2>
                        <span className="text-gray-400 font-medium bg-white/5 px-3 py-1 rounded-full border border-white/10">
                            {filteredDealers.length} {t('common.results')}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:items-end">
                        <CustomSelect
                            icon={<Building size={16} />}
                            placeholder={t('dealersPage.allCities')}
                            options={[{ value: '', label: t('dealersPage.allCities') }, ...filterOptions.cities.map(c => ({ value: c, label: c }))]}
                            value={selectedCity}
                            onChange={setSelectedCity}
                        />
                        <CustomSelect
                            icon={<Car size={16} />}
                            placeholder={t('dealersPage.allBrands')}
                            options={[{ value: '', label: t('dealersPage.allBrands') }, ...filterOptions.brands.map(b => ({ value: b, label: b }))]}
                            value={selectedBrand}
                            onChange={setSelectedBrand}
                        />
                        <CustomSelect
                            icon={<Globe size={16} />}
                            placeholder={t('dealersPage.allLanguages')}
                            options={[{ value: '', label: t('dealersPage.allLanguages') }, ...filterOptions.languages.map(l => ({ value: l, label: l }))]}
                            value={selectedLanguage}
                            onChange={setSelectedLanguage}
                        />
                        <CustomSelect
                            icon={<ListFilter size={16} />}
                            placeholder={t('dealersPage.sortBy')}
                            options={sortOptions}
                            value={sortBy}
                            onChange={setSortBy}
                        />
                        <button
                            onClick={clearFilters}
                            className="flex h-[46px] w-full items-center justify-center rounded-md bg-vivid-red px-6 py-2.5 font-bold text-white transition-colors hover:bg-opacity-90 sm:col-span-2 xl:col-span-1"
                        >
                            {t('dealersPage.clearFilters')}
                        </button>
                    </div>
                </div>


                {filteredDealers.length > 0 ? (
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredDealers.map(dealer => <DealerCard key={dealer.id} dealer={dealer} />)}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-10">{t('dealersPage.noResults')}</p>
                )}

                <section className="mt-16">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl sm:p-10">
                        <h2 className="text-center text-3xl font-bold text-white">{t('dealersPage.insightsTitle')}</h2>
                        <p className="mt-4 mx-auto max-w-4xl text-center text-gray-300">{t('dealersPage.insightsSubtitle')}</p>
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
                        <h2 className="text-3xl font-bold text-white text-center">{t('dealersPage.faqTitle')}</h2>
                        <p className="mt-3 text-gray-300 text-center">{t('dealersPage.faqSubtitle')}</p>
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
    );
};

export default DealersListPage;