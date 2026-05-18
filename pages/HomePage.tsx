import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import { BlogPost } from '../types';
import {
  ArrowRight,
  BatteryCharging,
  BookOpen,
  Building,
  Car,
  Loader2,
  MapPin,
  PlugZap,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Zap,
} from 'lucide-react';
import OptimizedImage from '../components/OptimizedImage';
import DealerCard from '../components/DealerCard';
import ModelCard from '../components/ModelCard';
import BlogCard from '../components/BlogCard';
import PublicPlacementRail from '../components/placements/PublicPlacementRail';
import VisitorEngagementSection from '../components/engagement/VisitorEngagementSection';
import { DataContext } from '../contexts/DataContext';
import { usePublicPlacements } from '../hooks/usePublicPlacements';
import { useSiteSettings } from '../hooks/useSiteSettings';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import { PUBLIC_PLACEMENT_ZONE_KEYS } from '../utils/placements';
import { chargingStationsData } from '../data/chargingStationsData';

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { dealers, models, listings, blogPosts, loading: dataLoading } = useContext(DataContext);
  const { settings: siteSettings } = useSiteSettings();
  const { zonesByKey: placementZones } = usePublicPlacements([
    PUBLIC_PLACEMENT_ZONE_KEYS.homeDealerSpotlight,
    PUBLIC_PLACEMENT_ZONE_KEYS.homeModelSpotlight,
    PUBLIC_PLACEMENT_ZONE_KEYS.homeBlogSpotlight,
  ]);

  const [featuredDealers, setFeaturedDealers] = useState(dealers.filter(d => d.isFeatured));
  const [featuredModels, setFeaturedModels] = useState(models.filter(m => m.isFeatured));
  const [latestPosts, setLatestPosts] = useState<BlogPost[]>([]);
  const [searchCity, setSearchCity] = useState('');
  const [searchBrand, setSearchBrand] = useState('');
  const [filteredDealersForSearch, setFilteredDealersForSearch] = useState(dealers.filter(d => d.isFeatured));
  const [isSearching, setIsSearching] = useState(false);
  const heroTaglinesRaw = t('home.heroTaglines', { returnObjects: true }) as unknown;
  const heroImages = siteSettings.homeHeroImages;
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const activeHeroImage = heroImages[heroImageIndex] ?? heroImages[0];
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
  const featuredDealerList = useMemo(() => {
    const seen = new Set<string>();
    return [...featuredDealers, ...dealers].filter(dealer => {
      if (seen.has(dealer.id)) {
        return false;
      }
      seen.add(dealer.id);
      return true;
    }).slice(0, 4);
  }, [dealers, featuredDealers]);
  const featuredModelList = useMemo(() => {
    const seen = new Set<string>();
    return [...featuredModels, ...models].filter(model => {
      if (seen.has(model.id)) {
        return false;
      }
      seen.add(model.id);
      return true;
    }).slice(0, 4);
  }, [featuredModels, models]);

  const heroImageUrl = activeHeroImage?.imageUrl
    ? typeof window !== 'undefined'
      ? new URL(activeHeroImage.imageUrl, window.location.origin).toString()
      : activeHeroImage.imageUrl
    : DEFAULT_OG_IMAGE;

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
        siteSettings.socialLinks.facebook,
        siteSettings.socialLinks.instagram,
        siteSettings.socialLinks.twitter,
        siteSettings.socialLinks.linkedin,
      ].filter(Boolean),
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
    setFeaturedDealers(dealers.filter(d => d.isFeatured));
    setFeaturedModels(models.filter(m => m.isFeatured));
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
    if (heroImageIndex >= heroImages.length) {
      setHeroImageIndex(0);
    }
  }, [heroImageIndex, heroImages.length]);

  useEffect(() => {
    if (heroImages.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setHeroImageIndex(prev => (prev + 1) % heroImages.length);
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, [heroImages.length]);

  useEffect(() => {
    let results = dealers;
    const city = searchCity.trim().toLowerCase();
    const brand = searchBrand.trim().toLowerCase();

    if (city === '' && brand === '') {
      setFilteredDealersForSearch(featuredDealerList);
      return;
    }

    if (city) {
      results = results.filter(d => (d.city || d.location || '').toLowerCase().includes(city));
    }

    if (brand) {
      results = results.filter(d => (d.brands || []).some(b => b.toLowerCase().includes(brand)));
    }

    setFilteredDealersForSearch(results.slice(0, 4));
  }, [searchCity, searchBrand, dealers, featuredDealerList]);

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

  const homeDealerPlacementZone =
    placementZones.get(PUBLIC_PLACEMENT_ZONE_KEYS.homeDealerSpotlight) ?? null;
  const homeModelPlacementZone =
    placementZones.get(PUBLIC_PLACEMENT_ZONE_KEYS.homeModelSpotlight) ?? null;
  const homeBlogPlacementZone =
    placementZones.get(PUBLIC_PLACEMENT_ZONE_KEYS.homeBlogSpotlight) ?? null;

  const liveSnapshot = [
    { id: 'dealers', label: t('home.statDealers', { defaultValue: 'Dealers' }), value: dataLoading ? '-' : dealers.length },
    { id: 'models', label: t('home.statModels', { defaultValue: 'EV models' }), value: dataLoading ? '-' : models.length },
    { id: 'listings', label: t('home.statListings', { defaultValue: 'Listings' }), value: dataLoading ? '-' : listings.length },
    { id: 'stations', label: t('home.statStations', { defaultValue: 'Charging stations' }), value: chargingStationsData.length || '-' },
  ];

  const heroProofPoints = [
    {
      icon: ShieldCheck,
      title: t('home.heroProofDealers', { defaultValue: 'Verified dealer network' }),
      body: t('home.heroProofDealersBody', { defaultValue: 'Find active EV sellers and contact the right showroom faster.' }),
    },
    {
      icon: PlugZap,
      title: t('home.heroProofCharging', { defaultValue: 'Charging coverage' }),
      body: t('home.heroProofChargingBody', { defaultValue: 'Plan around the public charging map before you commit.' }),
    },
  ];

  return (
    <div className="me-page">
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

      <section className="relative isolate overflow-hidden bg-slate-950">
        <div className="absolute inset-0" aria-hidden="true">
          {activeHeroImage && (
            <OptimizedImage
              key={activeHeroImage.id}
              src={activeHeroImage.imageUrl}
              srcSet={activeHeroImage.mobileImageUrl
                ? `${activeHeroImage.mobileImageUrl} 960w, ${activeHeroImage.imageUrl} 1600w`
                : undefined}
              sizes="100vw"
              alt=""
              priority
              className="h-full w-full object-cover transition-opacity duration-700"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/78 to-slate-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020817] via-transparent to-slate-950/55" />
        </div>

        <div className="me-shell relative z-10 grid min-h-[calc(100dvh-5rem)] min-w-0 items-center gap-10 py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.68fr)] lg:py-20">
          <div className="min-w-0 w-full max-w-full sm:max-w-3xl">
            <p className="me-eyebrow">
              <Zap className="h-4 w-4" />
              <span key={`${heroTaglines[taglineIndex]}-${taglineIndex}`} className="tagline-rotate">
                {heroTaglines[taglineIndex] || ''}
              </span>
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              {t('home.heroTitle')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
              {t('home.heroSubtitle')}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/listings" className="me-button-primary w-full sm:w-auto">
                <Car className="h-5 w-5" />
                <span className="min-w-0">{t('home.heroListingsCta', { defaultValue: 'View EVs for sale' })}</span>
              </Link>
              <Link to="/dealers" className="me-button-secondary w-full sm:w-auto">
                <Building className="h-5 w-5" />
                <span className="min-w-0">{t('home.heroSecondaryCta')}</span>
              </Link>
            </div>
          </div>

          <div className="me-card min-w-0 w-full max-w-[22rem] p-4 sm:p-5 lg:ml-auto lg:max-w-md">
            <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-cyan text-slate-950">
                  <BatteryCharging className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{t('home.liveSnapshotTitle', { defaultValue: 'Current live snapshot' })}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {liveSnapshot.map(item => (
                  <div key={`hero-card-${item.id}`} className="min-w-0 rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3">
                    <p className="text-xl font-black text-white">{item.value}</p>
                    <p className="mt-1 break-words text-[10px] font-semibold uppercase text-slate-500 sm:text-[11px]">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {heroProofPoints.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex items-start gap-3 rounded-lg border border-white/10 bg-slate-950/55 p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gray-cyan/10 text-gray-cyan">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{item.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{item.body}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="search-section" className="relative z-20 -mt-8 pb-8">
        <div className="me-shell">
          <div className="me-card p-5 sm:p-6 lg:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.76fr)_minmax(340px,0.5fr)] lg:items-start">
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="me-eyebrow">
                      <Search className="h-4 w-4" />
                      {t('home.dealerSearchEyebrow', { defaultValue: 'Find a dealer' })}
                    </p>
                    <h2 className="me-heading mt-3">{t('home.dealerSearchTitle', { defaultValue: 'Find a verified EV dealer' })}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                      {t('home.dealerSearchDescription', {
                        defaultValue: 'Search by city or brand, then open the dealer profile for contact details, supported brands, and showroom information.',
                      })}
                    </p>
                  </div>
                  <Link to="/dealers" className="me-button-secondary">
                    {t('home.seeAllDealers')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
                  <div>
                    <label htmlFor="city" className="mb-2 block text-sm font-semibold text-slate-300">{t('home.cityPlaceholder')}</label>
                    <div className="relative">
                      <Building className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        id="city"
                        list="city-options"
                        placeholder={t('home.cityPlaceholder')}
                        className="me-input pl-11"
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
                  <div>
                    <label htmlFor="brand" className="mb-2 block text-sm font-semibold text-slate-300">{t('home.brandPlaceholder')}</label>
                    <div className="relative">
                      <Car className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        id="brand"
                        list="brand-options"
                        placeholder={t('home.brandPlaceholder')}
                        className="me-input pl-11"
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
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="me-button-primary w-full xl:w-auto"
                    disabled={isSearching}
                  >
                    {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    {isSearching ? t('common.loading') : t('home.searchButton')}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-white">{searchSummary}</p>
                {filteredDealersForSearch.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {filteredDealersForSearch.slice(0, 4).map(dealer => (
                      <Link
                        key={dealer.id}
                        to={`/dealers/${dealer.id}`}
                        className="group flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 transition hover:border-gray-cyan/50 hover:bg-gray-cyan/10"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-cyan/15 text-gray-cyan">
                          <MapPin className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">{dealer.name}</span>
                          <span className="block truncate text-xs text-slate-400">
                            {dealer.city || dealer.location || t('common.unknownCity')} - {(dealer.brands || []).slice(0, 2).join(', ')}
                            {(dealer.brands || []).length > 2 ? '...' : ''}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-gray-cyan" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">{t('home.searchLiveResultsEmpty')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicPlacementRail
        zone={homeDealerPlacementZone}
        eyebrow={t('placements.eyebrow', { defaultValue: 'Platform spotlight' })}
        title={t('home.sponsoredDealerSpotlight', { defaultValue: 'Sponsored dealer spotlight' })}
        className="pb-10 pt-2"
      />

      <VisitorEngagementSection
        models={models}
        dealers={dealers}
        listings={listings}
        stationCount={chargingStationsData.length}
      />

      <section className="me-section">
        <div className="me-shell">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="me-eyebrow">
              <Sparkles className="h-4 w-4" />
              {t('home.valueEyebrow', { defaultValue: 'Better decisions' })}
            </p>
            <h2 className="me-heading mt-3">{t('home.valueTitle')}</h2>
            <p className="me-copy mt-4">{t('home.valueSubtitle')}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {valueHighlights.map((highlight, index) => {
              const icons = [ShieldCheck, UsersRound, BatteryCharging];
              const Icon = icons[index % icons.length];
              return (
                <article key={highlight.title} className="me-card me-card-hover p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-cyan/15 text-gray-cyan">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white">{highlight.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{highlight.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="me-section">
        <div className="me-shell">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="me-eyebrow">
                <Building className="h-4 w-4" />
                {t('header.dealers')}
              </p>
              <h2 className="me-heading mt-3">{t('home.featuredDealers')}</h2>
            </div>
            <Link to="/dealers" className="me-button-secondary">
              {t('home.seeAllDealers')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dataLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <DealerCard key={`featured-dealer-skeleton-${index}`} isLoading />
              ))
            ) : featuredDealerList.length > 0 ? (
              featuredDealerList.map(dealer => <DealerCard key={dealer.id} dealer={dealer} />)
            ) : (
              <p className="col-span-full text-center text-slate-400">{t('dealersPage.noResults')}</p>
            )}
          </div>
        </div>
      </section>

      <section className="me-section">
        <div className="me-shell">
          <div className="me-card border-gray-cyan/20 bg-[#000080]/20 p-6 sm:p-8">
            <div className="mx-auto mb-8 max-w-3xl text-center">
              <p className="me-eyebrow">
                <Zap className="h-4 w-4" />
                {t('home.chargingConfidenceEyebrow', { defaultValue: 'Charging confidence' })}
              </p>
              <h2 className="me-heading mt-3">{t('home.insightsTitle')}</h2>
              <p className="me-copy mt-4">{t('home.insightsSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {insightItems.map((item, index) => (
                <article key={item.title} className="rounded-lg border border-white/10 bg-slate-950/65 p-5">
                  <div className="mb-4 h-1.5 w-12 rounded-full bg-gray-cyan" aria-hidden="true" />
                  <h3 className="text-base font-bold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p>
                  <p className="mt-4 text-xs font-black text-slate-600">0{index + 1}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PublicPlacementRail
        zone={homeModelPlacementZone}
        eyebrow={t('placements.eyebrow', { defaultValue: 'Platform spotlight' })}
        title={t('home.sponsoredModelSpotlight', { defaultValue: 'Sponsored vehicle spotlight' })}
        className="pb-10 pt-2"
      />

      <section className="me-section">
        <div className="me-shell">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="me-eyebrow">
                <Car className="h-4 w-4" />
                {t('header.models')}
              </p>
              <h2 className="me-heading mt-3">{t('home.featuredModels')}</h2>
            </div>
            <Link to="/models" className="me-button-secondary">
              {t('home.seeAllModels')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredModelList.map(model => <ModelCard key={model.id} model={model} />)}
          </div>
        </div>
      </section>

      <PublicPlacementRail
        zone={homeBlogPlacementZone}
        eyebrow={t('placements.eyebrow', { defaultValue: 'Platform spotlight' })}
        title={t('home.sponsoredEditorialSpotlight', { defaultValue: 'Sponsored editorial spotlight' })}
        className="pb-10 pt-2"
      />

      <section className="me-section">
        <div className="me-shell">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="me-eyebrow">
                <BookOpen className="h-4 w-4" />
                {t('header.blog')}
              </p>
              <h2 className="me-heading mt-3">{t('home.fromOurBlog')}</h2>
            </div>
            <Link to="/blog" className="me-button-secondary">
              {t('home.seeAllPosts')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {latestPosts.map(post => <BlogCard key={post.id} post={post} />)}
          </div>
        </div>
      </section>

      <section className="me-section pb-8">
        <div className="me-shell">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <p className="me-eyebrow">
                <ShieldCheck className="h-4 w-4" />
                FAQ
              </p>
              <h2 className="me-heading mt-3">{t('home.faqTitle')}</h2>
              <p className="me-copy mt-4">{t('home.faqSubtitle')}</p>
            </div>
            <div className="space-y-3">
              {faqItems.map(faq => (
                <details key={faq.question} className="group rounded-lg border border-white/10 bg-slate-950/55 p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-bold text-white">
                    {faq.question}
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-cyan transition group-open:rotate-90" />
                  </summary>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
