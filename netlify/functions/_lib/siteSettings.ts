import type { DocumentData } from 'firebase-admin/firestore';
import type { FooterSocialLinks, HomeHeroImage, PublicSiteSettings } from '../../../types';

const DEFAULT_SOCIAL_LINKS: FooterSocialLinks = {
  facebook: 'https://www.facebook.com/makina-elektrike',
  instagram: 'https://www.instagram.com/makina-elektrike',
  twitter: 'https://twitter.com/makina-elektrike',
  linkedin: 'https://www.linkedin.com/company/makina-elektrike',
};
const SOCIAL_LINK_KEYS = ['facebook', 'instagram', 'twitter', 'linkedin'] as const;

const sanitizeOptionalString = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const isHttpUrl = (value: string) => {
  if (!value) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseSocialLinks = (value: unknown): Partial<FooterSocialLinks> => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record) {
    return {};
  }

  const socialLinks = SOCIAL_LINK_KEYS.reduce<Partial<FooterSocialLinks>>((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      acc[key] = sanitizeOptionalString(record[key], 500);
    }
    return acc;
  }, {});

  Object.entries(socialLinks).forEach(([key, url]) => {
    if (!isHttpUrl(url ?? '')) {
      throw new Error(`${key} must be a valid http or https URL.`);
    }
  });

  return socialLinks;
};

const parseHeroImages = (value: unknown): HomeHeroImage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 6)
    .map((entry, index) => {
      const record = entry && typeof entry === 'object' && !Array.isArray(entry)
        ? entry as Record<string, unknown>
        : {};
      const imageUrl = sanitizeOptionalString(record.imageUrl, 2000);
      const mobileImageUrl = sanitizeOptionalString(record.mobileImageUrl, 2000);
      const alt = sanitizeOptionalString(record.alt, 200);
      const id = sanitizeOptionalString(record.id, 120) || `hero-${index + 1}`;

      if (!imageUrl) {
        return null;
      }
      if (!isHttpUrl(imageUrl)) {
        throw new Error(`Hero image ${index + 1} must use a valid http or https URL.`);
      }
      if (mobileImageUrl && !isHttpUrl(mobileImageUrl)) {
        throw new Error(`Hero mobile image ${index + 1} must use a valid http or https URL.`);
      }

      return {
        id,
        imageUrl,
        ...(mobileImageUrl ? { mobileImageUrl } : {}),
        ...(alt ? { alt } : {}),
      };
    })
    .filter((entry): entry is HomeHeroImage => Boolean(entry));
};

export const serializeSiteSettings = (
  data: DocumentData | undefined,
): PublicSiteSettings => ({
  socialLinks: {
    ...DEFAULT_SOCIAL_LINKS,
    ...parseSocialLinks(data?.socialLinks),
  },
  homeHeroImages: parseHeroImages(data?.homeHeroImages),
  updatedAt: data?.updatedAt && typeof data.updatedAt === 'object' && 'toDate' in data.updatedAt
    ? (data.updatedAt as { toDate: () => Date }).toDate().toISOString()
    : null,
});

export const parseSiteSettingsPayload = (value: unknown): PublicSiteSettings => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const settings = record.settings && typeof record.settings === 'object' && !Array.isArray(record.settings)
    ? record.settings as Record<string, unknown>
    : record;

  return {
    socialLinks: {
      ...DEFAULT_SOCIAL_LINKS,
      ...parseSocialLinks(settings.socialLinks),
    },
    homeHeroImages: parseHeroImages(settings.homeHeroImages),
    updatedAt: null,
  };
};
