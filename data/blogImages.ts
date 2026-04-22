const BLOG_IMAGE_PATH_BY_SLUG = {
  'mite-per-makinat-elektrike-qe-duhet-ti-harroni':
    '/images/blog/mite-per-makinat-elektrike-qe-duhet-ti-harroni.webp',
  'si-funksionojne-makinat-elektrike-dhe-bateria-e-tyre':
    '/images/blog/si-funksionojne-makinat-elektrike-dhe-bateria-e-tyre.webp',
  'krahasimi-byd-atto-3-vw-id3-dhe-mg4':
    '/images/blog/krahasimi-byd-atto-3-vw-id3-dhe-mg4.webp',
  'keshilla-per-te-zgjedhur-makinen-elektrike-te-pare':
    '/images/blog/keshilla-per-te-zgjedhur-makinen-elektrike-te-pare.webp',
  'histori-suksesi-makine-elektrike-ne-tirane':
    '/images/blog/histori-suksesi-makine-elektrike-ne-tirane.webp',
  'karikimi-vs-karburanti-sa-kushton-ne-te-vertete':
    '/images/blog/karikimi-vs-karburanti-sa-kushton-ne-te-vertete.webp',
  'lehtesirat-fiskale-per-makinat-elektrike-ne-shqiperi':
    '/images/blog/lehtesirat-fiskale-per-makinat-elektrike-ne-shqiperi.webp',
  'si-te-zgjasni-jeten-e-baterise-se-makines-elektrike':
    '/images/blog/si-te-zgjasni-jeten-e-baterise-se-makines-elektrike.webp',
  'udhezues-per-rrjetet-e-karikimit-ne-shqiperi':
    '/images/blog/udhezues-per-rrjetet-e-karikimit-ne-shqiperi.webp',
  'baterite-lfp-vs-nmc-cilen-te-zgjedhni':
    '/images/blog/baterite-lfp-vs-nmc-cilen-te-zgjedhni.webp',
  'makina-elektrike-te-perdoruara-a-ia-vlen-investimi':
    '/images/blog/makina-elektrike-te-perdoruara-a-ia-vlen-investimi.webp',
  'a-jane-makinat-elektrike-me-te-mira-per-mjedisin':
    '/images/blog/a-jane-makinat-elektrike-me-te-mira-per-mjedisin.webp',
  'shpenzim-apo-investim-kostot-e-ev-ne-shqiperi':
    '/images/blog/shpenzim-apo-investim-kostot-e-ev-ne-shqiperi.webp',
  'e-ardhmja-e-infrastruktures-se-karikimit-ne-shqiperi':
    '/images/blog/e-ardhmja-e-infrastruktures-se-karikimit-ne-shqiperi.webp',
} as const;

export const DEFAULT_OG_IMAGE_PATH = '/images/og/default-og.webp';

const FIRST_PARTY_BLOG_IMAGE_HOSTS = new Set([
  'makinaelektrike.com',
  'www.makinaelektrike.com',
  'localhost',
  '127.0.0.1',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'makina-elektrike.firebasestorage.app',
]);

const toLocalOrAllowedBlogImageUrl = (imageUrl: string) => {
  try {
    const parsedUrl = new URL(imageUrl);

    if (FIRST_PARTY_BLOG_IMAGE_HOSTS.has(parsedUrl.hostname)) {
      if (
        parsedUrl.hostname === 'makinaelektrike.com' ||
        parsedUrl.hostname === 'www.makinaelektrike.com' ||
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1'
      ) {
        return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || DEFAULT_OG_IMAGE_PATH;
      }

      return imageUrl;
    }
  } catch {
    return imageUrl;
  }

  return DEFAULT_OG_IMAGE_PATH;
};

export const getLocalBlogImagePath = (slug: string) =>
  BLOG_IMAGE_PATH_BY_SLUG[slug as keyof typeof BLOG_IMAGE_PATH_BY_SLUG] ?? DEFAULT_OG_IMAGE_PATH;

export const resolveBlogImageUrl = (slug?: string | null, imageUrl?: string | null) => {
  const normalizedSlug = slug?.trim();
  if (normalizedSlug) {
    const localPath = BLOG_IMAGE_PATH_BY_SLUG[normalizedSlug as keyof typeof BLOG_IMAGE_PATH_BY_SLUG];
    if (localPath) {
      return localPath;
    }
  }

  const normalizedImageUrl = imageUrl?.trim();
  if (!normalizedImageUrl) {
    return DEFAULT_OG_IMAGE_PATH;
  }

  if (
    normalizedImageUrl.startsWith('/images/blog/') ||
    normalizedImageUrl.startsWith('/images/og/') ||
    normalizedImageUrl.startsWith('data:')
  ) {
    return normalizedImageUrl;
  }

  return toLocalOrAllowedBlogImageUrl(normalizedImageUrl);
};

export const normalizeBlogPostImage = <T extends { slug: string; imageUrl?: string | null }>(post: T): T => ({
  ...post,
  imageUrl: resolveBlogImageUrl(post.slug, post.imageUrl),
});
