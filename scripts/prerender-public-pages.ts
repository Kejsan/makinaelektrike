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
import type { BlogPost, Dealer, DealerModel, Listing, Model } from '../types';
import blogPostsData from '../data/blogPosts';
import { DEFAULT_OG_IMAGE_PATH, normalizeBlogPostImage } from '../data/blogImages';
import { getHelpCenterContent } from '../data/helpCenterContent';
import sqTranslations from '../i18n/locales/sq.json';

dotenv.config();

const SITE_URL = (process.env.VITE_SITE_URL || 'https://makinaelektrike.com').replace(/\/+$/, '');
const DEFAULT_OG_IMAGE = `${SITE_URL}${DEFAULT_OG_IMAGE_PATH}`;
const TWITTER_SITE = '@makinaelektrike';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const shellPath = path.join(distDir, 'index.html');

type StructuredData = Record<string, unknown> | Array<Record<string, unknown>>;
type FirestoreTimestampLike = Timestamp | { toDate?: () => Date } | Date | string | null | undefined;

type PageDefinition = {
  outputRoute: string;
  canonicalPath: string;
  lang: 'sq' | 'en';
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  ogType?: string;
  structuredData?: StructuredData;
  bodyHtml: string;
};

type PublicSiteData = {
  dealers: Dealer[];
  models: Model[];
  listings: Listing[];
  blogPosts: BlogPost[];
  dealerModels: DealerModel[];
};

const sq = sqTranslations as any;

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

const shellHtml = fs.readFileSync(shellPath, 'utf8');

const PRERENDER_STYLE = `
<style data-prerender>
  :root {
    color-scheme: dark;
    --pr-bg: #020817;
    --pr-panel: rgba(15, 23, 42, 0.9);
    --pr-panel-soft: rgba(15, 23, 42, 0.68);
    --pr-border: rgba(148, 163, 184, 0.18);
    --pr-text: #e5e7eb;
    --pr-muted: #94a3b8;
    --pr-accent: #45c9d0;
    --pr-accent-2: #ff5757;
    --pr-link: #7dd3fc;
  }

  #root[data-prerendered="true"] {
    min-height: 100vh;
  }

  .pr-shell {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 16px 64px;
    color: var(--pr-text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .pr-topbar,
  .pr-hero,
  .pr-card,
  .pr-section,
  .pr-article,
  .pr-footer {
    border: 1px solid var(--pr-border);
    background: var(--pr-panel);
    border-radius: 18px;
    box-shadow: 0 18px 50px rgba(15, 23, 42, 0.2);
  }

  .pr-topbar,
  .pr-footer,
  .pr-hero,
  .pr-section,
  .pr-article {
    padding: 24px;
  }

  .pr-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .pr-brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    color: white;
    text-decoration: none;
  }

  .pr-brand-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(135deg, var(--pr-accent), var(--pr-accent-2));
  }

  .pr-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
  }

  .pr-nav a,
  .pr-link,
  .pr-footer a {
    color: var(--pr-link);
    text-decoration: none;
  }

  .pr-nav a:hover,
  .pr-link:hover,
  .pr-footer a:hover {
    text-decoration: underline;
  }

  .pr-breadcrumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 18px;
    color: var(--pr-muted);
    font-size: 14px;
  }

  .pr-breadcrumbs a {
    color: var(--pr-muted);
    text-decoration: none;
  }

  .pr-breadcrumbs a:hover {
    color: white;
  }

  .pr-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(69, 201, 208, 0.14);
    border: 1px solid rgba(69, 201, 208, 0.25);
    color: var(--pr-accent);
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .pr-hero h1,
  .pr-article h1 {
    margin: 14px 0 10px;
    color: white;
    font-size: clamp(2rem, 4vw, 3.5rem);
    line-height: 1.08;
  }

  .pr-hero p,
  .pr-article p,
  .pr-section p,
  .pr-card p,
  .pr-footer p {
    color: var(--pr-text);
    line-height: 1.7;
  }

  .pr-muted {
    color: var(--pr-muted);
  }

  .pr-hero-actions,
  .pr-inline-links,
  .pr-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .pr-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 11px 16px;
    border-radius: 10px;
    background: var(--pr-accent);
    color: #06202b;
    font-weight: 700;
    text-decoration: none;
  }

  .pr-button--ghost {
    background: transparent;
    color: white;
    border: 1px solid var(--pr-border);
  }

  .pr-stats,
  .pr-grid,
  .pr-list-grid,
  .pr-meta-grid {
    display: grid;
    gap: 16px;
    margin-top: 24px;
  }

  .pr-stats {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .pr-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .pr-list-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .pr-meta-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .pr-card {
    padding: 18px;
    background: var(--pr-panel-soft);
  }

  .pr-card h2,
  .pr-card h3,
  .pr-section h2,
  .pr-article h2,
  .pr-article h3 {
    margin: 0;
    color: white;
  }

  .pr-stat-value {
    font-size: 1.8rem;
    font-weight: 800;
    color: white;
  }

  .pr-stat-label {
    display: block;
    margin-top: 4px;
    color: var(--pr-muted);
    font-size: 0.95rem;
  }

  .pr-sections {
    display: grid;
    gap: 20px;
    margin-top: 24px;
  }

  .pr-section h2,
  .pr-article h2 {
    margin-bottom: 14px;
    font-size: clamp(1.4rem, 3vw, 2rem);
  }

  .pr-article-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
    color: var(--pr-muted);
    font-size: 0.95rem;
  }

  .pr-list,
  .pr-numbered {
    margin: 14px 0 0;
    padding-left: 20px;
    color: var(--pr-text);
    line-height: 1.7;
  }

  .pr-list li,
  .pr-numbered li {
    margin-bottom: 8px;
  }

  .pr-facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-top: 18px;
  }

  .pr-fact {
    padding: 14px;
    border-radius: 12px;
    background: rgba(2, 8, 23, 0.5);
    border: 1px solid var(--pr-border);
  }

  .pr-fact strong {
    display: block;
    margin-bottom: 4px;
    color: white;
  }

  .pr-grouped-list {
    display: grid;
    gap: 18px;
  }

  .pr-grouped-list ul {
    margin: 10px 0 0;
    padding-left: 20px;
  }

  .pr-footer {
    margin-top: 24px;
  }

  .pr-footer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
  }

  .pr-footer h2 {
    margin: 0 0 10px;
    color: white;
    font-size: 1rem;
  }

  .pr-footer ul {
    margin: 0;
    padding-left: 18px;
  }

  .pr-footer li {
    margin-bottom: 6px;
  }

  @media (max-width: 720px) {
    .pr-topbar {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
`;

const sqNavigation = [
  { href: '/', label: sq.header.home },
  { href: '/dealers/', label: sq.header.dealers },
  { href: '/models/', label: sq.header.models },
  { href: '/listings/', label: sq.header.listings ?? 'Listimet' },
  { href: '/blog/', label: sq.header.blog },
  { href: '/help-center/', label: sq.header.helpCenter ?? 'Qendra e ndihmës' },
  { href: '/contact/', label: sq.footer.contact },
];

const enNavigation = [
  { href: '/', label: 'Home' },
  { href: '/dealers/', label: 'Dealers' },
  { href: '/models/', label: 'Models' },
  { href: '/listings/', label: 'Listings' },
  { href: '/blog/', label: 'Blog' },
  { href: '/help-center/', label: 'Help Center' },
  { href: '/contact/', label: 'Contact' },
];

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const encodeJson = (value: StructuredData) =>
  JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('-->', '--\\>');

const toAbsoluteUrl = (pathValue: string) => {
  if (!pathValue) {
    return SITE_URL;
  }

  return pathValue.startsWith('http') ? pathValue : `${SITE_URL}${pathValue}`;
};

const normalizeDate = (value: FirestoreTimestampLike): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const formatDate = (value: FirestoreTimestampLike, locale: 'sq-AL' | 'en-GB') => {
  const parsed = normalizeDate(value);
  if (!parsed) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
};

const formatNumber = (value: number | undefined, locale: 'sq-AL' | 'en-GB') => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }

  return new Intl.NumberFormat(locale).format(value);
};

const formatCurrency = (value: number | undefined, currency: string | undefined, locale: 'sq-AL' | 'en-GB') => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
};

const truncate = (value: string | undefined, maxLength = 180) => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
};

const getFirestoreInstance = () => {
  if (!hasFirebaseConfig) {
    return null;
  }

  const app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  return getFirestore(app);
};

const sortBlogPosts = (posts: BlogPost[]) =>
  [...posts].sort((first, second) => {
    const firstTime = normalizeDate(first.publishedAt ?? first.date ?? first.createdAt)?.getTime() ?? 0;
    const secondTime = normalizeDate(second.publishedAt ?? second.date ?? second.createdAt)?.getTime() ?? 0;
    return secondTime - firstTime;
  });

