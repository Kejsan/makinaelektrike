
import React, { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BlogCard from '../components/BlogCard';
import { DataContext } from '../contexts/DataContext';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import { getLocalizedBlogPost } from '../utils/localizedBlogPost';

const BlogPage: React.FC = () => {
  const { i18n, t } = useTranslation();
  const { blogPosts, loading } = useContext(DataContext);
  const activeLanguage = i18n.resolvedLanguage || i18n.language;
  const localizedBlogPosts = useMemo(
    () => blogPosts.map(post => getLocalizedBlogPost(post, activeLanguage)),
    [blogPosts, activeLanguage],
  );
  const insights = t('blogPage.insights', { returnObjects: true }) as Array<{ title: string; description: string }>;
  const faqItems = t('blogPage.faqItems', { returnObjects: true }) as Array<{ question: string; answer: string }>;

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: t('blogPage.metaTitle'),
      description: t('blogPage.metaDescription'),
      url: `${BASE_URL}/blog/`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: t('blogPage.metaTitle'),
      itemListElement: localizedBlogPosts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: post.title,
        url: `${BASE_URL}/blog/${post.slug}`,
      })),
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

  if (loading) {
    return <div className="text-center py-10 text-white">Loading posts...</div>;
  }

  return (
    <div className="py-12">
      <SEO
        title={t('blogPage.metaTitle')}
        description={t('blogPage.metaDescription')}
        keywords={t('blogPage.metaKeywords', { returnObjects: true }) as string[]}
        canonical={`${BASE_URL}/blog/`}
        openGraph={{
          title: t('blogPage.metaTitle'),
          description: t('blogPage.metaDescription'),
          url: `${BASE_URL}/blog/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: t('blogPage.metaTitle'),
          description: t('blogPage.metaDescription'),
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white">{t('blogPage.title')}</h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-400">{t('blogPage.subtitle')}</p>
        </div>
        <div className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
          <h2 className="text-2xl font-bold text-white">{t('blogPage.introTitle')}</h2>
          <p className="mt-4 text-gray-300 max-w-3xl mx-auto leading-relaxed">{t('blogPage.introSubtitle')}</p>
        </div>
        <div className="mt-12 max-w-lg mx-auto grid gap-8 lg:grid-cols-3 lg:max-w-none">
          {localizedBlogPosts.map(post => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
        <section className="mt-16">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 shadow-2xl">
            <h2 className="text-3xl font-bold text-white text-center">{t('blogPage.insightsTitle')}</h2>
            <p className="mt-4 text-gray-300 text-center max-w-4xl mx-auto">{t('blogPage.insightsSubtitle')}</p>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              {insights.map(item => (
                <div key={item.title} className="bg-black/30 border border-gray-800 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-gray-300 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center">{t('blogPage.faqTitle')}</h2>
          <p className="mt-3 text-gray-300 text-center">{t('blogPage.faqSubtitle')}</p>
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

export default BlogPage;
