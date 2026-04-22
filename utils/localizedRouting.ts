import type { To } from 'react-router-dom';

export const SUPPORTED_LOCALES = ['sq', 'en', 'it'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'sq';
export const ALTERNATE_LOCALES: AppLocale[] = ['en', 'it'];

const NON_LOCALIZED_PREFIXES = [
  '/admin',
  '/dealer',
  '/api',
  '/.netlify',
  '/assets',
  '/images',
  '/fonts',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemaps',
  '/llms.txt',
];

const splitPath = (value: string) => {
  const match = value.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);

  return {
    pathname: match?.[1] || '/',
    search: match?.[2] || '',
    hash: match?.[3] || '',
  };
};

const ensureLeadingSlash = (value: string) => {
  if (!value) {
    return '/';
  }

  return value.startsWith('/') ? value : `/${value}`;
};

const isBlockedPrefix = (pathname: string) =>
  NON_LOCALIZED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));

export const normalizeAppLocale = (value?: string | null): AppLocale => {
  const normalized = (value || '').toLowerCase().split('-')[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(normalized)
    ? (normalized as AppLocale)
    : DEFAULT_LOCALE;
};

export const toHreflang = (locale: AppLocale) => {
  switch (locale) {
    case 'sq':
      return 'sq-AL';
    case 'en':
      return 'en';
    case 'it':
      return 'it';
    default:
      return locale;
  }
};

export const isLocalizablePath = (value?: string | null) => {
  if (!value) {
    return false;
  }

  if (/^(https?:|mailto:|tel:|#)/i.test(value)) {
    return false;
  }

  const pathname = ensureLeadingSlash(splitPath(value).pathname);
  return !isBlockedPrefix(pathname);
};

export const stripLocalePrefix = (value?: string | null) => {
  const pathname = ensureLeadingSlash(splitPath(value || '/').pathname);

  for (const locale of ALTERNATE_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      const stripped = pathname.slice(locale.length + 1) || '/';
      return {
        locale,
        pathname: stripped.startsWith('/') ? stripped : `/${stripped}`,
      };
    }
  }

  if (pathname === '/sq' || pathname.startsWith('/sq/')) {
    const stripped = pathname.slice(3) || '/';
    return {
      locale: DEFAULT_LOCALE,
      pathname: stripped.startsWith('/') ? stripped : `/${stripped}`,
    };
  }

  return {
    locale: DEFAULT_LOCALE,
    pathname,
  };
};

export const buildLocalizedPath = (value: string, locale: AppLocale) => {
  if (!isLocalizablePath(value)) {
    return value;
  }

  const { pathname, search, hash } = splitPath(value);
  const basePath = stripLocalePrefix(pathname).pathname;
  const localizedPath =
    locale === DEFAULT_LOCALE
      ? basePath
      : `/${locale}${basePath === '/' ? '' : basePath}`;

  return `${localizedPath || '/'}${search}${hash}`;
};

export const buildLocalizedTo = (to: To, locale: AppLocale): To => {
  if (typeof to === 'string') {
    return buildLocalizedPath(to, locale);
  }

  if (!to.pathname) {
    return to;
  }

  return {
    ...to,
    pathname: buildLocalizedPath(to.pathname, locale),
  };
};

export const buildAbsoluteLocalizedUrl = (
  baseUrl: string,
  pathname: string,
  locale: AppLocale,
) => `${baseUrl.replace(/\/+$/, '')}${buildLocalizedPath(pathname, locale)}`;

export const buildLocalizedRoutePath = (pathname: string, locale?: AppLocale) =>
  locale ? buildLocalizedPath(pathname, locale) : pathname;