const getPublicDealers = async (): Promise<Dealer[]> => {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    return [];
  }

  try {
    const snapshot = await getDocs(query(collection(firestore, 'dealers'), where('approved', '==', true)));

    return snapshot.docs
      .map(docSnapshot => ({ id: docSnapshot.id, ...(docSnapshot.data() as Omit<Dealer, 'id'>) }))
      .filter(entry => {
        const status = entry.status ?? (entry.approved === false ? 'pending' : 'approved');
        if (entry.isDeleted === true) {
          return false;
        }
        if (entry.isActive === false) {
          return false;
        }
        return status === 'approved';
      })
      .sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: 'base' }));
  } catch (error) {
    console.warn('Failed to load public dealers for prerendering.', error);
    return [];
  }
};

const getPublicModels = async (): Promise<Model[]> => {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    return [];
  }

  try {
    const snapshot = await getDocs(collection(firestore, 'models'));

    return snapshot.docs
      .map(docSnapshot => ({ id: docSnapshot.id, ...(docSnapshot.data() as Omit<Model, 'id'>) }))
      .sort((first, second) => {
        const brandComparison = first.brand.localeCompare(second.brand, undefined, { sensitivity: 'base' });
        if (brandComparison !== 0) {
          return brandComparison;
        }
        return first.model_name.localeCompare(second.model_name, undefined, { sensitivity: 'base' });
      });
  } catch (error) {
    console.warn('Failed to load public models for prerendering.', error);
    return [];
  }
};

const getPublicListings = async (): Promise<Listing[]> => {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    return [];
  }

  try {
    const snapshot = await getDocs(
      query(collection(firestore, 'listings'), where('status', 'in', ['approved', 'active'])),
    );

    return snapshot.docs
      .map(docSnapshot => ({ id: docSnapshot.id, ...(docSnapshot.data() as Omit<Listing, 'id'>) }))
      .sort((first, second) => {
        const firstTime = normalizeDate(first.updatedAt ?? first.createdAt)?.getTime() ?? 0;
        const secondTime = normalizeDate(second.updatedAt ?? second.createdAt)?.getTime() ?? 0;
        return secondTime - firstTime;
      });
  } catch (error) {
    console.warn('Failed to load public listings for prerendering.', error);
    return [];
  }
};

const getPublicDealerModels = async (): Promise<DealerModel[]> => {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    return [];
  }

  try {
    const snapshot = await getDocs(collection(firestore, 'dealerModels'));
    return snapshot.docs.map(docSnapshot => docSnapshot.data() as DealerModel);
  } catch (error) {
    console.warn('Failed to load dealer-model relationships for prerendering.', error);
    return [];
  }
};

const getPublicBlogPosts = async (): Promise<BlogPost[]> => {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    return sortBlogPosts(blogPostsData);
  }

  try {
    const snapshot = await getDocs(collection(firestore, 'blogPosts'));

    const posts = snapshot.docs
      .map(docSnapshot =>
        normalizeBlogPostImage({ id: docSnapshot.id, ...(docSnapshot.data() as Omit<BlogPost, 'id'>) }),
      )
      .filter(entry => entry.published !== false && entry.status !== 'draft');

    return posts.length > 0 ? sortBlogPosts(posts) : sortBlogPosts(blogPostsData);
  } catch (error) {
    console.warn('Failed to load public blog posts for prerendering. Falling back to local content.', error);
    return sortBlogPosts(blogPostsData);
  }
};

const loadPublicSiteData = async (): Promise<PublicSiteData> => {
  const [dealers, models, listings, blogPosts, dealerModels] = await Promise.all([
    getPublicDealers(),
    getPublicModels(),
    getPublicListings(),
    getPublicBlogPosts(),
    getPublicDealerModels(),
  ]);

  return {
    dealers,
    models,
    listings,
    blogPosts,
    dealerModels,
  };
};

const outputPathForRoute = (route: string) => {
  const trimmed = route.replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return path.join(distDir, 'index.html');
  }

  return path.join(distDir, ...trimmed.split('/'), 'index.html');
};

const renderBreadcrumbs = (items: Array<{ href?: string; label: string }>) =>
  `<nav aria-label="Breadcrumb" class="pr-breadcrumbs">${items
    .map((item, index) => {
      const content = item.href
        ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
        : `<span aria-current="page">${escapeHtml(item.label)}</span>`;
      return `${index > 0 ? '<span>/</span>' : ''}${content}`;
    })
    .join('')}</nav>`;

const renderTopbar = (lang: 'sq' | 'en') => {
  const navigation = lang === 'sq' ? sqNavigation : enNavigation;

  return `
    <header class="pr-topbar">
      <a class="pr-brand" href="/">
        <span class="pr-brand-dot" aria-hidden="true"></span>
        <span>Makina Elektrike</span>
      </a>
      <nav class="pr-nav" aria-label="${lang === 'sq' ? 'Navigimi kryesor' : 'Primary navigation'}">
        ${navigation
          .map(item => `<a href="${item.href}">${escapeHtml(item.label)}</a>`)
          .join('')}
      </nav>
    </header>
  `;
};

const renderFooter = (lang: 'sq' | 'en') => {
  const footerSections =
    lang === 'sq'
      ? [
          {
            title: 'Eksploro',
            links: [
              { href: '/dealers/', label: sq.header.dealers },
              { href: '/models/', label: sq.header.models },
              { href: '/listings/', label: sq.header.listings ?? 'Listimet' },
              { href: '/blog/', label: sq.header.blog },
            ],
          },
          {
            title: 'Ndihmë',
            links: [
              { href: '/help-center/', label: sq.header.helpCenter ?? 'Qendra e ndihmës' },
              { href: '/contact/', label: sq.footer.contact },
              { href: '/sitemap/', label: sq.footer.sitemap },
              { href: '/llms.txt', label: 'llms.txt' },
            ],
          },
          {
            title: 'Ligjore',
            links: [
              { href: '/privacy-policy/', label: sq.footer.privacy },
              { href: '/terms/', label: sq.footer.terms },
              { href: '/cookie-policy/', label: sq.footer.cookies },
            ],
          },
        ]
      : [
          {
            title: 'Explore',
            links: [
              { href: '/dealers/', label: 'Dealers' },
              { href: '/models/', label: 'Models' },
              { href: '/listings/', label: 'Listings' },
              { href: '/blog/', label: 'Blog' },
            ],
          },
          {
            title: 'Support',
            links: [
              { href: '/help-center/', label: 'Help Center' },
              { href: '/contact/', label: 'Contact' },
              { href: '/sitemap/', label: 'Sitemap' },
              { href: '/llms.txt', label: 'llms.txt' },
            ],
          },
          {
            title: 'Legal',
            links: [
              { href: '/privacy-policy/', label: 'Privacy Policy' },
              { href: '/terms/', label: 'Terms of Service' },
              { href: '/cookie-policy/', label: 'Cookie Policy' },
            ],
          },
        ];

  const legalBody = lang === 'sq' ? sq.footer.legalBody : 'Makina Elektrike publishes informational content about electric vehicles, dealers, listings, and charging infrastructure.';

  return `
    <footer class="pr-footer">
      <div class="pr-footer-grid">
        ${footerSections
          .map(
            section => `
              <section>
                <h2>${escapeHtml(section.title)}</h2>
                <ul>
                  ${section.links
                    .map(link => `<li><a href="${link.href}">${escapeHtml(link.label)}</a></li>`)
                    .join('')}
                </ul>
              </section>
            `,
          )
          .join('')}
      </div>
      <p class="pr-muted" style="margin-top:16px;">${escapeHtml(legalBody)}</p>
    </footer>
  `;
};

const renderStatCards = (items: Array<{ value: string; label: string; description?: string }>) =>
  items.length
    ? `
      <div class="pr-stats">
        ${items
          .map(
            item => `
              <div class="pr-card">
                <div class="pr-stat-value">${escapeHtml(item.value)}</div>
                <span class="pr-stat-label">${escapeHtml(item.label)}</span>
                ${item.description ? `<p class="pr-muted" style="margin-top:10px;">${escapeHtml(item.description)}</p>` : ''}
              </div>
            `,
          )
          .join('')}
      </div>
    `
    : '';

const renderActionLinks = (items: Array<{ href: string; label: string; ghost?: boolean }>) =>
  items.length
    ? `
      <div class="pr-hero-actions">
        ${items
          .map(
            item => `<a class="pr-button${item.ghost ? ' pr-button--ghost' : ''}" href="${item.href}">${escapeHtml(
              item.label,
            )}</a>`,
          )
          .join('')}
      </div>
    `
    : '';

const renderSection = (title: string, innerHtml: string, sectionId?: string) => `
  <section class="pr-section"${sectionId ? ` id="${escapeHtml(sectionId)}"` : ''}>
    <h2>${escapeHtml(title)}</h2>
    ${innerHtml}
  </section>
`;

const renderFaqSection = (title: string, items: Array<{ question: string; answer: string }>) =>
  renderSection(
    title,
    `<div class="pr-sections">
      ${items
        .map(
          item => `
            <article class="pr-card">
              <h3>${escapeHtml(item.question)}</h3>
              <p style="margin-top:10px;">${escapeHtml(item.answer)}</p>
            </article>
          `,
        )
        .join('')}
    </div>`,
  );

