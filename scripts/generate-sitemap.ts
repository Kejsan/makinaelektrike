import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore/lite';
import blogPostsData from '../data/blogPosts';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  buildAbsoluteLocalizedUrl,
  buildLocalizedPath,
  toHreflang,
} from '../utils/localizedRouting';

dotenv.config();

const SITE = (process.env.VITE_SITE_URL || 'https://makinaelektrike.com').replace(/\/+$/, '');
const MAX_URLS_PER_SITEMAP = 45000;

const MAIN_URLS = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/dealers/', changefreq: 'weekly', priority: '0.9' },
  { loc: '/models/', changefreq: 'weekly', priority: '0.9' },
  { loc: '/listings/', changefreq: 'daily', priority: '0.8' },
  { loc: '/albania-charging-stations/', changefreq: 'weekly', priority: '0.8' },
  { loc: '/blog/', changefreq: 'weekly', priority: '0.8' },
  { loc: '/help-center/', changefreq: 'monthly', priority: '0.7' },
  { loc: '/about/', changefreq: 'monthly', priority: '0.6' },
  { loc: '/contact/', changefreq: 'monthly', priority: '0.6' },
  { loc: '/sitemap/', changefreq: 'monthly', priority: '0.4' },
  { loc: '/privacy-policy/', changefreq: 'monthly', priority: '0.3' },
  { loc: '/terms/', changefreq: 'monthly', priority: '0.3' },
  { loc: '/cookie-policy/', changefreq: 'monthly', priority: '0.3' },
] as const;

type SitemapAlternate = {
  hreflang: string;
  href: string;
};

type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  alternates?: SitemapAlternate[];
};

type SitemapSection = {
  key: string;
  urls: SitemapUrl[];
};

type FirestoreTimestampLike = Timestamp | { toDate?: () => Date } | Date | string | null | undefined;

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

const today = new Date().toISOString().slice(0, 10);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');
const sitemapDir = path.join(publicDir, 'sitemaps');

const compareStrings = (a?: string | null, b?: string | null) =>
  (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' });

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const normalizeDate = (value: FirestoreTimestampLike): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
  }

  return undefined;
};

const latestLastmod = (urls: SitemapUrl[]): string =>
  urls
    .map(url => url.lastmod)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? today;

