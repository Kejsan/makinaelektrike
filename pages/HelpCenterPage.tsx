import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  CarFront,
  ClipboardCheck,
  LifeBuoy,
  MapPinned,
  MessageSquareMore,
  PlugZap,
  Store,
} from 'lucide-react';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import { getHelpCenterContent } from '../data/helpCenterContent';

const iconMap = {
  'getting-started': BookOpen,
  'research-and-compare': CarFront,
  'dealers-and-enquiries': Store,
  'charging-and-ownership': PlugZap,
  'accounts-and-onboarding': ClipboardCheck,
  troubleshooting: LifeBuoy,
} as const;

const HelpCenterPage: React.FC = () => {
  const { i18n } = useTranslation();
  const content = getHelpCenterContent(i18n.resolvedLanguage ?? i18n.language);
  const canonical = `${BASE_URL}/help-center/`;

  const structuredData = useMemo(
    () => [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: content.metaTitle,
        description: content.metaDescription,
        url: canonical,
        isPartOf: {
          '@type': 'WebSite',
          name: 'Makina Elektrike',
          url: BASE_URL,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${BASE_URL}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: content.title,
            item: canonical,
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: content.sectionNavLabel,
        itemListElement: content.sections.map((section, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${canonical}#${section.id}`,
          name: section.title,
        })),
      },
    ],
    [canonical, content],
  );

  return (
    <div className="py-12 text-white">
      <SEO
        title={content.metaTitle}
        description={content.metaDescription}
        keywords={content.metaKeywords}
        canonical={canonical}
        openGraph={{
          title: content.metaTitle,
          description: content.metaDescription,
          url: canonical,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: content.metaTitle,
          description: content.metaDescription,
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />

      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 shadow-2xl md:px-10">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-4 py-1 text-sm font-semibold text-gray-cyan">
              <MessageSquareMore className="h-4 w-4" />
              Makina Elektrike
            </div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">{content.title}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-300">{content.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/models"
                className="inline-flex items-center justify-center rounded-lg bg-gray-cyan px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {content.quickLinks[0]?.label}
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
              >
                {content.supportPrimaryLabel}
              </Link>
            </div>
          </div>
        </header>

        <section aria-labelledby="help-center-quick-links">
          <div className="mb-6 flex flex-col gap-2">
            <h2 id="help-center-quick-links" className="text-2xl font-bold">
              {content.quickLinksTitle}
            </h2>
            <p className="max-w-3xl text-gray-300">{content.quickLinksSubtitle}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {content.quickLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-gray-cyan/40 hover:bg-white/[0.07]"
              >
                <div className="text-base font-semibold text-white">{link.label}</div>
                <p className="mt-2 text-sm leading-6 text-gray-300">{link.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="help-center-sections">
          <div className="mb-6 flex flex-col gap-3">
            <h2 id="help-center-sections" className="text-2xl font-bold">
              {content.sectionNavLabel}
            </h2>
            <div className="flex flex-wrap gap-2">
              {content.sections.map(section => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-cyan/40 hover:text-white"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {content.sections.map(section => {
              const Icon = iconMap[section.id as keyof typeof iconMap] ?? BookOpen;

              return (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-28 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl md:p-8"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-3xl">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gray-cyan/15 text-gray-cyan">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-2xl font-bold text-white">{section.title}</h3>
                      <p className="mt-3 text-base leading-7 text-gray-300">{section.summary}</p>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-5 xl:grid-cols-2">
                    {section.articles.map(article => (
                      <article
                        key={article.title}
                        className="flex h-full flex-col rounded-2xl border border-white/10 bg-slate-950/35 p-5"
                      >
                        <h4 className="text-lg font-semibold text-white">{article.title}</h4>
                        <p className="mt-3 text-sm leading-7 text-gray-300">{article.body}</p>
                        <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-200">
                          {article.bullets.map(item => (
                            <li key={item} className="flex gap-3">
                              <MapPinned className="mt-1 h-4 w-4 flex-none text-gray-cyan" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                        {article.ctaLabel && article.ctaTo ? (
                          <div className="mt-5">
                            <Link
                              to={article.ctaTo}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-cyan/35 px-4 py-2 text-sm font-semibold text-white transition hover:border-gray-cyan hover:bg-gray-cyan/10"
                            >
                              {article.ctaLabel}
                            </Link>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-gray-cyan/10 p-6 shadow-2xl md:p-8">
          <h2 className="text-2xl font-bold text-white">{content.supportTitle}</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-gray-300">{content.supportBody}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={content.supportPrimaryTo}
              className="inline-flex items-center justify-center rounded-lg bg-gray-cyan px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              {content.supportPrimaryLabel}
            </Link>
            <Link
              to={content.supportSecondaryTo}
              className="inline-flex items-center justify-center rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
            >
              {content.supportSecondaryLabel}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HelpCenterPage;