const renderStandardLayout = (options: {
  lang: 'sq' | 'en';
  title: string;
  description: string;
  breadcrumbs: Array<{ href?: string; label: string }>;
  label?: string;
  actions?: Array<{ href: string; label: string; ghost?: boolean }>;
  stats?: Array<{ value: string; label: string; description?: string }>;
  sections: string[];
}) => `
  <div class="pr-shell">
    ${renderTopbar(options.lang)}
    ${renderBreadcrumbs(options.breadcrumbs)}
    <section class="pr-hero">
      ${options.label ? `<span class="pr-pill">${escapeHtml(options.label)}</span>` : ''}
      <h1>${escapeHtml(options.title)}</h1>
      <p>${escapeHtml(options.description)}</p>
      ${renderActionLinks(options.actions ?? [])}
      ${renderStatCards(options.stats ?? [])}
    </section>
    <div class="pr-sections">
      ${options.sections.join('')}
    </div>
    ${renderFooter(options.lang)}
  </div>
`;

const buildDocument = (page: PageDefinition) => {
  const canonicalUrl = toAbsoluteUrl(page.canonicalPath);
  const ogImage = toAbsoluteUrl(page.image || DEFAULT_OG_IMAGE_PATH);
  const keywordsTag =
    page.keywords && page.keywords.length
      ? `<meta name="keywords" content="${escapeHtml(page.keywords.join(', '))}" />`
      : '';
  const structuredDataTag = page.structuredData
    ? `<script type="application/ld+json">${encodeJson(page.structuredData)}</script>`
    : '';
  const headExtras = `
    <meta name="description" content="${escapeHtml(page.description)}" />
    ${keywordsTag}
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="${escapeHtml(page.ogType || 'website')}" />
    <meta property="og:site_name" content="Makina Elektrike" />
    <meta property="og:locale" content="${page.lang === 'sq' ? 'sq_AL' : 'en_GB'}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:site" content="${TWITTER_SITE}" />
    ${PRERENDER_STYLE}
    ${structuredDataTag}
  `;

  return shellHtml
    .replace(/<html lang="[^"]*">/i, `<html lang="${page.lang}">`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>${headExtras}`)
    .replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${page.bodyHtml}</div>`);
};

const writePage = (page: PageDefinition) => {
  const outputPath = outputPathForRoute(page.outputRoute);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buildDocument(page), 'utf8');
};

const mapDealersById = (dealers: Dealer[]) => new Map(dealers.map(dealer => [dealer.id, dealer]));
const mapModelsById = (models: Model[]) => new Map(models.map(model => [model.id, model]));

const renderHomePage = (data: PublicSiteData): PageDefinition => {
  const featuredModels = data.models.filter(model => model.isFeatured).slice(0, 8);
  const featuredDealers = data.dealers.filter(dealer => dealer.isFeatured).slice(0, 6);
  const recentPosts = data.blogPosts.slice(0, 4);
  const valueHighlights = (sq.home.valueHighlights ?? []) as Array<{ title: string; description: string }>;
  const faqItems = (sq.home.faqItems ?? []).slice(0, 6) as Array<{ question: string; answer: string }>;

  const sections = [
    renderSection(
      sq.home.valueTitle,
      `<p>${escapeHtml(sq.home.valueSubtitle)}</p>
       <div class="pr-grid">
         ${valueHighlights
           .map(
             item => `
               <article class="pr-card">
                 <h3>${escapeHtml(item.title)}</h3>
                 <p style="margin-top:10px;">${escapeHtml(item.description)}</p>
               </article>
             `,
           )
           .join('')}
       </div>`,
    ),
    renderSection(
      sq.home.featuredModels,
      `<div class="pr-list-grid">
        ${featuredModels
          .map(
            model => `
              <article class="pr-card">
                <h3><a class="pr-link" href="/models/${encodeURIComponent(model.id)}/">${escapeHtml(model.brand)} ${escapeHtml(
                  model.model_name,
                )}</a></h3>
                <p style="margin-top:10px;">${escapeHtml(
                  truncate(model.notes || `${model.body_type || 'Electric vehicle'} with ${model.range_wltp ?? '—'} km WLTP range.`),
                )}</p>
                <div class="pr-facts">
                  <div class="pr-fact"><strong>${sq.modelDetails?.battery ?? 'Bateria'}</strong>${escapeHtml(
                    model.battery_capacity ? `${model.battery_capacity} kWh` : '—',
                  )}</div>
                  <div class="pr-fact"><strong>${sq.modelDetails?.range ?? 'Autonomia'}</strong>${escapeHtml(
                    model.range_wltp ? `${model.range_wltp} km` : '—',
                  )}</div>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderSection(
      sq.home.featuredDealers,
      `<div class="pr-list-grid">
        ${featuredDealers
          .map(
            dealer => `
              <article class="pr-card">
                <h3><a class="pr-link" href="/dealers/${encodeURIComponent(dealer.id)}/">${escapeHtml(dealer.name)}</a></h3>
                <p class="pr-muted" style="margin-top:8px;">${escapeHtml(dealer.city)}</p>
                <p style="margin-top:10px;">${escapeHtml(
                  truncate(dealer.description || dealer.address || dealer.location || ''),
                )}</p>
                <div class="pr-chip-list">
                  ${(dealer.brands || [])
                    .slice(0, 4)
                    .map(brand => `<span class="pr-pill">${escapeHtml(brand)}</span>`)
                    .join('')}
                </div>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderSection(
      sq.home.fromOurBlog,
      `<div class="pr-list-grid">
        ${recentPosts
          .map(
            post => `
              <article class="pr-card">
                <h3><a class="pr-link" href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
                <p class="pr-muted" style="margin-top:8px;">${escapeHtml(formatDate(post.date, 'sq-AL'))}</p>
                <p style="margin-top:10px;">${escapeHtml(post.excerpt)}</p>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderFaqSection(sq.home.faqTitle, faqItems),
  ];

  const structuredData: StructuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Makina Elektrike',
      url: SITE_URL,
      description: sq.home.metaDescription,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/models/?query={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Makina Elektrike',
      url: SITE_URL,
      description: sq.home.metaDescription,
    },
  ];

  return {
    outputRoute: '/__prerendered/home/',
    canonicalPath: '/',
    lang: 'sq',
    title: sq.home.metaTitle,
    description: sq.home.metaDescription,
    keywords: (sq.home.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang: 'sq',
      title: sq.home.heroTitle,
      description: sq.home.heroSubtitle,
      label: 'Makina Elektrike',
      breadcrumbs: [{ label: sq.header.home }],
      actions: [
        { href: '/models/', label: sq.home.heroPrimaryCta },
        { href: '/dealers/', label: sq.home.heroSecondaryCta, ghost: true },
        { href: '/help-center/', label: sq.header.helpCenter ?? 'Qendra e ndihmës', ghost: true },
      ],
      stats: [
        { value: formatNumber(data.models.length, 'sq-AL'), label: 'Modele publike' },
        { value: formatNumber(data.dealers.length, 'sq-AL'), label: 'Dilerë të aprovuar' },
        { value: formatNumber(data.listings.length, 'sq-AL'), label: 'Listime aktive' },
        { value: formatNumber(data.blogPosts.length, 'sq-AL'), label: 'Artikuj informues' },
      ],
      sections,
    }),
  };
};

const renderDealersPage = (data: PublicSiteData): PageDefinition => {
  const faqItems = (sq.dealersPage.faqItems ?? []).slice(0, 6) as Array<{ question: string; answer: string }>;
  const allBrands = Array.from(new Set(data.dealers.flatMap(dealer => dealer.brands || []))).sort();
  const allCities = Array.from(new Set(data.dealers.map(dealer => dealer.city))).sort();
  const insights = (sq.dealersPage.insights ?? []) as Array<{ title: string; description: string }>;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: sq.dealersPage.metaTitle,
    description: sq.dealersPage.metaDescription,
    url: `${SITE_URL}/dealers/`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: data.dealers.slice(0, 100).map((dealer, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: dealer.name,
        url: `${SITE_URL}/dealers/${dealer.id}/`,
      })),
    },
  };

  const sections = [
    renderSection(
      sq.dealersPage.introTitle,
      `<p>${escapeHtml(sq.dealersPage.introSubtitle)}</p>
       <div class="pr-chip-list">
         ${allCities.slice(0, 12).map(city => `<span class="pr-pill">${escapeHtml(city)}</span>`).join('')}
       </div>`,
    ),
    renderSection(
      sq.dealersPage.insightsTitle,
      `<div class="pr-grid">
        ${insights
          .map(
            insight => `
              <article class="pr-card">
                <h3>${escapeHtml(insight.title)}</h3>
                <p style="margin-top:10px;">${escapeHtml(insight.description)}</p>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderSection(
      sq.dealersPage.title,
      `<div class="pr-list-grid">
        ${data.dealers
          .map(
            dealer => `
              <article class="pr-card">
                <h3><a class="pr-link" href="/dealers/${encodeURIComponent(dealer.id)}/">${escapeHtml(dealer.name)}</a></h3>
                <p class="pr-muted" style="margin-top:8px;">${escapeHtml(dealer.city)}</p>
                <p style="margin-top:10px;">${escapeHtml(
                  truncate(dealer.description || dealer.location || dealer.address || '', 200),
                )}</p>
                <div class="pr-chip-list">
                  ${(dealer.brands || [])
                    .slice(0, 5)
                    .map(brand => `<span class="pr-pill">${escapeHtml(brand)}</span>`)
                    .join('')}
                </div>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderFaqSection(sq.dealersPage.faqTitle, faqItems),
  ];

  return {
    outputRoute: '/dealers/',
    canonicalPath: '/dealers/',
    lang: 'sq',
    title: sq.dealersPage.metaTitle,
    description: sq.dealersPage.metaDescription,
    keywords: (sq.dealersPage.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang: 'sq',
      title: sq.dealersPage.title,
      description: sq.dealersPage.subtitle,
      label: sq.header.dealers,
      breadcrumbs: [{ href: '/', label: sq.header.home }, { label: sq.header.dealers }],
      actions: [
        { href: '/models/', label: sq.header.models },
        { href: '/contact/', label: sq.footer.contact, ghost: true },
      ],
      stats: [
        { value: formatNumber(data.dealers.length, 'sq-AL'), label: 'Dilerë aktivë' },
        { value: formatNumber(allCities.length, 'sq-AL'), label: 'Qytete të mbuluara' },
        { value: formatNumber(allBrands.length, 'sq-AL'), label: 'Marka të përfaqësuara' },
      ],
      sections,
    }),
  };
};

const renderModelsPage = (data: PublicSiteData): PageDefinition => {
  const faqItems = (sq.modelsPage.faqItems ?? []).slice(0, 6) as Array<{ question: string; answer: string }>;
  const insights = (sq.modelsPage.insights ?? []) as Array<{ title: string; description: string }>;
  const brands = Array.from(new Set(data.models.map(model => model.brand))).sort((a, b) => a.localeCompare(b));
  const bodyTypes = Array.from(new Set(data.models.map(model => model.body_type).filter(Boolean))).sort() as string[];
  const groupedModels = brands.map(brand => ({
    brand,
    models: data.models.filter(model => model.brand === brand),
  }));

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: sq.modelsPage.metaTitle,
    description: sq.modelsPage.metaDescription,
    url: `${SITE_URL}/models/`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: data.models.slice(0, 120).map((model, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `${model.brand} ${model.model_name}`,
        url: `${SITE_URL}/models/${model.id}/`,
      })),
    },
  };

  const sections = [
    renderSection(
      sq.modelsPage.introTitle,
      `<p>${escapeHtml(sq.modelsPage.introSubtitle)}</p>
       <div class="pr-chip-list">
         ${bodyTypes.slice(0, 12).map(type => `<span class="pr-pill">${escapeHtml(type)}</span>`).join('')}
       </div>`,
    ),
    renderSection(
      sq.modelsPage.insightsTitle,
      `<div class="pr-grid">
        ${insights
          .map(
            insight => `
              <article class="pr-card">
                <h3>${escapeHtml(insight.title)}</h3>
                <p style="margin-top:10px;">${escapeHtml(insight.description)}</p>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderSection(
      sq.modelsPage.title,
      `<div class="pr-grouped-list">
        ${groupedModels
          .map(
            group => `
              <article class="pr-card">
                <h3>${escapeHtml(group.brand)}</h3>
                <ul>
                  ${group.models
                    .map(
                      model => `
                        <li>
                          <a class="pr-link" href="/models/${encodeURIComponent(model.id)}/">${escapeHtml(
                            model.model_name,
                          )}</a>
                          ${model.range_wltp ? ` <span class="pr-muted">(${escapeHtml(`${model.range_wltp} km WLTP`)})</span>` : ''}
                        </li>
                      `,
                    )
                    .join('')}
                </ul>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderFaqSection(sq.modelsPage.faqTitle, faqItems),
  ];

  return {
    outputRoute: '/models/',
    canonicalPath: '/models/',
    lang: 'sq',
    title: sq.modelsPage.metaTitle,
    description: sq.modelsPage.metaDescription,
    keywords: (sq.modelsPage.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang: 'sq',
      title: sq.modelsPage.title,
      description: sq.modelsPage.subtitle,
      label: sq.header.models,
      breadcrumbs: [{ href: '/', label: sq.header.home }, { label: sq.header.models }],
      actions: [
        { href: '/dealers/', label: sq.header.dealers },
        { href: '/blog/', label: sq.header.blog, ghost: true },
      ],
      stats: [
        { value: formatNumber(data.models.length, 'sq-AL'), label: 'Modele të kataloguara' },
        { value: formatNumber(brands.length, 'sq-AL'), label: 'Marka' },
        { value: formatNumber(bodyTypes.length, 'sq-AL'), label: 'Karroceri' },
      ],
      sections,
    }),
  };
};

const renderListingsPage = (data: PublicSiteData, dealersById: Map<string, Dealer>): PageDefinition => {
  const averagePrice =
    data.listings.length > 0
      ? Math.round(data.listings.reduce((sum, listing) => sum + listing.price, 0) / data.listings.length)
      : 0;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Electric Cars for Sale | Makina Elektrike',
    description: 'Browse the best collection of electric vehicles in Albania.',
    url: `${SITE_URL}/listings/`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: data.listings.slice(0, 120).map((listing, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `${listing.make} ${listing.model} (${listing.year})`,
        url: `${SITE_URL}/listings/${listing.id}/`,
      })),
    },
  };

  const sections = [
    renderSection(
      'Current inventory',
      data.listings.length
        ? `<div class="pr-list-grid">
            ${data.listings
              .map(listing => {
                const dealer = dealersById.get(listing.dealerId);
                const location = listing.location?.city || dealer?.city || '';
                return `
                  <article class="pr-card">
                    <h3><a class="pr-link" href="/listings/${encodeURIComponent(listing.id)}/">${escapeHtml(
                      `${listing.make} ${listing.model} (${listing.year})`,
                    )}</a></h3>
                    <p style="margin-top:10px;">${escapeHtml(truncate(listing.description, 180))}</p>
                    <div class="pr-facts">
                      <div class="pr-fact"><strong>Price</strong>${escapeHtml(
                        formatCurrency(listing.price, listing.priceCurrency, 'en-GB'),
                      )}</div>
                      <div class="pr-fact"><strong>Mileage</strong>${escapeHtml(
                        `${formatNumber(listing.mileage, 'en-GB')} km`,
                      )}</div>
                      <div class="pr-fact"><strong>Location</strong>${escapeHtml(location || 'Albania')}</div>
                    </div>
                    ${
                      dealer
                        ? `<p class="pr-muted" style="margin-top:10px;">Sold by <a class="pr-link" href="/dealers/${encodeURIComponent(
                            dealer.id,
                          )}/">${escapeHtml(dealer.name)}</a></p>`
                        : ''
                    }
                  </article>
                `;
              })
              .join('')}
          </div>`
        : '<p>No active public listings are available right now.</p>',
    ),
  ];

  return {
    outputRoute: '/listings/',
    canonicalPath: '/listings/',
    lang: 'en',
    title: 'Electric Cars for Sale | Makina Elektrike',
    description: 'Browse the best collection of electric vehicles in Albania.',
    keywords: ['electric cars Albania', 'EV listings', 'used electric vehicles', 'Makina Elektrike listings'],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang: 'en',
      title: 'Find Your Electric Car',
      description: 'Browse public EV listings, compare prices, and connect with Albanian dealers selling electric vehicles.',
      label: 'Listings',
      breadcrumbs: [{ href: '/', label: 'Home' }, { label: 'Listings' }],
      actions: [
        { href: '/dealers/', label: 'Browse dealers' },
        { href: '/models/', label: 'Compare models', ghost: true },
      ],
      stats: [
        { value: formatNumber(data.listings.length, 'en-GB'), label: 'Active listings' },
        { value: averagePrice ? formatCurrency(averagePrice, 'EUR', 'en-GB') : '—', label: 'Average price' },
      ],
      sections,
    }),
  };
};

const renderBlogPage = (data: PublicSiteData): PageDefinition => {
  const faqItems = (sq.blogPage?.faqItems ?? []) as Array<{ question: string; answer: string }>;
  const insights = (sq.blogPage?.insights ?? []) as Array<{ title: string; description: string }>;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: sq.blogPage.metaTitle,
    description: sq.blogPage.metaDescription,
    url: `${SITE_URL}/blog/`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: data.blogPosts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: post.title,
        url: `${SITE_URL}/blog/${post.slug}`,
      })),
    },
  };

  const sections = [
    renderSection(
      sq.blogPage.introTitle,
      `<p>${escapeHtml(sq.blogPage.introSubtitle)}</p>`,
    ),
    renderSection(
      sq.blogPage.title,
      `<div class="pr-list-grid">
        ${data.blogPosts
          .map(
            post => `
              <article class="pr-card">
                <h3><a class="pr-link" href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
                <p class="pr-muted" style="margin-top:8px;">${escapeHtml(formatDate(post.date, 'sq-AL'))} • ${escapeHtml(
                  post.readTime,
                )}</p>
                <p style="margin-top:10px;">${escapeHtml(post.excerpt)}</p>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderSection(
      sq.blogPage.insightsTitle,
      `<div class="pr-grid">
        ${insights
          .map(
            insight => `
              <article class="pr-card">
                <h3>${escapeHtml(insight.title)}</h3>
                <p style="margin-top:10px;">${escapeHtml(insight.description)}</p>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    faqItems.length ? renderFaqSection(sq.blogPage.faqTitle, faqItems) : '',
  ].filter(Boolean);

  return {
    outputRoute: '/blog/',
    canonicalPath: '/blog/',
    lang: 'sq',
    title: sq.blogPage.metaTitle,
    description: sq.blogPage.metaDescription,
    keywords: (sq.blogPage.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang: 'sq',
      title: sq.blogPage.title,
      description: sq.blogPage.subtitle,
      label: sq.header.blog,
      breadcrumbs: [{ href: '/', label: sq.header.home }, { label: sq.header.blog }],
      actions: [
        { href: '/models/', label: sq.header.models },
        { href: '/help-center/', label: sq.header.helpCenter ?? 'Qendra e ndihmës', ghost: true },
      ],
      stats: [
        { value: formatNumber(data.blogPosts.length, 'sq-AL'), label: 'Artikuj' },
        {
          value: data.blogPosts[0] ? formatDate(data.blogPosts[0].date, 'sq-AL') : '—',
          label: 'Artikulli më i ri',
        },
      ],
      sections,
    }),
  };
};

const renderHelpCenterPage = (): PageDefinition => {
  const content = getHelpCenterContent('sq');

  const structuredData: StructuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: content.metaTitle,
      description: content.metaDescription,
      url: `${SITE_URL}/help-center/`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: content.sections.map((section, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: section.title,
        url: `${SITE_URL}/help-center/#${section.id}`,
      })),
    },
  ];

  const sections = content.sections.map(section =>
    renderSection(
      section.title,
      `<p>${escapeHtml(section.summary)}</p>
       <div class="pr-grid">
         ${section.articles
           .map(
             article => `
               <article class="pr-card">
                 <h3>${escapeHtml(article.title)}</h3>
                 <p style="margin-top:10px;">${escapeHtml(article.body)}</p>
                 <ul class="pr-list">
                   ${article.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                 </ul>
                 ${
                   article.ctaTo && article.ctaLabel
                     ? `<p style="margin-top:14px;"><a class="pr-link" href="${article.ctaTo}">${escapeHtml(article.ctaLabel)}</a></p>`
                     : ''
                 }
               </article>
             `,
           )
           .join('')}
       </div>`,
      section.id,
    ),
  );

  return {
    outputRoute: '/help-center/',
    canonicalPath: '/help-center/',
    lang: 'sq',
    title: content.metaTitle,
    description: content.metaDescription,
    keywords: content.metaKeywords,
    structuredData,
    bodyHtml: renderStandardLayout({
      lang: 'sq',
      title: content.title,
      description: content.subtitle,
      label: sq.header.helpCenter ?? 'Qendra e ndihmës',
      breadcrumbs: [{ href: '/', label: sq.header.home }, { label: sq.header.helpCenter ?? 'Qendra e ndihmës' }],
      actions: [
        { href: content.supportPrimaryTo, label: content.supportPrimaryLabel },
        { href: content.supportSecondaryTo, label: content.supportSecondaryLabel, ghost: true },
      ],
      stats: [
        { value: formatNumber(content.sections.length, 'sq-AL'), label: 'Tema kryesore' },
        {
          value: formatNumber(content.sections.reduce((sum, section) => sum + section.articles.length, 0), 'sq-AL'),
          label: 'Përgjigje të strukturuara',
        },
      ],
      sections,
    }),
  };
};

const renderAboutPage = (): PageDefinition => {
  const pillars = (sq.aboutPage.pillars ?? []) as Array<{ title: string; description: string }>;
  const faqItems = (sq.aboutPage.faqItems ?? []) as Array<{ question: string; answer: string }>;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: sq.aboutPage.metaTitle,
    description: sq.aboutPage.metaDescription,
    url: `${SITE_URL}/about/`,
  };

  const sections = [
    renderSection(
      sq.aboutPage.title,
      `<p>${escapeHtml(sq.aboutPage.p1)}</p>
       <p>${escapeHtml(sq.aboutPage.p2)}</p>
       <p>${escapeHtml(sq.aboutPage.p3)}</p>
       <p>${escapeHtml(sq.aboutPage.p4)}</p>`,
    ),
    renderSection(
      sq.aboutPage.transparencyTitle,
      `<p>${escapeHtml(sq.aboutPage.transparencyP1)}</p>
       <p>${escapeHtml(sq.aboutPage.transparencyP2)}</p>
       <p>${escapeHtml(sq.aboutPage.transparencyP3)}</p>`,
    ),
    renderSection(
      sq.aboutPage.pillarsTitle ?? 'Parimet tona',
      `<div class="pr-grid">
        ${pillars
          .map(
            pillar => `
              <article class="pr-card">
                <h3>${escapeHtml(pillar.title)}</h3>
                <p style="margin-top:10px;">${escapeHtml(pillar.description)}</p>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderFaqSection(sq.aboutPage.faqTitle, faqItems),
  ];

  return {
    outputRoute: '/about/',
    canonicalPath: '/about/',
    lang: 'sq',
    title: sq.aboutPage.metaTitle,
    description: sq.aboutPage.metaDescription,
    keywords: (sq.aboutPage.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang: 'sq',
      title: sq.aboutPage.title,
      description: sq.aboutPage.metaDescription,
      label: sq.header.about,
      breadcrumbs: [{ href: '/', label: sq.header.home }, { label: sq.header.about }],
      actions: [{ href: '/contact/', label: sq.aboutPage.collaborationCtaButton }],
      sections,
    }),
  };
};

const renderContactPage = (): PageDefinition => {
  const faqItems = (sq.contactPage.faqItems ?? []) as Array<{ question: string; answer: string }>;
  const highlights = (sq.contactPage.highlights ?? []) as Array<{ title: string; description: string }>;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: sq.contactPage.metaTitle,
    description: sq.contactPage.metaDescription,
    url: `${SITE_URL}/contact/`,
  };

  const sections = [
    renderSection(
      sq.contactPage.title,
      `<div class="pr-grid">
        ${highlights
          .map(
            highlight => `
              <article class="pr-card">
                <h3>${escapeHtml(highlight.title)}</h3>
                <p style="margin-top:10px;">${escapeHtml(highlight.description)}</p>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderSection(
      'Kontakt',
      `<div class="pr-meta-grid">
        <div class="pr-fact"><strong>${escapeHtml(sq.contactPage.email)}</strong><a class="pr-link" href="mailto:info@makinaelektrike.al">info@makinaelektrike.al</a></div>
        <div class="pr-fact"><strong>${escapeHtml(sq.contactPage.address)}</strong>${escapeHtml(sq.contactPage.addressDetails)}</div>
      </div>`,
    ),
    renderFaqSection(sq.contactPage.faqTitle, faqItems),
  ];

  return {
    outputRoute: '/contact/',
    canonicalPath: '/contact/',
    lang: 'sq',
    title: sq.contactPage.metaTitle,
    description: sq.contactPage.metaDescription,
    keywords: (sq.contactPage.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang: 'sq',
      title: sq.contactPage.title,
      description: sq.contactPage.p1,
      label: sq.footer.contact,
      breadcrumbs: [{ href: '/', label: sq.header.home }, { label: sq.footer.contact }],
      actions: [
        { href: 'mailto:info@makinaelektrike.al', label: 'info@makinaelektrike.al' },
        { href: '/help-center/', label: sq.header.helpCenter ?? 'Qendra e ndihmës', ghost: true },
      ],
      sections,
    }),
  };
};

const renderRegisterUserPage = (): PageDefinition => {
  const sections = [
    renderSection(
      'Why register?',
      `<ul class="pr-list">
        <li>Receive curated updates about new electric models arriving in Albania.</li>
        <li>Bookmark trusted dealerships and keep a shortlist of the vehicles you are comparing.</li>
        <li>Save favorites so you can return to them quickly when you are ready to contact a dealer.</li>
      </ul>`,
    ),
    renderSection(
      'Registration details',
      `<p>Create an account with your full name, phone number, email address, and password. After the page loads, the full registration form is available directly on this route.</p>`,
    ),
  ];

  return {
    outputRoute: '/register/',
    canonicalPath: '/register/',
    lang: 'en',
    title: 'Krijo llogarinë | Makina Elektrike',
    description: 'Regjistrohu për të ruajtur dilerët dhe modelet e preferuara të makinave elektrike në Shqipëri.',
    keywords: ['regjistrim', 'makina elektrike', 'favoritët e makinave', 'Makina Elektrike account'],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Krijo llogarinë | Makina Elektrike',
      description: 'Regjistrohu për të ruajtur dilerët dhe modelet e preferuara të makinave elektrike në Shqipëri.',
      url: `${SITE_URL}/register/`,
    },
    bodyHtml: renderStandardLayout({
      lang: 'en',
      title: 'Create Your Account',
      description: 'Join Makina Elektrike to save favourite dealers and electric vehicle models.',
      label: 'User registration',
      breadcrumbs: [{ href: '/', label: 'Home' }, { label: 'Register' }],
      actions: [
        { href: '/dealers/', label: 'Browse dealers' },
        { href: '/models/', label: 'Browse models', ghost: true },
      ],
      sections,
    }),
  };
};

const renderRegisterDealerPage = (): PageDefinition => {
  const sections = [
    renderSection(
      'Benefits of joining Makina Elektrike',
      `<ul class="pr-list">
        <li>Reach EV buyers across Albania with public dealer and inventory pages.</li>
        <li>Publish model information, manage your public profile, and keep listings current.</li>
        <li>Receive enquiries from visitors researching electric vehicles and dealership partners.</li>
      </ul>`,
    ),
    renderSection(
      'Application details',
      `<p>The dealership application collects company name, primary contact, phone number, city, website, business email, and a short note about your inventory and experience. After the page loads, the interactive application form is available on this route.</p>`,
    ),
  ];

  return {
    outputRoute: '/register-dealer/',
    canonicalPath: '/register-dealer/',
    lang: 'en',
    title: 'Regjistro dilerin | Makina Elektrike',
    description: 'Apliko për t’u listuar si dealer i autorizuar i makinave elektrike në Shqipëri.',
    keywords: ['regjistrim dealer', 'makina elektrike', 'listo dilerin', 'Makina Elektrike'],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Regjistro dilerin | Makina Elektrike',
      description: 'Apliko për t’u listuar si dealer i autorizuar i makinave elektrike në Shqipëri.',
      url: `${SITE_URL}/register-dealer/`,
    },
    bodyHtml: renderStandardLayout({
      lang: 'en',
      title: 'Dealer Registration',
      description: 'Submit your details to join Makina Elektrike as a trusted electric vehicle dealer.',
      label: 'Dealer onboarding',
      breadcrumbs: [{ href: '/', label: 'Home' }, { label: 'Register Dealer' }],
      actions: [
        { href: '/contact/', label: 'Contact our team' },
        { href: '/help-center/', label: 'Dealer help topics', ghost: true },
      ],
      sections,
    }),
  };
};