const withTrailingSlash = (value: string): string => {
  if (value === '/') {
    return value;
  }

  return value.endsWith('/') ? value : `${value}/`;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const buildUrlSetXml = (urls: SitemapUrl[]) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map(
    url => `  <url>\n    <loc>${escapeXml(`${SITE}${url.loc}`)}</loc>${url.alternates?.length ? `\n${url.alternates.map(alternate => `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}" />`).join('\n')}` : ''}\n    <lastmod>${url.lastmod ?? today}</lastmod>${url.changefreq ? `\n    <changefreq>${url.changefreq}</changefreq>` : ''}${url.priority ? `\n    <priority>${url.priority}</priority>` : ''}\n  </url>`,
  )
  .join('\n')}\n</urlset>\n`.replace(
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
);

const buildSitemapIndexXml = (
  sitemaps: Array<{ loc: string; lastmod: string }>,
) => `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps
  .map(
    sitemap => `  <sitemap>\n    <loc>${escapeXml(`${SITE}${sitemap.loc}`)}</loc>\n    <lastmod>${sitemap.lastmod}</lastmod>\n  </sitemap>`,
  )
  .join('\n')}\n</sitemapindex>\n`;

const getFirestoreInstance = () => {
  if (!hasFirebaseConfig) {
    return null;
  }

  const app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  return getFirestore(app);
};

const getDynamicDealers = async (): Promise<SitemapUrl[]> => {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    return [];
  }

  const snapshot = await getDocs(query(collection(firestore, 'dealers'), where('approved', '==', true)));

  return snapshot.docs
    .map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
    .filter(entry => {
      const status = (entry.status as string | undefined) ?? (entry.approved === false ? 'pending' : 'approved');
      if (entry.isDeleted === true) {
        return false;
      }
      if (entry.isActive === false) {
        return false;
      }
      return status === 'approved';
    })
    .sort((first, second) => compareStrings(first.name as string | undefined, second.name as string | undefined))
    .map(entry => ({
      loc: withTrailingSlash(`/dealers/${encodeURIComponent(entry.id as string)}`),
      lastmod:
        normalizeDate(entry.updatedAt as FirestoreTimestampLike) ??
        normalizeDate(entry.approvedAt as FirestoreTimestampLike) ??
        normalizeDate(entry.createdAt as FirestoreTimestampLike) ??
        today,
      changefreq: 'weekly',
      priority: '0.7',
    }));
};

const getDynamicModels = async (): Promise<SitemapUrl[]> => {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    return [];
  }

  const snapshot = await getDocs(collection(firestore, 'models'));

  return snapshot.docs
    .map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
    .sort((first, second) => {
      const brandComparison = compareStrings(first.brand as string | undefined, second.brand as string | undefined);
      if (brandComparison !== 0) {
        return brandComparison;
      }
      return compareStrings(
        first.model_name as string | undefined,
        second.model_name as string | undefined,
      );
    })
    .map(entry => ({
      loc: withTrailingSlash(`/models/${encodeURIComponent(entry.id as string)}`),
      lastmod:
        normalizeDate(entry.updatedAt as FirestoreTimestampLike) ??
        normalizeDate(entry.createdAt as FirestoreTimestampLike) ??
        today,
      changefreq: 'weekly',
      priority: '0.7',
    }));
};

const getDynamicBlogPosts = async (): Promise<SitemapUrl[]> => {
  const firestore = getFirestoreInstance();

  if (!firestore) {
    return [...blogPostsData]
      .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())
      .map(post => ({
        loc: `/blog/${encodeURIComponent(post.slug)}`,
        lastmod: normalizeDate(post.date) ?? today,
        changefreq: 'monthly',
        priority: '0.6',
      }));
  }

  const snapshot = await getDocs(collection(firestore, 'blogPosts'));

  return snapshot.docs
    .map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
    .filter(entry => entry.published !== false && entry.status !== 'draft')
    .sort((first, second) => {
      const firstTime = new Date((first.date as string | undefined) ?? '').getTime();
      const secondTime = new Date((second.date as string | undefined) ?? '').getTime();
      return secondTime - firstTime;
    })
    .map(entry => ({
      loc: `/blog/${encodeURIComponent(entry.slug as string)}`,
      lastmod:
        normalizeDate(entry.publishedAt as FirestoreTimestampLike) ??
        normalizeDate(entry.updatedAt as FirestoreTimestampLike) ??
        normalizeDate(entry.date as FirestoreTimestampLike) ??
        normalizeDate(entry.createdAt as FirestoreTimestampLike) ??
        today,
      changefreq: 'monthly',
      priority: '0.6',
    }));
};

const getDynamicListings = async (): Promise<SitemapUrl[]> => {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(firestore, 'listings'), where('status', 'in', ['approved', 'active'])),
  );

  return snapshot.docs
    .map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
    .sort((first, second) => {
      const firstTime = new Date((first.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? (first.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? 0).getTime();
      const secondTime = new Date((second.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? (second.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? 0).getTime();
      return secondTime - firstTime;
    })
    .map(entry => ({
      loc: withTrailingSlash(`/listings/${encodeURIComponent(entry.id as string)}`),
      lastmod:
        normalizeDate(entry.updatedAt as FirestoreTimestampLike) ??
        normalizeDate(entry.approvedAt as FirestoreTimestampLike) ??
        normalizeDate(entry.createdAt as FirestoreTimestampLike) ??
        today,
      changefreq: 'daily',
      priority: '0.7',
    }));
};

const getMainUrls = (): SitemapUrl[] =>
  MAIN_URLS.flatMap(entry => expandLocalizedUrls({
    ...entry,
    lastmod: today,
  }));

function buildAlternateSet(loc: string): SitemapAlternate[] {
  return [
    ...SUPPORTED_LOCALES.map(locale => ({
      hreflang: toHreflang(locale),
      href: buildAbsoluteLocalizedUrl(SITE, loc, locale),
    })),
    {
      hreflang: 'x-default',
      href: buildAbsoluteLocalizedUrl(SITE, loc, DEFAULT_LOCALE),
    },
  ];
}

function expandLocalizedUrls(entry: SitemapUrl): SitemapUrl[] {
  return SUPPORTED_LOCALES.map(locale => ({
    ...entry,
    loc: buildLocalizedPath(entry.loc, locale),
    alternates: buildAlternateSet(entry.loc),
  }));
}

const writeSitemapFiles = async (sections: SitemapSection[]) => {
  fs.rmSync(sitemapDir, { recursive: true, force: true });
  fs.mkdirSync(sitemapDir, { recursive: true });

  const sitemapIndexEntries: Array<{ loc: string; lastmod: string }> = [];

  sections.forEach(section => {
    const sectionChunks = chunk(section.urls, MAX_URLS_PER_SITEMAP);

    sectionChunks.forEach((entries, chunkIndex) => {
      const suffix = sectionChunks.length > 1 ? `-${chunkIndex + 1}` : '';
      const fileName = `${section.key}${suffix}.xml`;
      const outputPath = path.join(sitemapDir, fileName);

      fs.writeFileSync(outputPath, buildUrlSetXml(entries), 'utf8');
      sitemapIndexEntries.push({
        loc: `/sitemaps/${fileName}`,
        lastmod: latestLastmod(entries),
      });
    });
  });

  const sitemapIndexPath = path.join(publicDir, 'sitemap.xml');
  fs.writeFileSync(sitemapIndexPath, buildSitemapIndexXml(sitemapIndexEntries), 'utf8');

  return sitemapIndexEntries;
};

const buildSitemaps = async () => {
  const mainUrls = getMainUrls();

  let dealerUrls: SitemapUrl[] = [];
  let modelUrls: SitemapUrl[] = [];
  let listingUrls: SitemapUrl[] = [];
  let blogUrls: SitemapUrl[] = [...blogPostsData]
    .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())
    .map(post => ({
      loc: `/blog/${encodeURIComponent(post.slug)}`,
      lastmod: normalizeDate(post.date) ?? today,
      changefreq: 'monthly',
      priority: '0.6',
    }));

  if (hasFirebaseConfig) {
    [dealerUrls, modelUrls, listingUrls, blogUrls] = await Promise.all([
      getDynamicDealers(),
      getDynamicModels(),
      getDynamicListings(),
      getDynamicBlogPosts(),
    ]);
  } else {
    console.warn('Firebase environment variables are missing. Dynamic dealer, model, and listing URLs were skipped.');
  }

  const sections: SitemapSection[] = [
    { key: 'main', urls: mainUrls },
    { key: 'dealers', urls: dealerUrls.flatMap(expandLocalizedUrls) },
    { key: 'models', urls: modelUrls.flatMap(expandLocalizedUrls) },
    { key: 'listings', urls: listingUrls.flatMap(expandLocalizedUrls) },
    { key: 'blog', urls: blogUrls.flatMap(expandLocalizedUrls) },
  ].filter(section => section.urls.length > 0);

  const generatedFiles = await writeSitemapFiles(sections);

  console.log(
    `Wrote sitemap index and ${generatedFiles.length} sitemap file(s): main=${mainUrls.length}, dealers=${dealerUrls.length}, models=${modelUrls.length}, listings=${listingUrls.length}, blog=${blogUrls.length}`,
  );
};

buildSitemaps().catch(error => {
  console.error('Failed to generate sitemaps.', error);
  process.exitCode = 1;
});
