import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { BlogPost } from '../types';
import { ArrowRight } from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import Link from './LocalizedLink';
import { getLocalizedBlogPost, hasLocalizedBlogContent } from '../utils/localizedBlogPost';
import { DEFAULT_LOCALE, normalizeAppLocale } from '../utils/localizedRouting';

const formatDate = (value: string, language: string) => {
  try {
    return new Date(value).toLocaleDateString(language || 'sq', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const BlogCard: React.FC<{ post: BlogPost }> = ({ post }) => {
  const { i18n, t } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage || i18n.language;
  const activeLocale = normalizeAppLocale(activeLanguage);
  const localizedPost = getLocalizedBlogPost(post, activeLanguage);
  const shouldUseLocalizedRoute =
    activeLocale === DEFAULT_LOCALE || hasLocalizedBlogContent(post, activeLanguage);
  const ArticleLink = shouldUseLocalizedRoute ? Link : RouterLink;

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-lg overflow-hidden group transition-all duration-300 transform hover:-translate-y-1 hover:shadow-neon-cyan">
      <div className="overflow-hidden">
        <OptimizedImage
          className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300"
          src={localizedPost.imageUrl}
          alt={localizedPost.title}
        />
      </div>
      <div className="p-6">
        <p className="text-sm text-gray-400">
          {formatDate(localizedPost.date, i18n.resolvedLanguage || i18n.language)} &bull; {localizedPost.readTime} &bull; {t('blogPage.authorPrefix')} {localizedPost.author}
        </p>
        <h3 className="mt-2 text-xl font-bold text-white group-hover:text-gray-cyan transition-colors">{localizedPost.title}</h3>
        <p className="mt-3 text-gray-300 line-clamp-4">{localizedPost.excerpt}</p>
        {localizedPost.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {localizedPost.tags.slice(0, 3).map(tag => (
              <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300">
                #{tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4">
          <ArticleLink to={`/blog/${localizedPost.slug}`} className="text-gray-cyan font-semibold hover:underline group-hover:text-white transition-colors flex items-center">
            {t('blogPage.readMore')} <ArrowRight size={16} className="ml-2 transform group-hover:translate-x-1 transition-transform"/>
          </ArticleLink>
        </div>
      </div>
    </div>
  );
};

export default BlogCard;