const renderChargingStationsPage = (): PageDefinition => {
  const faqItems = [
    {
      question: 'How accurate is the data on this map?',
      answer:
        'All charging locations come directly from Open Charge Map contributors. Each listing includes the most recent operational information available from that source.',
    },
    {
      question: 'Which connector types are common in Albania?',
      answer:
        'Type 2 AC connectors and CCS2 DC fast chargers are the most common formats on Albania’s public charging network.',
    },
    {
      question: 'Can I use the charging map without an account?',
      answer:
        'Yes. The map is public and can be used without signing in, including station search, location sharing, and directions.',
    },
  ];

  const structuredData: StructuredData = {
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
  };

  const sections = [
    renderSection(
      'How to use the charging map',
      `<ol class="pr-numbered">
        <li>Search by area or move the map to focus on the corridor, city, or destination you need.</li>
        <li>Open any station card to review connector types, power levels, operator information, and address details.</li>
        <li>Use the directions and share actions to plan routes or send station links to drivers and customers.</li>
      </ol>`,
    ),
    renderSection(
      'Where you’ll find chargers in Albania',
      `<p>Coverage continues to expand across Tirana, Durrës, Shkodër, Korçë, and the southern coast. The strongest long-distance coverage is on the major travel corridors where fast CCS2 chargers support regional travel.</p>
       <p>Hospitality venues, retail destinations, and local operators are adding more AC and DC charging options, which makes this route a strong informational landing page for EV owners planning travel in Albania.</p>`,
    ),
    renderFaqSection('Frequently Asked Questions', faqItems),
  ];

  return {
    outputRoute: '/albania-charging-stations/',
    canonicalPath: '/albania-charging-stations/',
    lang: 'en',
    title: 'Charging Stations in Albania – Interactive EV Map | Makina Elektrike',
    description:
      'Find EV charging stations across Albania. Search the interactive map, explore station details, and plan your route with live Open Charge Map data.',
    keywords: [
      'Albania EV charging map',
      'Open Charge Map Albania',
      'EV charging stations Tirana',
      'Makina Elektrike charging',
    ],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang: 'en',
      title: 'Charging Stations in Albania',
      description:
        'Use the live EV charging map to search station locations across Albania, review charging details, and plan routes with public charging stops.',
      label: 'Charging map',
      breadcrumbs: [{ href: '/', label: 'Home' }, { label: 'Charging Stations in Albania' }],
      actions: [
        { href: '/help-center/', label: 'EV help topics' },
        { href: '/contact/', label: 'Contact', ghost: true },
      ],
      sections,
    }),
  };
};

