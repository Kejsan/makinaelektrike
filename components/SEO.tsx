import { useEffect } from 'react';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  buildAbsoluteLocalizedUrl,
  buildLocalizedPath,
  isLocalizablePath,
  normalizeAppLocale,
  stripLocalePrefix,
  toHreflang,
} from '../utils/localizedRouting';

export interface OpenGraphConfig {
  title?: string;
  description?: string;
  url?: string;
  type?: string;
  images?: string[];
  locale?: string;
  siteName?: string;
}

export interface TwitterConfig {
  card?: string;
  title?: string;
  description?: string;
  image?: string;
  site?: string;
  creator?: string;
}

export interface AdditionalMetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface SEOProps {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  image?: string;
  robots?: string;
  openGraph?: OpenGraphConfig;
  twitter?: TwitterConfig;
  structuredData?:
  | Record<string, unknown>
  | Array<Record<string, unknown>>;
  additionalMeta?: AdditionalMetaTag[];
}

const setMetaTag = (
  selector: string,
  createElement: () => HTMLElement,
  update: (element: HTMLElement) => void,
) => {
  const element = document.head.querySelector(selector) as
    | HTMLElement
    | null;

  if (element) {
    const previous = element.getAttribute('content');
    update(element);

    return () => {
      if (previous !== null) {
        element.setAttribute('content', previous);
      } else {
        element.removeAttribute('content');
      }
    };
  }

  const newElement = createElement();
  update(newElement);
  document.head.appendChild(newElement);

  return () => {
    newElement.remove();
  };
};

const toAbsoluteMetaUrl = (value?: string | null) => {
  if (!value || typeof window === 'undefined') {
    return value ?? undefined;
  }

  if (/^(https?:|data:)/i.test(value)) {
    return value;
  }

  return new URL(value, window.location.origin).toString();
};

const toCanonicalBasePath = (value?: string | null) => {
  if (!value) {
    if (typeof window === 'undefined') {
      return '/';
    }

    return stripLocalePrefix(window.location.pathname).pathname;
  }

  if (/^https?:/i.test(value)) {
    try {
      return stripLocalePrefix(new URL(value).pathname).pathname;
    } catch {
      return value;
    }
  }

  return stripLocalePrefix(value).pathname;
};

const getCanonicalOrigin = (value?: string | null) => {
  if (value && /^https?:/i.test(value)) {
    try {
      return new URL(value).origin;
    } catch {
      return typeof window !== 'undefined' ? window.location.origin : undefined;
    }
  }

  return typeof window !== 'undefined' ? window.location.origin : undefined;
};

const getDefaultOpenGraphLocale = () => {
  if (typeof document === 'undefined') {
    return 'sq_AL';
  }

  const language = document.documentElement.lang.toLowerCase().split('-')[0];

  switch (language) {
    case 'en':
      return 'en_US';
    case 'it':
      return 'it_IT';
    case 'sq':
    default:
      return 'sq_AL';
  }
};

