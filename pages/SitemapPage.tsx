import React, { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { DataContext } from '../contexts/DataContext';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import Link from '../components/LocalizedLink';

const SitemapPage: React.FC = () => {
  const { t } = useTranslation();
  const { dealers, models, blogPosts } = useContext(DataContext);

  const navigationSections = useMemo(
    () => [
      {
        title: t('sitemap.sections.explore.title'),
        items: [
          { to: '/', label: t('header.home') },
          { to: '/dealers', label: t('header.dealers') },
          { to: '/models', label: t('header.models') },
          { to: '/albania-charging-stations', label: t('header.chargingStations') },
          { to: '/blog', label: t('header.blog') },
        ],
      },
      {
        title: t('sitemap.sections.services.title'),
        items: [
          { to: '/register', label: t('footer.userSignup') },
          { to: '/register-dealer', label: t('footer.dealerSignup') },
          { to: '/favorites', label: t('header.favorites') },
        ],
      },
      {
        title: t('sitemap.sections.company.title'),
        items: [
          { to: '/about', label: t('header.about') },
          { to: '/help-center', label: t('header.helpCenter') },
          { to: '/contact', label: t('footer.contact') },
          { to: '/sitemap', label: t('footer.sitemap') },
        ],
      },
      {
        title: t('sitemap.sections.legal.title'),
        items: [
          { to: '/privacy-policy', label: t('footer.privacy') },
          { to: '/terms', label: t('footer.terms') },
          { to: '/cookie-policy', label: t('footer.cookies') },
        ],
      },
    ],
    [t]
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('sitemap.metaTitle'),
    description: t('sitemap.metaDescription'),
    url: `${BASE_URL}/sitemap/`,
  };

  return (
    <div className="py-12">
      <SEO
        title={t('sitemap.metaTitle')}
        description={t('sitemap.metaDescription')}
        keywords={t('sitemap.metaKeywords', { returnObjects: true }) as string[]}
        canonical={`${BASE_URL}/sitemap/`}
        openGraph={{
          title: t('sitemap.metaTitle'),
          description: t('sitemap.metaDescription'),
          url: `${BASE_URL}/sitemap/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: t('sitemap.metaTitle'),
          description: t('sitemap.metaDescription'),
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center md:text-left">
          <h1 className="text-4xl font-extrabold text-white">{t('sitemap.title')}</h1>
          <p className="mt-4 text-lg text-gray-300 max-w-3xl">{t('sitemap.subtitle')}</p>
        </header>

        <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {navigationSections.map(section => (
            <div key={section.title} className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <ul className="mt-4 space-y-3">
                {section.items.map(item => (
                  <li key={item.to}>
                    <Link to={item.to} className="text-gray-300 hover:text-white transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-2xl border border-gray-700/60 bg-black/30 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{t('sitemap.xmlTitle')}</h2>
              <p className="mt-2 text-gray-300 max-w-2xl">{t('sitemap.xmlDescription')}</p>
            </div>
            <a
              href={`${BASE_URL}/sitemap.xml`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-gray-cyan/40 bg-gray-cyan/20 px-6 py-3 text-base font-semibold text-white transition hover:bg-gray-cyan/30"
            >
              {t('sitemap.xmlCta')}
            </a>
          </div>
        </section>

        <section className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white">{t('sitemap.dynamic.dealers')}</h2>
            <p className="mt-2 text-sm text-gray-300">{t('sitemap.dynamic.dealersDescription')}</p>
            <ul className="mt-4 space-y-3">
              {dealers.slice(0, 6).map(dealer => (
                <li key={dealer.id}>
                  <Link to={`/dealers/${dealer.id}`} className="text-gray-300 hover:text-white transition-colors">
                    {dealer.name}
                  </Link>
                </li>
              ))}
            </ul>
            {dealers.length > 6 && (
              <Link to="/dealers" className="mt-4 inline-block text-sm font-semibold text-gray-cyan hover:text-white">
                {t('sitemap.dynamic.viewAllDealers')}
              </Link>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white">{t('sitemap.dynamic.models')}</h2>
            <p className="mt-2 text-sm text-gray-300">{t('sitemap.dynamic.modelsDescription')}</p>
            <ul className="mt-4 space-y-3">
              {models.slice(0, 6).map(model => (
                <li key={model.id}>
                  <Link to={`/models/${model.id}`} className="text-gray-300 hover:text-white transition-colors">
                    {model.brand} {model.model_name}
                  </Link>
                </li>
              ))}
            </ul>
            {models.length > 6 && (
              <Link to="/models" className="mt-4 inline-block text-sm font-semibold text-gray-cyan hover:text-white">
                {t('sitemap.dynamic.viewAllModels')}
              </Link>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white">{t('sitemap.dynamic.blog')}</h2>
            <p className="mt-2 text-sm text-gray-300">{t('sitemap.dynamic.blogDescription')}</p>
            <ul className="mt-4 space-y-3">
              {blogPosts.slice(0, 6).map(post => (
                <li key={post.slug}>
                  <Link to={`/blog/${post.slug}`} className="text-gray-300 hover:text-white transition-colors">
                    {post.title}
                  </Link>
                </li>
              ))}
            </ul>
            {blogPosts.length > 6 && (
              <Link to="/blog" className="mt-4 inline-block text-sm font-semibold text-gray-cyan hover:text-white">
                {t('sitemap.dynamic.viewAllPosts')}
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SitemapPage;