const renderSitemapPage = (data: PublicSiteData): PageDefinition => {
  const navigationSections = [
    {
      title: sq.sitemap.sections.explore.title,
      items: [
        { href: '/', label: sq.header.home },
        { href: '/dealers/', label: sq.header.dealers },
        { href: '/models/', label: sq.header.models },
        { href: '/albania-charging-stations/', label: sq.header.chargingStations },
        { href: '/blog/', label: sq.header.blog },
      ],
    },
    {
      title: sq.sitemap.sections.services.title,
      items: [
        { href: '/register/', label: sq.footer.userSignup },
        { href: '/register-dealer/', label: sq.footer.dealerSignup },
        { href: '/help-center/', label: sq.header.helpCenter ?? 'Qendra e ndihmës' },
      ],
    },
    {
      title: sq.sitemap.sections.legal.title,
      items: [
        { href: '/privacy-policy/', label: sq.footer.privacy },
        { href: '/terms/', label: sq.footer.terms },
        { href: '/cookie-policy/', label: sq.footer.cookies },
      ],
    },
  ];

  const sections = [
    renderSection(
      sq.sitemap.sections.explore.title,
      `<div class="pr-grid">
        ${navigationSections
          .map(
            section => `
              <article class="pr-card">
                <h3>${escapeHtml(section.title)}</h3>
                <ul class="pr-list">
                  ${section.items
                    .map(item => `<li><a class="pr-link" href="${item.href}">${escapeHtml(item.label)}</a></li>`)
                    .join('')}
                </ul>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderSection(
      sq.sitemap.dynamic.models,
      `<ul class="pr-list">
        ${data.models
          .slice(0, 18)
          .map(model => `<li><a class="pr-link" href="/models/${encodeURIComponent(model.id)}/">${escapeHtml(model.brand)} ${escapeHtml(model.model_name)}</a></li>`)
          .join('')}
      </ul>`,
    ),
    renderSection(
      sq.sitemap.dynamic.dealers,
      `<ul class="pr-list">
        ${data.dealers
          .slice(0, 18)
          .map(dealer => `<li><a class="pr-link" href="/dealers/${encodeURIComponent(dealer.id)}/">${escapeHtml(dealer.name)}</a></li>`)
          .join('')}
      </ul>`,
    ),
    renderSection(
      sq.sitemap.dynamic.blog,
      `<ul class="pr-list">
        ${data.blogPosts
          .slice(0, 18)
          .map(post => `<li><a class="pr-link" href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></li>`)
          .join('')}
      </ul>
      <p style="margin-top:14px;"><a class="pr-link" href="/sitemap.xml">${escapeHtml(sq.sitemap.xmlCta)}</a></p>`,
    ),
  ];

  return {
    outputRoute: '/sitemap/',
    canonicalPath: '/sitemap/',
    lang: 'sq',
    title: sq.sitemap.metaTitle,
    description: sq.sitemap.metaDescription,
    keywords: (sq.sitemap.metaKeywords ?? []) as string[],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: sq.sitemap.metaTitle,
      description: sq.sitemap.metaDescription,
      url: `${SITE_URL}/sitemap/`,
    },
    bodyHtml: renderStandardLayout({
      lang: 'sq',
      title: sq.sitemap.title,
      description: sq.sitemap.subtitle,
      label: sq.footer.sitemap,
      breadcrumbs: [{ href: '/', label: sq.header.home }, { label: sq.footer.sitemap }],
      sections,
    }),
  };
};