const SEO = ({
  title,
  description,
  keywords,
  canonical,
  image,
  robots = 'index, follow',
  openGraph,
  twitter,
  structuredData,
  additionalMeta,
}: SEOProps) => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const cleanups: Array<() => void> = [];
    const currentLocale =
      typeof window !== 'undefined'
        ? normalizeAppLocale(stripLocalePrefix(window.location.pathname).locale)
        : DEFAULT_LOCALE;
    const canonicalBasePath = toCanonicalBasePath(canonical);
    const resolvedCanonical =
      canonicalBasePath && isLocalizablePath(canonicalBasePath)
        ? buildLocalizedPath(canonicalBasePath, currentLocale)
        : canonical;
    const canonicalHref = toAbsoluteMetaUrl(resolvedCanonical ?? canonical);
    const canonicalOrigin = getCanonicalOrigin(canonical);
    const shouldAddAlternateLinks =
      !robots.toLowerCase().includes('noindex') &&
      Boolean(canonicalOrigin) &&
      Boolean(canonicalBasePath) &&
      isLocalizablePath(canonicalBasePath);

    cleanups.push(
      setMetaTag(
        'meta[name="description"]',
        () => {
          const meta = document.createElement('meta');
          meta.setAttribute('name', 'description');
          return meta;
        },
        element => {
          element.setAttribute('content', description);
        },
      ),
    );

    if (keywords && keywords.length > 0) {
      cleanups.push(
        setMetaTag(
          'meta[name="keywords"]',
          () => {
            const meta = document.createElement('meta');
            meta.setAttribute('name', 'keywords');
            return meta;
          },
          element => {
            element.setAttribute('content', keywords.join(', '));
          },
        ),
      );
    }

    cleanups.push(
      setMetaTag(
        'meta[name="robots"]',
        () => {
          const meta = document.createElement('meta');
          meta.setAttribute('name', 'robots');
          return meta;
        },
        element => {
          element.setAttribute('content', robots);
        },
      ),
    );

    // Prepare lists of images merging top-level image and explicit OG images
    const ogImages = openGraph?.images || (image ? [image] : []);

    if (openGraph || ogImages.length > 0) {
      const {
        title: ogTitle = title,
        description: ogDescription = description,
        url: ogUrl = canonicalHref ?? canonical,
        type = 'website',
        locale = getDefaultOpenGraphLocale(),
        siteName = 'Makina Elektrike',
      } = openGraph || {};

      cleanups.push(
        setMetaTag(
          'meta[property="og:title"]',
          () => {
            const meta = document.createElement('meta');
            meta.setAttribute('property', 'og:title');
            return meta;
          },
          element => {
            element.setAttribute('content', ogTitle);
          },
        ),
      );

      cleanups.push(
        setMetaTag(
          'meta[property="og:description"]',
          () => {
            const meta = document.createElement('meta');
            meta.setAttribute('property', 'og:description');
            return meta;
          },
          element => {
            element.setAttribute('content', ogDescription);
          },
        ),
      );

      if (ogUrl) {
        cleanups.push(
          setMetaTag(
            'meta[property="og:url"]',
            () => {
              const meta = document.createElement('meta');
              meta.setAttribute('property', 'og:url');
              return meta;
            },
            element => {
              element.setAttribute('content', toAbsoluteMetaUrl(ogUrl) ?? ogUrl);
            },
          ),
        );
      }

      cleanups.push(
        setMetaTag(
          'meta[property="og:type"]',
          () => {
            const meta = document.createElement('meta');
            meta.setAttribute('property', 'og:type');
            return meta;
          },
          element => {
            element.setAttribute('content', type);
          },
        ),
      );

      cleanups.push(
        setMetaTag(
          'meta[property="og:locale"]',
          () => {
            const meta = document.createElement('meta');
            meta.setAttribute('property', 'og:locale');
            return meta;
          },
          element => {
            element.setAttribute('content', locale);
          },
        ),
      );

      cleanups.push(
        setMetaTag(
          'meta[property="og:site_name"]',
          () => {
            const meta = document.createElement('meta');
            meta.setAttribute('property', 'og:site_name');
            return meta;
          },
          element => {
            element.setAttribute('content', siteName);
          },
        ),
      );

      if (ogImages && Array.isArray(ogImages) && ogImages.length > 0) {
        const cleanupFns = ogImages.map((imageUrl, index) =>
          setMetaTag(
            `meta[property="og:image"][data-position="${index}"]`,
            () => {
              const meta = document.createElement('meta');
              meta.setAttribute('property', 'og:image');
              meta.setAttribute('data-position', index.toString());
              return meta;
            },
            element => {
              element.setAttribute('content', toAbsoluteMetaUrl(imageUrl) ?? imageUrl);
            },
          ),
        );
        cleanups.push(...cleanupFns);
      }
    }

    // Prepare twitter image, prioritizing explicit config, then top-level image
    const twitterImage = twitter?.image || image;

    if (twitter || twitterImage) {
      const {
        card = 'summary_large_image',
        title: twitterTitle = title,
        description: twitterDescription = description,
        site,
        creator,
      } = twitter || {};

      cleanups.push(
        setMetaTag(
          'meta[name="twitter:card"]',
          () => {
            const meta = document.createElement('meta');
            meta.setAttribute('name', 'twitter:card');
            return meta;
          },
          element => {
            element.setAttribute('content', card);
          },
        ),
      );

      cleanups.push(
        setMetaTag(
          'meta[name="twitter:title"]',
          () => {
            const meta = document.createElement('meta');
            meta.setAttribute('name', 'twitter:title');
            return meta;
          },
          element => {
            element.setAttribute('content', twitterTitle);
          },
        ),
      );

      cleanups.push(
        setMetaTag(
          'meta[name="twitter:description"]',
          () => {
            const meta = document.createElement('meta');
            meta.setAttribute('name', 'twitter:description');
            return meta;
          },
          element => {
            element.setAttribute('content', twitterDescription);
          },
        ),
      );

      if (twitterImage) {
        cleanups.push(
          setMetaTag(
            'meta[name="twitter:image"]',
            () => {
              const meta = document.createElement('meta');
              meta.setAttribute('name', 'twitter:image');
              return meta;
            },
            element => {
              element.setAttribute('content', toAbsoluteMetaUrl(twitterImage) ?? twitterImage);
            },
          ),
        );
      }

      if (site) {
        cleanups.push(
          setMetaTag(
            'meta[name="twitter:site"]',
            () => {
              const meta = document.createElement('meta');
              meta.setAttribute('name', 'twitter:site');
              return meta;
            },
            element => {
              element.setAttribute('content', site);
            },
          ),
        );
      }

      if (creator) {
        cleanups.push(
          setMetaTag(
            'meta[name="twitter:creator"]',
            () => {
              const meta = document.createElement('meta');
              meta.setAttribute('name', 'twitter:creator');
              return meta;
            },
            element => {
              element.setAttribute('content', creator);
            },
          ),
        );
      }
    }

    if (additionalMeta) {
      additionalMeta.forEach(metaConfig => {
        const selector = metaConfig.name
          ? `meta[name="${metaConfig.name}"]`
          : metaConfig.property
            ? `meta[property="${metaConfig.property}"]`
            : '';

        if (!selector) {
          return;
        }

        cleanups.push(
          setMetaTag(
            selector,
            () => {
              const meta = document.createElement('meta');
              if (metaConfig.name) {
                meta.setAttribute('name', metaConfig.name);
              }
              if (metaConfig.property) {
                meta.setAttribute('property', metaConfig.property);
              }
              return meta;
            },
            element => {
              element.setAttribute('content', metaConfig.content);
            },
          ),
        );
      });
    }

    let canonicalCleanup: (() => void) | undefined;
    if (canonicalHref) {
      const existingCanonical =
        document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

      if (existingCanonical) {
        const previousHref = existingCanonical.getAttribute('href');
        existingCanonical.setAttribute('href', canonicalHref);

        canonicalCleanup = () => {
          if (previousHref) {
            existingCanonical.setAttribute('href', previousHref);
          } else {
            existingCanonical.removeAttribute('href');
          }
        };
      } else {
        const link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        link.setAttribute('href', canonicalHref);
        document.head.appendChild(link);

        canonicalCleanup = () => {
          link.remove();
        };
      }
    }

    let alternateLinksCleanup: (() => void) | undefined;
    if (shouldAddAlternateLinks && canonicalOrigin) {
      const generatedAlternateLinks = [
        ...SUPPORTED_LOCALES.map(locale => {
          const link = document.createElement('link');
          link.setAttribute('rel', 'alternate');
          link.setAttribute('hreflang', toHreflang(locale));
          link.setAttribute(
            'href',
            buildAbsoluteLocalizedUrl(canonicalOrigin, canonicalBasePath, locale),
          );
          link.setAttribute('data-generated-alternate', 'true');
          document.head.appendChild(link);
          return link;
        }),
      ];

      const xDefaultLink = document.createElement('link');
      xDefaultLink.setAttribute('rel', 'alternate');
      xDefaultLink.setAttribute('hreflang', 'x-default');
      xDefaultLink.setAttribute(
        'href',
        buildAbsoluteLocalizedUrl(canonicalOrigin, canonicalBasePath, DEFAULT_LOCALE),
      );
      xDefaultLink.setAttribute('data-generated-alternate', 'true');
      document.head.appendChild(xDefaultLink);
      generatedAlternateLinks.push(xDefaultLink);

      alternateLinksCleanup = () => {
        generatedAlternateLinks.forEach(link => link.remove());
      };
    }

    let structuredDataCleanup: (() => void) | undefined;
    if (structuredData) {
      const script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.textContent = JSON.stringify(structuredData, null, 2);
      document.head.appendChild(script);

      structuredDataCleanup = () => {
        script.remove();
      };
    }

    return () => {
      document.title = previousTitle;
      cleanups.forEach(cleanup => cleanup());
      canonicalCleanup?.();
      alternateLinksCleanup?.();
      structuredDataCleanup?.();
    };
  }, [
    title,
    description,
    keywords?.join(',') ?? '',
    canonical,
    robots,
    JSON.stringify(openGraph ?? {}),
    JSON.stringify(twitter ?? {}),
    structuredData ? JSON.stringify(structuredData) : '',
    JSON.stringify(additionalMeta ?? []),
  ]);

  return null;
};

export default SEO;
