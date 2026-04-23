import type { BlogPost, BlogPostFaq, BlogPostSection, BlogPostTranslation } from '../types';
import { type AppLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES, normalizeAppLocale } from './localizedRouting';

const hasText = (value?: string | null) => Boolean(value && value.trim());

const cleanSection = (section: BlogPostSection): BlogPostSection | null => {
  const paragraphs = (section.paragraphs ?? []).filter(hasText);
  const listItems = section.list?.items.filter(hasText) ?? [];
  const heading = section.heading?.trim() ?? '';
  const highlight = section.highlight?.trim();

  if (!heading && !paragraphs.length && !listItems.length && !highlight) {
    return null;
  }

  return {
    ...section,
    heading,
    paragraphs,
    highlight: highlight || undefined,
    list: section.list
      ? {
          ...section.list,
          title: section.list.title?.trim() || undefined,
          items: listItems,
        }
      : undefined,
  };
};

const cleanSections = (sections?: BlogPostSection[]) =>
  (sections ?? [])
    .map(cleanSection)
    .filter((section): section is BlogPostSection => Boolean(section));

const cleanFaqs = (faqs?: BlogPostFaq[]) =>
  (faqs ?? []).filter(faq => hasText(faq.question) && hasText(faq.answer));

const isUsableTranslation = (translation?: BlogPostTranslation) => {
  if (!translation) {
    return false;
  }

  return (
    hasText(translation.title) &&
    hasText(translation.excerpt) &&
    hasText(translation.metaTitle) &&
    hasText(translation.metaDescription) &&
    cleanSections(translation.sections).length > 0
  );
};

export const getBlogContentLocale = (post: BlogPost, locale?: string | null): AppLocale => {
  const normalized = normalizeAppLocale(locale);
  if (normalized === DEFAULT_LOCALE) {
    return DEFAULT_LOCALE;
  }

  return isUsableTranslation(post.translations?.[normalized]) ? normalized : DEFAULT_LOCALE;
};

export const hasLocalizedBlogContent = (post: BlogPost, locale?: string | null) =>
  getBlogContentLocale(post, locale) !== DEFAULT_LOCALE;

export const getBlogAlternateLocales = (post: BlogPost): AppLocale[] =>
  SUPPORTED_LOCALES.filter(
    locale =>
      locale === DEFAULT_LOCALE ||
      isUsableTranslation(post.translations?.[locale as Exclude<AppLocale, typeof DEFAULT_LOCALE>]),
  );

export const getLocalizedBlogPost = (post: BlogPost, locale?: string | null): BlogPost => {
  const normalized = normalizeAppLocale(locale);
  const translation = normalized === DEFAULT_LOCALE ? undefined : post.translations?.[normalized];

  if (!isUsableTranslation(translation)) {
    return post;
  }

  return {
    ...post,
    title: translation.title.trim(),
    excerpt: translation.excerpt.trim(),
    metaTitle: translation.metaTitle.trim(),
    metaDescription: translation.metaDescription.trim(),
    focusKeyword: translation.focusKeyword?.trim() || post.focusKeyword,
    canonicalUrl: translation.canonicalUrl?.trim() || post.canonicalUrl,
    metaRobots: translation.metaRobots?.trim() || post.metaRobots,
    sections: cleanSections(translation.sections),
    faqs: cleanFaqs(translation.faqs).length ? cleanFaqs(translation.faqs) : post.faqs,
  };
};

export const getBlogTranslationCoverage = (posts: BlogPost[]) => ({
  en: posts.filter(post => isUsableTranslation(post.translations?.en)).length,
  it: posts.filter(post => isUsableTranslation(post.translations?.it)).length,
  total: posts.length,
});
