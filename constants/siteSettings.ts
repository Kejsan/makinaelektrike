import type { PublicSiteSettings } from '../types';
import heroDashboard from '../assets/BYD SEAL.webp';
import heroDashboardCompact from '../assets/BYD SEAL-960.webp';

export const DEFAULT_SITE_SETTINGS: PublicSiteSettings = {
  socialLinks: {
    facebook: 'https://www.facebook.com/makina-elektrike',
    instagram: 'https://www.instagram.com/makina-elektrike',
    twitter: 'https://twitter.com/makina-elektrike',
    linkedin: 'https://www.linkedin.com/company/makina-elektrike',
  },
  homeHeroImages: [
    {
      id: 'default-byd-seal',
      imageUrl: heroDashboard,
      mobileImageUrl: heroDashboardCompact,
      alt: 'Electric vehicle dashboard',
    },
  ],
  updatedAt: null,
};

export const mergeSiteSettings = (
  settings?: Partial<PublicSiteSettings> | null,
): PublicSiteSettings => ({
  socialLinks: {
    ...DEFAULT_SITE_SETTINGS.socialLinks,
    ...(settings?.socialLinks ?? {}),
  },
  homeHeroImages:
    settings?.homeHeroImages && settings.homeHeroImages.length > 0
      ? settings.homeHeroImages
      : DEFAULT_SITE_SETTINGS.homeHeroImages,
  updatedAt: settings?.updatedAt ?? null,
});
