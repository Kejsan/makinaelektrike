import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BlogPost } from '../types';
import { Car, Building, Search, Loader2 } from 'lucide-react';
import DealerCard from '../components/DealerCard';
import ModelCard from '../components/ModelCard';
import BlogCard from '../components/BlogCard';
import { DataContext } from '../contexts/DataContext';
import heroDashboard from '../assets/BYD SEAL.jpg';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { dealers, models, blogPosts, loading: dataLoading } = useContext(DataContext);

  const [featuredDealers, setFeaturedDealers] = useState(dealers.filter(d => d.isFeatured));
  const [featuredModels, setFeaturedModels] = useState(models.filter(m => m.isFeatured));
  const [latestPosts, setLatestPosts] = useState<BlogPost[]>([]);
  const [searchCity, setSearchCity] = useState('');
  const [searchBrand, setSearchBrand] = useState('');
  const [filteredDealersForSearch, setFilteredDealersForSearch] = useState(dealers.filter(d => d.isFeatured));
  const [isSearching, setIsSearching] = useState(false);
  const heroTaglinesRaw = t('home.heroTaglines', { returnObjects: true }) as unknown;
  const heroTaglines = useMemo(() => {
    if (Array.isArray(heroTaglinesRaw) && heroTaglinesRaw.length > 0) {
      return heroTaglinesRaw as string[];
    }
    const fallback = typeof heroTaglinesRaw === 'string' && heroTaglinesRaw.trim().length
      ? heroTaglinesRaw
      : t('home.heroSubtitle');
    return [fallback];
  }, [heroTaglinesRaw, t]);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const valueHighlights = t('home.valueHighlights', { returnObjects: true }) as Array<{ title: string; description: string }>;
  const insightItems = t('home.insights', { returnObjects: true }) as Array<{ title: string; description: string }>;
  const faqItems = t('home.faqItems', { returnObjects: true }) as Array<{ question: string; answer: string }>;

  const heroImageUrl = typeof window !== 'undefined'
    ? new URL(heroDashboard, window.location.origin).toString()
    : heroDashboard;

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Makina Elektrike',
      url: BASE_URL,
      description: t('home.metaDescription'),
      potentialAction: {
        '@type': 'SearchAction',
        target: `${BASE_URL}/models/?query={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Makina Elektrike',
      url: BASE_URL,
      sameAs: [
        'https://www.facebook.com',
        'https://www.instagram.com',
        'https://www.linkedin.com',
      ],
      description: t('home.metaDescription'),
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

  useEffect(() => {
    // Update featured lists when context data changes
    setFeaturedDealers(dealers.filter(d => d.isFeatured));
    setFeaturedModels(models.filter(m => m.isFeatured));

    // Initial search result should be the featured dealers
    setFilteredDealersForSearch(dealers.filter(d => d.isFeatured));
  }, [dealers, models]);

  useEffect(() => {
    setLatestPosts(blogPosts.slice(0, 3));
  }, [blogPosts]);

  useEffect(() => {
    if (!heroTaglines.length) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTaglineIndex(prev => (prev + 1) % heroTaglines.length);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [heroTaglines.length]);

  useEffect(() => {
    let results = dealers;

    const city = searchCity.trim().toLowerCase();
    const brand = searchBrand.trim().toLowerCase();

    if (city === '' && brand === '') {
      setFilteredDealersForSearch(featuredDealers);
      return;
    }

    if (city) {
      results = results.filter(d => 
        d.city.toLowerCase().includes(city)
      );
    }

    if (brand) {
      results = results.filter(d => 
        d.brands.some(b => b.toLowerCase().includes(brand))
      );
    }

    setFilteredDealersForSearch(results.slice(0, 4));
  }, [searchCity, searchBrand, dealers, featuredDealers]);

  const cityOptions = useMemo(() => Array.from(new Set((dealers || []).map(dealer => dealer.city))).filter((city): city is string => !!city).sort((a, b) => a.localeCompare(b)), [dealers]);

  const brandOptions = useMemo(() => {
    const brands = new Set<string>();
    (dealers || []).forEach(dealer => {
      (dealer.brands || []).forEach(brand => brands.add(brand));
    });
    return Array.from(brands).sort((a, b) => a.localeCompare(b));
  }, [dealers]);

  const handleSearch = () => {
    setIsSearching(true);
    window.setTimeout(() => {
      setIsSearching(false);
    }, 600);
  };

  const searchSummary = useMemo(() => {
    if (!searchCity && !searchBrand) {
      return t('home.searchLiveResultsDefault');
    }
    if (!filteredDealersForSearch.length) {
      return t('home.searchLiveResultsEmpty');
    }
    return t('home.searchLiveResults', {
      count: filteredDealersForSearch.length,
      city: searchCity || t('common.anyCity'),
      brand: searchBrand || t('common.anyBrand'),
    });
  }, [filteredDealersForSearch.length, searchBrand, searchCity, t]);

  
  return (
    <div>
      <SEO
        title={t('home.metaTitle')}
        description={t('home.metaDescription')}
        keywords={t('home.metaKeywords', { returnObjects: true }) as string[]}
        canonical={`${BASE_URL}/`}
        openGraph={{
          title: t('home.metaTitle'),
          description: t('home.metaDescription'),
          url: `${BASE_URL}/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE, heroImageUrl],
        }}
        twitter={{
          title: t('home.metaTitle'),
          description: t('home.metaDescription'),
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />
      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-[#00001a] text-center text-white">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{ backgroundImage: `url(${heroDashboard})` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#00001a]/70 via-[#000025]/60 to-[#000033]/95" aria-hidden="true" />
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-24 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-gray-300">
            <span key={`${heroTaglines[taglineIndex]}-${taglineIndex}`} className="tagline-rotate inline-flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-gray-cyan" aria-hidden="true" />
              {heroTaglines[taglineIndex] || ''}
              <span className="h-1 w-1 rounded-full bg-gray-cyan" aria-hidden="true" />
            </span>
          </p>
          <h1
            className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl"
            style={{ textShadow: '0 0 20px rgba(84, 160, 155, 0.5)' }}
          >
            {t('home.heroTitle')}
          </h1>
          <p className="mt-6 max-w-3xl text-base text-gray-300 sm:text-lg md:text-xl">{t('home.heroSubtitle')}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/models"
              className="inline-flex items-center justify-center rounded-full bg-gray-cyan px-8 py-3 text-base font-semibold text-navy-blue shadow-lg shadow-gray-cyan/40 transition-transform duration-200 hover:-translate-y-1 hover:bg-opacity-90"
            >
              {t('home.heroPrimaryCta')}
            </Link>
            <Link
              to="/dealers"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-3 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-1 hover:border-gray-cyan/70 hover:bg-white/10"
            >
              {t('home.heroSecondaryCta')}
            </Link>
          </div>
          <a
            href="#search-section"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-300 transition-colors hover:text-white"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs">⌄</span>
            {t('home.heroCta')}
          </a>
        </div>
      </section>

      {/* Search Section */}
      <section id="search-section" className="-mt-16 pb-4 pt-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-3xl font-bold text-white">{t('home.searchTitle')}</h2>
          <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-lg sm:p-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:items-end">
              <div className="w-full">
                <label htmlFor="city" className="mb-2 block text-sm font-medium text-gray-300">{t('home.cityPlaceholder')}</label>
                <div className="relative">
                  <Building className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    id="city"
                    list="city-options"
                    placeholder={t('home.cityPlaceholder')}
                    className="block w-full rounded-md border border-gray-600 bg-white/10 py-2.5 pl-10 text-white shadow-sm focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                  />
                  <datalist id="city-options">
                    {cityOptions.map(city => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="w-full">
                <label htmlFor="brand" className="mb-2 block text-sm font-medium text-gray-300">{t('home.brandPlaceholder')}</label>
                <div className="relative">
                  <Car className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    id="brand"
                    list="brand-options"
                    placeholder={t('home.brandPlaceholder')}
                    className="block w-full rounded-md border border-gray-600 bg-white/10 py-2.5 pl-10 text-white shadow-sm focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                    value={searchBrand}
                    onChange={(e) => setSearchBrand(e.target.value)}
                  />
                  <datalist id="brand-options">
                    {brandOptions.map(brand => (
                      <option key={brand} value={brand} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="md:col-span-2 xl:col-span-1">
                <button
                  type="button"
                  onClick={handleSearch}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-cyan px-6 py-3 text-base font-semibold text-navy-blue transition-all hover:bg-opacity-90 disabled:opacity-70"
                  disabled={isSearching}
                >
                  {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  {isSearching ? t('common.loading') : t('home.searchButton')}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
              <p className="font-semibold text-white">{searchSummary}</p>
              {filteredDealersForSearch.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {filteredDealersForSearch.slice(0, 4).map(dealer => (
                    <Link
                      key={dealer.id}
                      to={`/dealers/${dealer.id}`}
                      className="group flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-4 py-3 text-white transition-all hover:border-gray-cyan/60 hover:bg-white/10"
                    >
                      <div>
                        <p className="text-sm font-semibold">{dealer.name}</p>
                        <p className="text-xs text-gray-400">
                          {dealer.city} • {dealer.brands.slice(0, 2).join(', ')}
                          {dealer.brands.length > 2 ? '…' : ''}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-gray-cyan transition-colors group-hover:text-white">
                        {t('home.searchSuggestionCta')}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white">{t('home.valueTitle')}</h2>
            <p className="mt-4 mx-auto max-w-3xl text-lg text-gray-300">{t('home.valueSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {valueHighlights.map(highlight => (
              <div key={highlight.title} className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-lg">
                <h3 className="text-xl font-semibold text-white">{highlight.title}</h3>
                <p className="mt-3 text-gray-300 leading-relaxed">{highlight.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Dealers */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-white">{t('home.featuredDealers')}</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dataLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <DealerCard key={`featured-dealer-skeleton-${index}`} isLoading />
              ))
            ) : filteredDealersForSearch.length > 0 ? (
              filteredDealersForSearch.map(dealer => <DealerCard key={dealer.id} dealer={dealer} />)
            ) : (
              <p className="col-span-full text-center text-gray-400">No dealers found matching your search.</p>
            )}
          </div>
          <div className="mt-12 text-center">
            <Link to="/dealers" className="inline-block bg-gray-cyan text-white font-bold py-3 px-8 rounded-md hover:bg-opacity-90 transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-gray-cyan/50">
              {t('home.seeAllDealers')}
            </Link>
          </div>
        </div>
      </section>

      {/* Market Insights */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-10 shadow-2xl">
            <div className="md:flex md:items-start md:justify-between gap-10">
              <div className="md:w-1/3 mb-8 md:mb-0">
                <h2 className="text-3xl font-bold text-white">{t('home.insightsTitle')}</h2>
                <p className="mt-4 text-gray-300 leading-relaxed">{t('home.insightsSubtitle')}</p>
              </div>
              <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {insightItems.map(item => (
                  <div key={item.title} className="bg-black/30 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-3 text-gray-300 text-sm leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Models */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-white">{t('home.featuredModels')}</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredModels.map(model => <ModelCard key={model.id} model={model} />)}
          </div>
          <div className="mt-12 text-center">
            <Link to="/models" className="inline-block rounded-md bg-gray-cyan px-8 py-3 text-base font-bold text-white transition-transform duration-200 hover:scale-105 hover:bg-opacity-90 hover:shadow-lg hover:shadow-gray-cyan/50">
              {t('home.seeAllModels')}
            </Link>
          </div>
        </div>
      </section>

      {/* From Our Blog */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">{t('home.fromOurBlog')}</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {latestPosts.map(post => <BlogCard key={post.id} post={post} />)}
          </div>
          <div className="mt-12 text-center">
            <Link to="/blog" className="inline-block rounded-md bg-gray-cyan px-8 py-3 text-base font-bold text-white transition-transform duration-200 hover:scale-105 hover:bg-opacity-90 hover:shadow-lg hover:shadow-gray-cyan/50">
              {t('home.seeAllPosts')}
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl sm:p-10">
            <h2 className="text-center text-3xl font-bold text-white">{t('home.faqTitle')}</h2>
            <p className="mt-4 mx-auto max-w-4xl text-center text-gray-300">{t('home.faqSubtitle')}</p>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {faqItems.map(faq => (
                <div key={faq.question} className="rounded-xl border border-gray-800 bg-black/30 p-6">
                  <h3 className="text-xl font-semibold text-white">{faq.question}</h3>
                  <p className="mt-3 text-gray-300 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
