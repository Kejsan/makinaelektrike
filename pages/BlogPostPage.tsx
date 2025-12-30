import React, { useContext, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, ArrowLeft, Tag, HelpCircle } from 'lucide-react';
import { DataContext } from '../contexts/DataContext';
import type { BlogPostList } from '../types';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleDateString('sq-AL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const renderList = (list: BlogPostList) => {
  if (!list.items.length) {
    return null;
  }

  if (list.ordered) {
    return (
      <ol className="list-decimal list-inside space-y-2 text-gray-200">
        {list.items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }

  return (
    <ul className="list-disc list-inside space-y-2 text-gray-200">
      {list.items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
};

const BlogPostPage: React.FC = () => {
  const { slug } = useParams();
  const { blogPosts } = useContext(DataContext);

  const post = useMemo(
    () => blogPosts.find(entry => entry.slug === slug),
    [blogPosts, slug],
  );

  if (!post) {
    return (
      <div className="py-24">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <SEO
            title="Artikulli nuk u gjet | Makina Elektrike"
            description="Artikulli i kërkuar nuk ekziston më ose është zhvendosur."
            canonical={`${BASE_URL}/blog/${slug ?? ''}`}
            openGraph={{
              title: 'Artikulli nuk u gjet | Makina Elektrike',
              description: 'Artikulli i kërkuar nuk ekziston më ose është zhvendosur.',
              url: `${BASE_URL}/blog/${slug ?? ''}`,
              type: 'article',
              images: [DEFAULT_OG_IMAGE],
            }}
            twitter={{
              title: 'Artikulli nuk u gjet | Makina Elektrike',
              description: 'Artikulli i kërkuar nuk ekziston më ose është zhvendosur.',
              image: DEFAULT_OG_IMAGE,
              site: '@makinaelektrike',
            }}
          />
          <h1 className="text-3xl font-bold">Artikulli nuk u gjet</h1>
          <p className="mt-4 text-gray-300">
            Përmbajtja që po kërkoni mund të jetë zhvendosur ose nuk ekziston më.
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 mt-8 rounded-lg bg-gray-cyan px-5 py-3 font-semibold text-white transition hover:bg-gray-cyan/90"
          >
            <ArrowLeft size={18} />
            Kthehu te blogu
          </Link>
        </div>
      </div>
    );
  }

  const canonical = `${BASE_URL}/blog/${post.slug}`;
  const faqEntities = post.faqs?.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  }));

  const structuredData: any[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.metaDescription,
      image: [post.imageUrl],
      datePublished: post.date,
      author: {
        '@type': 'Person',
        name: post.author,
      },
      publisher: {
        '@type': 'Organization',
        name: 'Makina Elektrike',
        url: BASE_URL,
      },
      mainEntityOfPage: canonical,
      keywords: post.tags.join(', '),
      articleSection: post.tags,
    },
  ];

  if (faqEntities && faqEntities.length > 0) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqEntities,
    });
  }

  return (
    <article className="py-12">
      <SEO
        title={post.metaTitle}
        description={post.metaDescription}
        keywords={post.tags}
        canonical={canonical}
        openGraph={{
          title: post.metaTitle,
          description: post.metaDescription,
          url: canonical,
          type: 'article',
          images: [post.imageUrl],
        }}
        twitter={{
          title: post.metaTitle,
          description: post.metaDescription,
          image: post.imageUrl,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />
      <div className="relative h-72 sm:h-96">
        <img
          src={post.imageUrl}
          alt={post.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
        <div className="relative h-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-10">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition mb-4">
            <ArrowLeft size={16} />
            Kthehu te të gjitha artikujt
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-gray-200 text-sm">
            <span>{formatDate(post.date)}</span>
            <span className="flex items-center gap-1"><Clock size={16} /> {post.readTime}</span>
            <span>nga {post.author}</span>
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold text-white drop-shadow-lg">
            {post.title}
          </h1>
          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                  <Tag size={14} /> #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 space-y-12">
        {post.sections.map(section => (
          <section key={section.id} className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-4">{section.heading}</h2>
            <div className="space-y-4 text-gray-200 leading-relaxed">
              {section.paragraphs.map((paragraph, pIdx) => (
                <p key={pIdx}>{paragraph}</p>
              ))}
              {section.highlight && (
                <div className="rounded-xl border border-gray-cyan/40 bg-gray-cyan/10 p-4 text-gray-100">
                  {section.highlight}
                </div>
              )}
              {section.list && renderList(section.list)}
            </div>
          </section>
        ))}

        {post.faqs && post.faqs.length > 0 && (
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <HelpCircle size={24} /> Pyetje të shpeshta
            </h2>
            <div className="space-y-6">
              {post.faqs.map(faq => (
                <div key={faq.question} className="border-b border-white/10 pb-4 last:border-none last:pb-0">
                  <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                  <p className="mt-2 text-gray-200 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {post.cta && (
          <div className="text-center">
            <Link
              to={post.cta.url}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-cyan px-6 py-3 text-lg font-semibold text-white transition hover:bg-gray-cyan/90"
            >
              {post.cta.text}
            </Link>
          </div>
        )}
      </div>
    </article>
  );
};

export default BlogPostPage;
