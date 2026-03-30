
import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import { SITE_LOGO, SITE_LOGO_ALT } from '../constants/media';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const pillars = t('aboutPage.pillars', { returnObjects: true }) as Array<{ title: string; description: string }>;
  const faqItems = t('aboutPage.faqItems', { returnObjects: true }) as Array<{ question: string; answer: string }>;

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: t('aboutPage.metaTitle'),
      description: t('aboutPage.metaDescription'),
      url: `${BASE_URL}/about/`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Makina Elektrike',
      url: BASE_URL,
      description: t('aboutPage.metaDescription'),
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

  return (
    <div className="py-16">
      <SEO
        title={t('aboutPage.metaTitle')}
        description={t('aboutPage.metaDescription')}
        keywords={t('aboutPage.metaKeywords', { returnObjects: true }) as string[]}
        canonical={`${BASE_URL}/about/`}
        openGraph={{
          title: t('aboutPage.metaTitle'),
          description: t('aboutPage.metaDescription'),
          url: `${BASE_URL}/about/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: t('aboutPage.metaTitle'),
          description: t('aboutPage.metaDescription'),
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="p-8 md:p-12">
            <div className="text-center mb-8">
                <img
                  src={SITE_LOGO}
                  alt={SITE_LOGO_ALT}
                  className="mx-auto h-24 w-auto rounded md:h-28"
                />
                <h1 className="text-4xl font-extrabold text-white sm:text-5xl mt-4">
                  {t('aboutPage.title')}
                </h1>
            </div>
            <div className="mt-8 text-lg text-gray-300 space-y-6 prose prose-lg prose-invert max-w-none">
              <p>{t('aboutPage.p1')}</p>
              <p>{t('aboutPage.p2')}</p>
              <p>{t('aboutPage.p3')}</p>
              <p>{t('aboutPage.p4')}</p>
            </div>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              {pillars.map(pillar => (
                <div key={pillar.title} className="bg-black/30 border border-white/10 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-white">{pillar.title}</h3>
                  <p className="mt-3 text-gray-300 leading-relaxed">{pillar.description}</p>
                </div>
              ))}
            </div>
            <section className="mt-12 bg-black/30 border border-white/10 rounded-xl p-6 text-left space-y-4">
              <h2 className="text-2xl font-semibold text-white">{t('aboutPage.transparencyTitle')}</h2>
              <p className="text-gray-300 leading-relaxed">{t('aboutPage.transparencyP1')}</p>
              <p className="text-gray-300 leading-relaxed">{t('aboutPage.transparencyP2')}</p>
              <p className="text-gray-300 leading-relaxed">{t('aboutPage.transparencyP3')}</p>
            </section>

            <section className="mt-12 bg-gradient-to-r from-gray-cyan/20 to-vivid-red/20 border border-white/10 rounded-xl p-8 text-center space-y-4 relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-3xl font-bold text-white">{t('aboutPage.collaborationCtaTitle')}</h2>
                <p className="mt-3 text-gray-300 text-lg max-w-2xl mx-auto">{t('aboutPage.collaborationCtaDescription')}</p>
                <div className="pt-6">
                  <a href="/contact" className="inline-flex justify-center rounded-md border border-transparent bg-vivid-red px-8 py-3 text-base font-medium text-white shadow-sm transition-all hover:bg-opacity-90 hover:shadow-lg hover:shadow-vivid-red/50 focus:outline-none focus:ring-2 focus:ring-vivid-red focus:ring-offset-2">
                    {t('aboutPage.collaborationCtaButton')}
                  </a>
                </div>
              </div>
            </section>
          </div>
          <div className="mt-8">
              <img src="https://picsum.photos/seed/about-us/1024/400" alt="Electric car charging" className="w-full object-cover" />
          </div>
        </div>
        <section className="mt-12 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center">{t('aboutPage.faqTitle')}</h2>
          <p className="mt-3 text-gray-300 text-center">{t('aboutPage.faqSubtitle')}</p>
          <div className="mt-8 space-y-6">
            {faqItems.map(faq => (
              <div key={faq.question} className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                <p className="mt-2 text-gray-300 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