const renderLegalPage = (options: {
  outputRoute: string;
  canonicalPath: string;
  title: string;
  description: string;
  keywords: string[];
  updated: string;
  intro: string;
  sections: Array<{ title: string; items: string[] }>;
}) => {
  const sectionHtml = options.sections.map(section =>
    renderSection(
      section.title,
      `<ul class="pr-list">
        ${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>`,
    ),
  );

  return {
    outputRoute: options.outputRoute,
    canonicalPath: options.canonicalPath,
    lang: 'sq' as const,
    title: options.title,
    description: options.description,
    keywords: options.keywords,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: options.title,
      description: options.description,
      url: toAbsoluteUrl(options.canonicalPath),
    },
    bodyHtml: renderStandardLayout({
      lang: 'sq',
      title: options.title,
      description: options.intro,
      label: sq.footer.legal,
      breadcrumbs: [{ href: '/', label: sq.header.home }, { label: options.title }],
      stats: [{ value: options.updated, label: 'Përditësuar' }],
      sections: [
        ...sectionHtml,
        renderSection(
          sq.legal.common.questionsTitle,
          `<p>${escapeHtml(sq.legal.common.questionsBody)}</p>
           <div class="pr-inline-links">
             <a class="pr-link" href="/contact/">${escapeHtml(sq.legal.common.contactCta)}</a>
             <a class="pr-link" href="/terms/">${escapeHtml(sq.footer.terms)}</a>
             <a class="pr-link" href="/privacy-policy/">${escapeHtml(sq.footer.privacy)}</a>
           </div>`,
        ),
      ],
    }),
  };
};

const renderDealerDetailPages = (
  data: PublicSiteData,
  dealersById: Map<string, Dealer>,
  modelsById: Map<string, Model>,
) => {
  const linksByDealerId = new Map<string, Model[]>();
  data.dealerModels.forEach(link => {
    const model = modelsById.get(link.model_id);
    if (!model) {
      return;
    }
    const current = linksByDealerId.get(link.dealer_id) ?? [];
    current.push(model);
    linksByDealerId.set(link.dealer_id, current);
  });

  return data.dealers.map<PageDefinition>(dealer => {
    const relatedModels = (linksByDealerId.get(dealer.id) ?? []).sort((a, b) =>
      `${a.brand} ${a.model_name}`.localeCompare(`${b.brand} ${b.model_name}`),
    );
    const canonicalPath = `/dealers/${dealer.id}/`;
    const displayAddress = dealer.location || [dealer.address, dealer.city].filter(Boolean).join(', ');
    const description = truncate(
      dealer.description ||
        `${dealer.name} është diler i aprovuar në ${dealer.city} me fokus te markat ${(dealer.brands || []).join(', ')}.`,
      170,
    );

    const structuredData: StructuredData = {
      '@context': 'https://schema.org',
      '@type': 'AutoDealer',
      name: dealer.name,
      url: `${SITE_URL}${canonicalPath}`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: displayAddress,
        addressLocality: dealer.city,
        addressCountry: 'AL',
      },
      telephone: dealer.contact_phone || dealer.phone || undefined,
      email: dealer.contact_email || dealer.email || undefined,
      makesOffer: (dealer.brands || []).map(brand => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Product',
          name: `${brand} electric vehicles`,
        },
      })),
    };

    const sections = [
      renderSection(
        'Profili i dilerit',
        `<p>${escapeHtml(dealer.description || displayAddress || dealer.city)}</p>
         <div class="pr-meta-grid">
           <div class="pr-fact"><strong>Qyteti</strong>${escapeHtml(dealer.city)}</div>
           ${
             displayAddress
               ? `<div class="pr-fact"><strong>Adresa</strong>${escapeHtml(displayAddress)}</div>`
               : ''
           }
           ${
             dealer.contact_phone || dealer.phone
               ? `<div class="pr-fact"><strong>Telefon</strong><a class="pr-link" href="tel:${escapeHtml(
                   dealer.contact_phone || dealer.phone || '',
                 )}">${escapeHtml(dealer.contact_phone || dealer.phone || '')}</a></div>`
               : ''
           }
           ${
             dealer.contact_email || dealer.email
               ? `<div class="pr-fact"><strong>Email</strong><a class="pr-link" href="mailto:${escapeHtml(
                   dealer.contact_email || dealer.email || '',
                 )}">${escapeHtml(dealer.contact_email || dealer.email || '')}</a></div>`
               : ''
           }
           ${
             dealer.website
               ? `<div class="pr-fact"><strong>Website</strong><a class="pr-link" href="${escapeHtml(
                   dealer.website,
                 )}">${escapeHtml(dealer.website)}</a></div>`
               : ''
           }
         </div>`,
      ),
      renderSection(
        'Markat dhe gjuhët',
        `<div class="pr-grid">
          <article class="pr-card">
            <h3>Markat</h3>
            <div class="pr-chip-list">
              ${(dealer.brands || []).map(brand => `<span class="pr-pill">${escapeHtml(brand)}</span>`).join('')}
            </div>
          </article>
          <article class="pr-card">
            <h3>Gjuhët</h3>
            <div class="pr-chip-list">
              ${(dealer.languages || []).length
                ? dealer.languages.map(language => `<span class="pr-pill">${escapeHtml(language)}</span>`).join('')
                : '<span class="pr-muted">Nuk ka gjuhë të deklaruara.</span>'}
            </div>
          </article>
        </div>`,
      ),
      relatedModels.length
        ? renderSection(
            'Modele të lidhura',
            `<ul class="pr-list">
              ${relatedModels
                .slice(0, 18)
                .map(
                  model => `
                    <li>
                      <a class="pr-link" href="/models/${encodeURIComponent(model.id)}/">${escapeHtml(model.brand)} ${escapeHtml(
                        model.model_name,
                      )}</a>
                    </li>
                  `,
                )
                .join('')}
            </ul>`,
          )
        : '',
    ].filter(Boolean);

    return {
      outputRoute: canonicalPath,
      canonicalPath,
      lang: 'sq',
      title: `${dealer.name} | ${sq.dealerDetails.metaTitleSuffix}`,
      description,
      keywords: [dealer.name, dealer.city, ...(dealer.brands || [])],
      structuredData,
      bodyHtml: renderStandardLayout({
        lang: 'sq',
        title: dealer.name,
        description,
        label: 'Dealer i aprovuar',
        breadcrumbs: [
          { href: '/', label: sq.header.home },
          { href: '/dealers/', label: sq.header.dealers },
          { label: dealer.name },
        ],
        actions: [
          { href: '/dealers/', label: sq.dealerDetails.backLink },
          { href: '/contact/', label: sq.footer.contact, ghost: true },
        ],
        stats: [
          { value: formatNumber((dealer.brands || []).length, 'sq-AL'), label: 'Marka' },
          { value: formatNumber((dealer.languages || []).length, 'sq-AL'), label: 'Gjuhë' },
          { value: formatNumber(relatedModels.length, 'sq-AL'), label: 'Modele të lidhura' },
        ],
        sections,
      }),
    };
  });
};

const renderModelDetailPages = (data: PublicSiteData, dealersById: Map<string, Dealer>) => {
  const linksByModelId = new Map<string, Dealer[]>();
  data.dealerModels.forEach(link => {
    const dealer = dealersById.get(link.dealer_id);
    if (!dealer) {
      return;
    }
    const current = linksByModelId.get(link.model_id) ?? [];
    current.push(dealer);
    linksByModelId.set(link.model_id, current);
  });

  return data.models.map<PageDefinition>(model => {
    const dealers = (linksByModelId.get(model.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    const canonicalPath = `/models/${model.id}/`;
    const description = truncate(
      `${model.brand} ${model.model_name} ofron ${model.range_wltp ?? '—'} km autonomi WLTP dhe bateri ${
        model.battery_capacity ?? '—'
      } kWh.`,
      170,
    );

    const structuredData: StructuredData = {
      '@context': 'https://schema.org',
      '@type': 'Vehicle',
      name: `${model.brand} ${model.model_name}`,
      brand: model.brand,
      model: model.model_name,
      url: `${SITE_URL}${canonicalPath}`,
      description,
      fuelType: 'Electric',
      bodyType: model.body_type,
      seatingCapacity: model.seats ?? undefined,
    };

    const sections = [
      renderSection(
        'Specifikime kryesore',
        `<div class="pr-facts">
          <div class="pr-fact"><strong>${escapeHtml(sq.modelDetails.battery)}</strong>${escapeHtml(
            model.battery_capacity ? `${model.battery_capacity} kWh` : '—',
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(sq.modelDetails.range)}</strong>${escapeHtml(
            model.range_wltp ? `${model.range_wltp} km` : '—',
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(sq.modelDetails.power)}</strong>${escapeHtml(
            model.power_kw ? `${model.power_kw} kW` : '—',
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(sq.modelDetails.acceleration)}</strong>${escapeHtml(
            model.acceleration_0_100 ? `${model.acceleration_0_100} s` : '—',
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(sq.modelDetails.chargingAC)}</strong>${escapeHtml(
            model.charging_ac || '—',
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(sq.modelDetails.chargingDC)}</strong>${escapeHtml(
            model.charging_dc || '—',
          )}</div>
        </div>`,
      ),
      model.notes
        ? renderSection('Përshkrim', `<p>${escapeHtml(model.notes)}</p>`)
        : '',
      renderSection(
        'Dilerë ku gjendet',
        dealers.length
          ? `<ul class="pr-list">
              ${dealers
                .map(
                  dealer => `
                    <li>
                      <a class="pr-link" href="/dealers/${encodeURIComponent(dealer.id)}/">${escapeHtml(dealer.name)}</a>
                      <span class="pr-muted">(${escapeHtml(dealer.city)})</span>
                    </li>
                  `,
                )
                .join('')}
            </ul>`
          : '<p>Informacioni mbi disponueshmërinë po përditësohet.</p>',
      ),
    ].filter(Boolean);

    return {
      outputRoute: canonicalPath,
      canonicalPath,
      lang: 'sq',
      title: `${model.brand} ${model.model_name} | ${sq.modelDetails.metaTitleSuffix}`,
      description,
      keywords: [model.brand, model.model_name, `${model.brand} ${model.model_name}`],
      structuredData,
      bodyHtml: renderStandardLayout({
        lang: 'sq',
        title: `${model.brand} ${model.model_name}`,
        description,
        label: sq.header.models,
        breadcrumbs: [
          { href: '/', label: sq.header.home },
          { href: '/models/', label: sq.header.models },
          { label: `${model.brand} ${model.model_name}` },
        ],
        actions: [
          { href: '/models/', label: sq.modelDetails.backLink },
          dealers[0] ? { href: `/dealers/${encodeURIComponent(dealers[0].id)}/`, label: sq.modelDetails.contactDealer, ghost: true } : { href: '/dealers/', label: sq.header.dealers, ghost: true },
        ],
        stats: [
          { value: model.battery_capacity ? `${model.battery_capacity} kWh` : '—', label: sq.modelDetails.battery },
          { value: model.range_wltp ? `${model.range_wltp} km` : '—', label: sq.modelDetails.range },
          { value: formatNumber(dealers.length, 'sq-AL'), label: sq.modelDetails.availableAt },
        ],
        sections,
      }),
    };
  });
};

const renderListingDetailPages = (data: PublicSiteData, dealersById: Map<string, Dealer>) =>
  data.listings.map<PageDefinition>(listing => {
    const dealer = dealersById.get(listing.dealerId);
    const canonicalPath = `/listings/${listing.id}/`;
    const description = truncate(
      listing.description || `${listing.year} ${listing.make} ${listing.model} listed on Makina Elektrike.`,
      170,
    );

    const structuredData: StructuredData = {
      '@context': 'https://schema.org',
      '@type': 'Vehicle',
      name: `${listing.make} ${listing.model}`,
      brand: listing.make,
      model: listing.model,
      productionDate: String(listing.year),
      fuelType: listing.fuelType,
      url: `${SITE_URL}${canonicalPath}`,
      offers: {
        '@type': 'Offer',
        price: listing.price,
        priceCurrency: listing.priceCurrency,
        availability: 'https://schema.org/InStock',
      },
    };

    const sections = [
      renderSection(
        'Vehicle details',
        `<div class="pr-facts">
          <div class="pr-fact"><strong>Price</strong>${escapeHtml(
            formatCurrency(listing.price, listing.priceCurrency, 'en-GB'),
          )}</div>
          <div class="pr-fact"><strong>Year</strong>${escapeHtml(String(listing.year))}</div>
          <div class="pr-fact"><strong>Mileage</strong>${escapeHtml(`${formatNumber(listing.mileage, 'en-GB')} km`)}</div>
          <div class="pr-fact"><strong>Fuel Type</strong>${escapeHtml(listing.fuelType)}</div>
          ${
            listing.batteryCapacity
              ? `<div class="pr-fact"><strong>Battery</strong>${escapeHtml(`${listing.batteryCapacity} kWh`)}</div>`
              : ''
          }
          ${
            listing.range
              ? `<div class="pr-fact"><strong>Range</strong>${escapeHtml(`${listing.range} km`)}</div>`
              : ''
          }
        </div>`,
      ),
      listing.description ? renderSection('Description', `<p>${escapeHtml(listing.description)}</p>`) : '',
      dealer
        ? renderSection(
            'Dealer',
            `<p><a class="pr-link" href="/dealers/${encodeURIComponent(dealer.id)}/">${escapeHtml(dealer.name)}</a></p>
             <p class="pr-muted">${escapeHtml(dealer.city)}</p>`,
          )
        : '',
    ].filter(Boolean);

    return {
      outputRoute: canonicalPath,
      canonicalPath,
      lang: 'en',
      title: `${listing.make} ${listing.model} (${listing.year}) | Makina Elektrike`,
      description,
      keywords: [listing.make, listing.model, String(listing.year), 'electric car listing'],
      structuredData,
      bodyHtml: renderStandardLayout({
        lang: 'en',
        title: `${listing.make} ${listing.model}`,
        description,
        label: 'Listing',
        breadcrumbs: [
          { href: '/', label: 'Home' },
          { href: '/listings/', label: 'Listings' },
          { label: `${listing.make} ${listing.model}` },
        ],
        actions: [
          { href: '/listings/', label: 'Back to listings' },
          dealer ? { href: `/dealers/${encodeURIComponent(dealer.id)}/`, label: 'View dealer', ghost: true } : { href: '/dealers/', label: 'Browse dealers', ghost: true },
        ],
        stats: [
          { value: formatCurrency(listing.price, listing.priceCurrency, 'en-GB'), label: 'Price' },
          { value: String(listing.year), label: 'Year' },
          { value: `${formatNumber(listing.mileage, 'en-GB')} km`, label: 'Mileage' },
        ],
        sections,
      }),
    };
  });

const renderBlogPostPages = (posts: BlogPost[]) =>
  posts.map<PageDefinition>(post => {
    const canonicalPath = `/blog/${post.slug}`;
    const faqEntities =
      post.faqs?.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })) ?? [];

    const structuredData: StructuredData = [
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
          url: SITE_URL,
        },
        mainEntityOfPage: `${SITE_URL}${canonicalPath}`,
        keywords: post.tags.join(', '),
      },
      ...(faqEntities.length
        ? [
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqEntities,
            },
          ]
        : []),
    ];

    const sections = post.sections.map(section =>
      renderSection(
        section.heading,
        `
          ${section.paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}
          ${
            section.highlight
              ? `<div class="pr-card" style="margin-top:14px;"><p>${escapeHtml(section.highlight)}</p></div>`
              : ''
          }
          ${
            section.list
              ? section.list.ordered
                ? `<ol class="pr-numbered">${section.list.items
                    .map(item => `<li>${escapeHtml(item)}</li>`)
                    .join('')}</ol>`
                : `<ul class="pr-list">${section.list.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
              : ''
          }
        `,
      ),
    );

    if (post.faqs?.length) {
      sections.push(renderFaqSection('Pyetje të shpeshta', post.faqs));
    }

    if (post.cta) {
      sections.push(
        renderSection(
          'Vazhdo eksplorimin',
          `<p><a class="pr-link" href="${post.cta.url}">${escapeHtml(post.cta.text)}</a></p>`,
        ),
      );
    }

    return {
      outputRoute: canonicalPath,
      canonicalPath,
      lang: 'sq',
      title: post.metaTitle,
      description: post.metaDescription,
      keywords: post.tags,
      image: post.imageUrl,
      ogType: 'article',
      structuredData,
      bodyHtml: renderStandardLayout({
        lang: 'sq',
        title: post.title,
        description: post.excerpt,
        label: sq.header.blog,
        breadcrumbs: [
          { href: '/', label: sq.header.home },
          { href: '/blog/', label: sq.header.blog },
          { label: post.title },
        ],
        actions: [
          { href: '/blog/', label: 'Kthehu te blogu' },
          post.cta ? { href: post.cta.url, label: post.cta.text, ghost: true } : { href: '/models/', label: sq.header.models, ghost: true },
        ],
        stats: [
          { value: formatDate(post.date, 'sq-AL'), label: 'Publikuar' },
          { value: post.readTime, label: 'Kohë leximi' },
          { value: post.author, label: 'Autor' },
        ],
        sections,
      }),
    };
  });

const generatePages = (data: PublicSiteData) => {
  const dealersById = mapDealersById(data.dealers);
  const modelsById = mapModelsById(data.models);

  const staticPages: PageDefinition[] = [
    renderHomePage(data),
    renderDealersPage(data),
    renderModelsPage(data),
    renderListingsPage(data, dealersById),
    renderBlogPage(data),
    renderHelpCenterPage(),
    renderAboutPage(),
    renderContactPage(),
    renderRegisterUserPage(),
    renderRegisterDealerPage(),
    renderChargingStationsPage(),
    renderSitemapPage(data),
    renderLegalPage({
      outputRoute: '/privacy-policy/',
      canonicalPath: '/privacy-policy/',
      title: sq.legal.privacy.metaTitle,
      description: sq.legal.privacy.metaDescription,
      keywords: sq.legal.privacy.metaKeywords,
      updated: sq.legal.privacy.updated,
      intro: sq.legal.privacy.intro,
      sections: sq.legal.privacy.sections,
    }),
    renderLegalPage({
      outputRoute: '/terms/',
      canonicalPath: '/terms/',
      title: sq.legal.terms.metaTitle,
      description: sq.legal.terms.metaDescription,
      keywords: sq.legal.terms.metaKeywords,
      updated: sq.legal.terms.updated,
      intro: sq.legal.terms.intro,
      sections: sq.legal.terms.sections,
    }),
    renderLegalPage({
      outputRoute: '/cookie-policy/',
      canonicalPath: '/cookie-policy/',
      title: sq.legal.cookies.metaTitle,
      description: sq.legal.cookies.metaDescription,
      keywords: sq.legal.cookies.metaKeywords,
      updated: sq.legal.cookies.updated,
      intro: sq.legal.cookies.intro,
      sections: sq.legal.cookies.sections,
    }),
  ];

  const dynamicPages = [
    ...renderDealerDetailPages(data, dealersById, modelsById),
    ...renderModelDetailPages(data, dealersById),
    ...renderListingDetailPages(data, dealersById),
    ...renderBlogPostPages(data.blogPosts),
  ];

  return [...staticPages, ...dynamicPages];
};

const main = async () => {
  const data = await loadPublicSiteData();
  const pages = generatePages(data);
  pages.forEach(writePage);

  console.log(
    `Prerendered ${pages.length} public HTML documents (dealers=${data.dealers.length}, models=${data.models.length}, listings=${data.listings.length}, blog=${data.blogPosts.length}).`,
  );
};

main().catch(error => {
  console.error('Failed to prerender public pages.', error);
  process.exitCode = 1;
});
