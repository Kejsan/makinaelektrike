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
import enTranslations from '../i18n/locales/en.json';
import sqTranslations from '../i18n/locales/sq.json';
import itTranslations from '../i18n/locales/it.json';
import {
  getBlogAlternateLocales,
  getBlogContentLocale,
  getBlogTranslationCoverage,
  getLocalizedBlogPost,
} from '../utils/localizedBlogPost';
import {
  type AppLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  buildAbsoluteLocalizedUrl,
  buildLocalizedPath,
  isLocalizablePath,
  stripLocalePrefix,
  toHreflang,
} from '../utils/localizedRouting';

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
  lang: AppLocale;
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  ogType?: string;
  robots?: string;
  alternateLocales?: AppLocale[];
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

type IntlLocale = (typeof localeIntlMap)[keyof typeof localeIntlMap];

const translationsByLocale: Record<AppLocale, unknown> = {
  sq: sqTranslations,
  en: enTranslations,
  it: itTranslations,
};

const localeIntlMap = {
  sq: 'sq-AL',
  en: 'en-GB',
  it: 'it-IT',
} as const satisfies Record<AppLocale, string>;

const prerenderCopy: Record<
  AppLocale,
  {
    homeStats: [string, string, string, string];
    dealerStats: [string, string, string];
    modelStats: [string, string, string];
    blogStats: [string, string];
    helpStats: [string, string];
    charging: {
      label: string;
      title: string;
      description: string;
      keywords: string[];
      howToUseTitle: string;
      howToUseSteps: string[];
      coverageTitle: string;
      coverageParagraphs: string[];
      faqTitle: string;
      faqItems: Array<{ question: string; answer: string }>;
      primaryCta: string;
      secondaryCta: string;
    };
  }
> = {
  sq: {
    homeStats: ['Modele publike', 'Dilerë të aprovuar', 'Listime aktive', 'Artikuj informues'],
    dealerStats: ['Dilerë aktivë', 'Qytete të mbuluara', 'Marka të përfaqësuara'],
    modelStats: ['Modele të kataloguara', 'Marka', 'Karroceri'],
    blogStats: ['Artikuj', 'Artikulli më i ri'],
    helpStats: ['Tema kryesore', 'Përgjigje të strukturuara'],
    charging: {
      label: 'Harta e karikimit',
      title: 'Stacionet e karikimit në Shqipëri',
      description:
        'Përdorni hartën e karikimit për të kërkuar stacione në Shqipëri, për të shqyrtuar detajet dhe për të planifikuar itinerare me ndalesa publike.',
      keywords: [
        'harta e karikimit Shqipëri',
        'stacione karikimi EV Shqipëri',
        'Open Charge Map Shqipëri',
        'Makina Elektrike karikim',
      ],
      howToUseTitle: 'Si të përdorni hartën e karikimit',
      howToUseSteps: [
        'Kërkoni sipas zonës ose lëvizni hartën drejt qytetit, korridorit ose destinacionit që ju duhet.',
        'Hapni një kartë stacioni për të parë lidhjet, fuqinë, operatorin dhe adresën.',
        'Përdorni drejtimet dhe ndarjen për të planifikuar itinerarin ose për t’ia dërguar lokacionin një drejtuesi tjetër.',
      ],
      coverageTitle: 'Ku gjenden karikuesit në Shqipëri',
      coverageParagraphs: [
        'Mbulimi po rritet në Tiranë, Durrës, Shkodër, Korçë dhe në korridoret kryesore drejt bregdetit. Udhëtimet e gjata mbështeten më fort nga karikuesit CCS2 të shpejtë.',
        'Hoteleria, retail-i dhe operatorët privatë po shtojnë pika AC dhe DC, duke e bërë këtë faqe një burim të dobishëm për planifikimin e përdorimit të EV-ve në Shqipëri.',
      ],
      faqTitle: 'Pyetje të shpeshta',
      faqItems: [
        {
          question: 'Sa të sakta janë të dhënat në këtë hartë?',
          answer: 'Lokacionet dhe statuset bazohen në të dhëna publike të Open Charge Map dhe duhen verifikuar para një udhëtimi kritik.',
        },
        {
          question: 'Cilat lidhje janë më të zakonshme në Shqipëri?',
          answer: 'Type 2 për AC dhe CCS2 për karikim të shpejtë DC janë formatet më të përhapura në rrjetin publik shqiptar.',
        },
        {
          question: 'A mund ta përdor hartën pa llogari?',
          answer: 'Po. Harta është publike dhe mund të përdoret pa hyrë në llogari.',
        },
      ],
      primaryCta: 'Qendra e ndihmës për EV',
      secondaryCta: 'Kontakt',
    },
  },
  en: {
    homeStats: ['Public models', 'Approved dealers', 'Active listings', 'Editorial guides'],
    dealerStats: ['Active dealers', 'Cities covered', 'Brands represented'],
    modelStats: ['Catalogued models', 'Brands', 'Body styles'],
    blogStats: ['Articles', 'Latest article'],
    helpStats: ['Main topics', 'Structured answers'],
    charging: {
      label: 'Charging map',
      title: 'Charging Stations in Albania',
      description:
        'Use the EV charging map to search station locations across Albania, review charging details, and plan routes with public charging stops.',
      keywords: [
        'Albania EV charging map',
        'EV charging stations Albania',
        'Open Charge Map Albania',
        'Makina Elektrike charging',
      ],
      howToUseTitle: 'How to use the charging map',
      howToUseSteps: [
        'Search by area or move the map to focus on the city, corridor, or destination you need.',
        'Open any station card to review connector type, power level, operator information, and address details.',
        'Use directions and sharing actions to plan routes or send charger links to another driver.',
      ],
      coverageTitle: 'Where chargers are available in Albania',
      coverageParagraphs: [
        'Coverage continues to expand across Tirana, Durres, Shkoder, Korce, and the southern coast. Long-distance corridors are strongest where rapid CCS2 charging is available.',
        'Hotels, retail destinations, and private operators continue to add AC and DC infrastructure, making this page a useful informational landing page for EV planning in Albania.',
      ],
      faqTitle: 'Frequently Asked Questions',
      faqItems: [
        {
          question: 'How accurate is the data on this map?',
          answer: 'Station location and status are based on public Open Charge Map data and should be verified before a critical trip.',
        },
        {
          question: 'Which connector types are common in Albania?',
          answer: 'Type 2 AC connectors and CCS2 DC fast chargers are the most common formats on Albania’s public network.',
        },
        {
          question: 'Can I use the charging map without an account?',
          answer: 'Yes. The charging map is public and can be used without signing in.',
        },
      ],
      primaryCta: 'EV help topics',
      secondaryCta: 'Contact',
    },
  },
  it: {
    homeStats: ['Modelli pubblici', 'Concessionari approvati', 'Annunci attivi', 'Guide editoriali'],
    dealerStats: ['Concessionari attivi', 'Città coperte', 'Marchi rappresentati'],
    modelStats: ['Modelli a catalogo', 'Marchi', 'Carrozzerie'],
    blogStats: ['Articoli', 'Articolo più recente'],
    helpStats: ['Argomenti principali', 'Risposte strutturate'],
    charging: {
      label: 'Mappa di ricarica',
      title: 'Stazioni di ricarica in Albania',
      description:
        'Usa la mappa EV per cercare stazioni in Albania, controllare i dettagli di ricarica e pianificare itinerari con soste pubbliche.',
      keywords: [
        'mappa ricarica EV Albania',
        'stazioni di ricarica Albania',
        'Open Charge Map Albania',
        'Makina Elektrike ricarica',
      ],
      howToUseTitle: 'Come usare la mappa di ricarica',
      howToUseSteps: [
        'Cerca per zona oppure sposta la mappa verso la città, il corridoio o la destinazione che ti interessa.',
        'Apri una scheda stazione per vedere connettori, potenza, operatore e indirizzo.',
        'Usa indicazioni e condivisione per pianificare il viaggio o inviare il link a un altro conducente.',
      ],
      coverageTitle: 'Dove trovare la ricarica in Albania',
      coverageParagraphs: [
        'La copertura continua a crescere tra Tirana, Durazzo, Scutari, Coriza e la costa meridionale. I corridoi principali hanno la presenza più forte di ricarica rapida CCS2.',
        'Hotel, retail e operatori privati stanno aggiungendo nuove infrastrutture AC e DC, rendendo questa pagina una base informativa utile per chi pianifica l’uso di un EV in Albania.',
      ],
      faqTitle: 'Domande frequenti',
      faqItems: [
        {
          question: 'Quanto sono affidabili i dati della mappa?',
          answer: 'Posizioni e stato delle stazioni si basano sui dati pubblici di Open Charge Map e vanno verificati prima di un viaggio importante.',
        },
        {
          question: 'Quali connettori sono più comuni in Albania?',
          answer: 'Type 2 per AC e CCS2 per la ricarica rapida DC sono i formati più diffusi sulla rete pubblica albanese.',
        },
        {
          question: 'Posso usare la mappa senza account?',
          answer: 'Sì. La mappa è pubblica e può essere utilizzata senza effettuare l’accesso.',
        },
      ],
      primaryCta: 'Supporto EV',
      secondaryCta: 'Contatti',
    },
  },
};

const prerenderDetailCopy: Record<
  AppLocale,
  {
    common: {
      updated: string;
      city: string;
      published: string;
      readTime: string;
      author: string;
      continueExploring: string;
    };
    dealer: {
      profile: string;
      brandsAndLanguages: string;
      linkedModels: string;
    };
    model: {
      description: string;
    };
    listing: {
      backToListings: string;
      viewDealer: string;
      browseDealers: string;
      price: string;
    };
  }
> = {
  sq: {
    common: {
      updated: 'Përditësuar',
      city: 'Qyteti',
      published: 'Publikuar',
      readTime: 'Kohë leximi',
      author: 'Autor',
      continueExploring: 'Vazhdo eksplorimin',
    },
    dealer: {
      profile: 'Profili i dilerit',
      brandsAndLanguages: 'Markat dhe gjuhët',
      linkedModels: 'Modele të lidhura',
    },
    model: {
      description: 'Përshkrim',
    },
    listing: {
      backToListings: 'Kthehu te listimet',
      viewDealer: 'Shiko dilerin',
      browseDealers: 'Shfleto dilerët',
      price: 'Çmimi',
    },
  },
  en: {
    common: {
      updated: 'Updated',
      city: 'City',
      published: 'Published',
      readTime: 'Read time',
      author: 'Author',
      continueExploring: 'Continue exploring',
    },
    dealer: {
      profile: 'Dealer profile',
      brandsAndLanguages: 'Brands and languages',
      linkedModels: 'Linked models',
    },
    model: {
      description: 'Description',
    },
    listing: {
      backToListings: 'Back to listings',
      viewDealer: 'View dealer',
      browseDealers: 'Browse dealers',
      price: 'Price',
    },
  },
  it: {
    common: {
      updated: 'Aggiornato',
      city: 'Città',
      published: 'Pubblicato',
      readTime: 'Tempo di lettura',
      author: 'Autore',
      continueExploring: 'Continua a esplorare',
    },
    dealer: {
      profile: 'Profilo del concessionario',
      brandsAndLanguages: 'Marchi e lingue',
      linkedModels: 'Modelli collegati',
    },
    model: {
      description: 'Descrizione',
    },
    listing: {
      backToListings: 'Torna agli annunci',
      viewDealer: 'Apri concessionario',
      browseDealers: 'Sfoglia concessionari',
      price: 'Prezzo',
    },
  },
};

const interpolateLabel = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ''));

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

const getMessages = (lang: AppLocale) => translationsByLocale[lang] as any;

const getIntlLocale = (lang: AppLocale) => localeIntlMap[lang];

const localizeHtmlPaths = (html: string, locale: AppLocale) =>
  html.replace(/href="([^"]+)"/g, (match, href: string) => {
    if (!isLocalizablePath(href)) {
      return match;
    }

    return `href="${escapeHtml(buildLocalizedPath(href, locale))}"`;
  });

const localizeStringValue = (value: string, locale: AppLocale) => {
  if (value.startsWith(SITE_URL)) {
    try {
      const parsed = new URL(value);
      if (parsed.origin === SITE_URL) {
        return buildAbsoluteLocalizedUrl(
          SITE_URL,
          `${parsed.pathname}${parsed.search}${parsed.hash}`,
          locale,
        );
      }
    } catch {
      return value;
    }
  }

  if (!value.startsWith('/')) {
    return value;
  }

  if (isLocalizablePath(value)) {
    return buildLocalizedPath(value, locale);
  }

  return value;
};

const localizeStructuredData = (
  value: StructuredData | Record<string, unknown> | unknown,
  locale: AppLocale,
): StructuredData | Record<string, unknown> | unknown => {
  if (typeof value === 'string') {
    return localizeStringValue(value, locale);
  }

  if (Array.isArray(value)) {
    return value.map(entry => localizeStructuredData(entry, locale));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        localizeStructuredData(entryValue, locale),
      ]),
    );
  }

  return value;
};

const finalizePage = (page: PageDefinition): PageDefinition => {
  const baseCanonicalPath = stripLocalePrefix(page.canonicalPath).pathname;
  const localizedCanonicalPath = buildLocalizedPath(baseCanonicalPath, page.lang);
  const localizedOutputRoute =
    page.lang === DEFAULT_LOCALE && baseCanonicalPath === '/'
      ? '/__prerendered/home/'
      : localizedCanonicalPath;

  return {
    ...page,
    canonicalPath: localizedCanonicalPath,
    outputRoute: localizedOutputRoute,
    bodyHtml: localizeHtmlPaths(page.bodyHtml, page.lang),
    structuredData: page.structuredData
      ? (localizeStructuredData(page.structuredData, page.lang) as StructuredData)
      : undefined,
  };
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

const formatDate = (value: FirestoreTimestampLike, locale: IntlLocale) => {
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

const formatNumber = (value: number | undefined, locale: IntlLocale) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }

  return new Intl.NumberFormat(locale).format(value);
};

const formatCurrency = (value: number | undefined, currency: string | undefined, locale: IntlLocale) => {
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

const renderTopbar = (lang: AppLocale) => {
  const messages = getMessages(lang);
  const navigation = [
    { href: '/', label: messages.header.home },
    { href: '/dealers/', label: messages.header.dealers },
    { href: '/models/', label: messages.header.models },
    { href: '/listings/', label: messages.header.listings },
    { href: '/blog/', label: messages.header.blog },
    { href: '/help-center/', label: messages.header.helpCenter },
    { href: '/contact/', label: messages.footer.contact },
  ];

  return `
    <header class="pr-topbar">
      <a class="pr-brand" href="/">
        <span class="pr-brand-dot" aria-hidden="true"></span>
        <span>Makina Elektrike</span>
      </a>
      <nav class="pr-nav" aria-label="${escapeHtml(messages.header.home)}">
        ${navigation
          .map(item => `<a href="${item.href}">${escapeHtml(item.label)}</a>`)
          .join('')}
      </nav>
    </header>
  `;
};

const renderFooter = (lang: AppLocale) => {
  const messages = getMessages(lang);
  const footerSections = [
    {
      title: messages.footer.explore,
      links: [
        { href: '/dealers/', label: messages.header.dealers },
        { href: '/models/', label: messages.header.models },
        { href: '/listings/', label: messages.header.listings },
        { href: '/blog/', label: messages.header.blog },
      ],
    },
    {
      title: messages.header.helpCenter,
      links: [
        { href: '/help-center/', label: messages.header.helpCenter },
        { href: '/contact/', label: messages.footer.contact },
        { href: '/sitemap/', label: messages.footer.sitemap },
        { href: '/llms.txt', label: 'llms.txt' },
      ],
    },
    {
      title: messages.footer.legal,
      links: [
        { href: '/privacy-policy/', label: messages.footer.privacy },
        { href: '/terms/', label: messages.footer.terms },
        { href: '/cookie-policy/', label: messages.footer.cookies },
      ],
    },
  ];

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
      <p class="pr-muted" style="margin-top:16px;">${escapeHtml(messages.footer.legalBody)}</p>
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
  lang: AppLocale;
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

const getOpenGraphLocale = (lang: AppLocale) => {
  switch (lang) {
    case 'en':
      return 'en_US';
    case 'it':
      return 'it_IT';
    case 'sq':
    default:
      return 'sq_AL';
  }
};

const buildAlternateHeadTags = (
  canonicalPath: string,
  robots: string,
  alternateLocales: AppLocale[] = [...SUPPORTED_LOCALES],
) => {
  if (robots.toLowerCase().includes('noindex')) {
    return '';
  }

  return [
    ...alternateLocales.map(
      locale =>
        `<link rel="alternate" hreflang="${toHreflang(locale)}" href="${escapeHtml(
          buildAbsoluteLocalizedUrl(SITE_URL, canonicalPath, locale),
        )}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(
      buildAbsoluteLocalizedUrl(SITE_URL, canonicalPath, DEFAULT_LOCALE),
    )}" />`,
  ].join('\n    ');
};

const buildDocument = (page: PageDefinition) => {
  const canonicalUrl = toAbsoluteUrl(page.canonicalPath);
  const ogImage = toAbsoluteUrl(page.image || DEFAULT_OG_IMAGE_PATH);
  const robots = page.robots ?? 'index, follow';
  const keywordsTag =
    page.keywords && page.keywords.length
      ? `<meta name="keywords" content="${escapeHtml(page.keywords.join(', '))}" />`
      : '';
  const alternateLinksTag = buildAlternateHeadTags(page.canonicalPath, robots, page.alternateLocales);
  const structuredDataTag = page.structuredData
    ? `<script type="application/ld+json">${encodeJson(page.structuredData)}</script>`
    : '';
  const headExtras = `
    <meta name="description" content="${escapeHtml(page.description)}" />
    ${keywordsTag}
    <meta name="robots" content="${escapeHtml(robots)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    ${alternateLinksTag}
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="${escapeHtml(page.ogType || 'website')}" />
    <meta property="og:site_name" content="Makina Elektrike" />
    <meta property="og:locale" content="${getOpenGraphLocale(page.lang)}" />
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
    .replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${page.bodyHtml}</div>`)
    .replace(/<noscript>[\s\S]*?<\/noscript>/i, match => localizeHtmlPaths(match, page.lang));
};

const writePage = (page: PageDefinition) => {
  const outputPath = outputPathForRoute(page.outputRoute);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buildDocument(page), 'utf8');
};

const mapDealersById = (dealers: Dealer[]) => new Map(dealers.map(dealer => [dealer.id, dealer]));
const mapModelsById = (models: Model[]) => new Map(models.map(model => [model.id, model]));

const renderHomePage = (data: PublicSiteData, lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const intlLocale = getIntlLocale(lang);
  const featuredModels = data.models.filter(model => model.isFeatured).slice(0, 8);
  const featuredDealers = data.dealers.filter(dealer => dealer.isFeatured).slice(0, 6);
  const localizedBlogPosts = data.blogPosts.map(post => getLocalizedBlogPost(post, lang));
  const recentPosts = localizedBlogPosts.slice(0, 4);
  const getPostHref = (post: BlogPost) => {
    const blogPath = `/blog/${encodeURIComponent(post.slug)}`;
    return getBlogContentLocale(post, lang) === lang || lang === DEFAULT_LOCALE
      ? blogPath
      : `${SITE_URL}${blogPath}`;
  };
  const valueHighlights = (messages.home.valueHighlights ?? []) as Array<{ title: string; description: string }>;
  const faqItems = (messages.home.faqItems ?? []).slice(0, 6) as Array<{ question: string; answer: string }>;

  const sections = [
    renderSection(
      messages.home.valueTitle,
      `<p>${escapeHtml(messages.home.valueSubtitle)}</p>
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
      messages.home.featuredModels,
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
                  <div class="pr-fact"><strong>${messages.modelDetails?.battery ?? 'Battery'}</strong>${escapeHtml(
                    model.battery_capacity ? `${model.battery_capacity} kWh` : '—',
                  )}</div>
                  <div class="pr-fact"><strong>${messages.modelDetails?.range ?? 'Range'}</strong>${escapeHtml(
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
      messages.home.featuredDealers,
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
      messages.home.fromOurBlog,
      `<div class="pr-list-grid">
        ${recentPosts
          .map(
            post => `
              <article class="pr-card">
                <h3><a class="pr-link" href="${escapeHtml(getPostHref(post))}">${escapeHtml(post.title)}</a></h3>
                <p class="pr-muted" style="margin-top:8px;">${escapeHtml(formatDate(post.date, intlLocale))}</p>
                <p style="margin-top:10px;">${escapeHtml(post.excerpt)}</p>
              </article>
            `,
          )
          .join('')}
      </div>`,
    ),
    renderFaqSection(messages.home.faqTitle, faqItems),
  ];

  const structuredData: StructuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Makina Elektrike',
      url: SITE_URL,
      description: messages.home.metaDescription,
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
      description: messages.home.metaDescription,
    },
  ];

  return {
    outputRoute: '/',
    canonicalPath: '/',
    lang,
    title: messages.home.metaTitle,
    description: messages.home.metaDescription,
    keywords: (messages.home.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang,
      title: messages.home.heroTitle,
      description: messages.home.heroSubtitle,
      label: 'Makina Elektrike',
      breadcrumbs: [{ label: messages.header.home }],
      actions: [
        { href: '/models/', label: messages.home.heroPrimaryCta },
        { href: '/dealers/', label: messages.home.heroSecondaryCta, ghost: true },
        { href: '/help-center/', label: messages.header.helpCenter, ghost: true },
      ],
      stats: [
        { value: formatNumber(data.models.length, intlLocale), label: prerenderCopy[lang].homeStats[0] },
        { value: formatNumber(data.dealers.length, intlLocale), label: prerenderCopy[lang].homeStats[1] },
        { value: formatNumber(data.listings.length, intlLocale), label: prerenderCopy[lang].homeStats[2] },
        { value: formatNumber(localizedBlogPosts.length, intlLocale), label: prerenderCopy[lang].homeStats[3] },
      ],
      sections,
    }),
  };
};

const renderDealersPage = (data: PublicSiteData, lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const intlLocale = getIntlLocale(lang);
  const faqItems = (messages.dealersPage.faqItems ?? []).slice(0, 6) as Array<{ question: string; answer: string }>;
  const allBrands = Array.from(new Set(data.dealers.flatMap(dealer => dealer.brands || []))).sort();
  const allCities = Array.from(new Set(data.dealers.map(dealer => dealer.city))).sort();
  const insights = (messages.dealersPage.insights ?? []) as Array<{ title: string; description: string }>;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: messages.dealersPage.metaTitle,
    description: messages.dealersPage.metaDescription,
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
      messages.dealersPage.introTitle,
      `<p>${escapeHtml(messages.dealersPage.introSubtitle)}</p>
       <div class="pr-chip-list">
         ${allCities.slice(0, 12).map(city => `<span class="pr-pill">${escapeHtml(city)}</span>`).join('')}
       </div>`,
    ),
    renderSection(
      messages.dealersPage.insightsTitle,
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
      messages.dealersPage.title,
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
    renderFaqSection(messages.dealersPage.faqTitle, faqItems),
  ];

  return {
    outputRoute: '/dealers/',
    canonicalPath: '/dealers/',
    lang,
    title: messages.dealersPage.metaTitle,
    description: messages.dealersPage.metaDescription,
    keywords: (messages.dealersPage.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang,
      title: messages.dealersPage.title,
      description: messages.dealersPage.subtitle,
      label: messages.header.dealers,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: messages.header.dealers }],
      actions: [
        { href: '/models/', label: messages.header.models },
        { href: '/contact/', label: messages.footer.contact, ghost: true },
      ],
      stats: [
        { value: formatNumber(data.dealers.length, intlLocale), label: prerenderCopy[lang].dealerStats[0] },
        { value: formatNumber(allCities.length, intlLocale), label: prerenderCopy[lang].dealerStats[1] },
        { value: formatNumber(allBrands.length, intlLocale), label: prerenderCopy[lang].dealerStats[2] },
      ],
      sections,
    }),
  };
};

const renderModelsPage = (data: PublicSiteData, lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const intlLocale = getIntlLocale(lang);
  const faqItems = (messages.modelsPage.faqItems ?? []).slice(0, 6) as Array<{ question: string; answer: string }>;
  const insights = (messages.modelsPage.insights ?? []) as Array<{ title: string; description: string }>;
  const brands = Array.from(new Set(data.models.map(model => model.brand))).sort((a, b) => a.localeCompare(b));
  const bodyTypes = Array.from(new Set(data.models.map(model => model.body_type).filter(Boolean))).sort() as string[];
  const groupedModels = brands.map(brand => ({
    brand,
    models: data.models.filter(model => model.brand === brand),
  }));

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: messages.modelsPage.metaTitle,
    description: messages.modelsPage.metaDescription,
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
      messages.modelsPage.introTitle,
      `<p>${escapeHtml(messages.modelsPage.introSubtitle)}</p>
       <div class="pr-chip-list">
         ${bodyTypes.slice(0, 12).map(type => `<span class="pr-pill">${escapeHtml(type)}</span>`).join('')}
       </div>`,
    ),
    renderSection(
      messages.modelsPage.insightsTitle,
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
      messages.modelsPage.title,
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
    renderFaqSection(messages.modelsPage.faqTitle, faqItems),
  ];

  return {
    outputRoute: '/models/',
    canonicalPath: '/models/',
    lang,
    title: messages.modelsPage.metaTitle,
    description: messages.modelsPage.metaDescription,
    keywords: (messages.modelsPage.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang,
      title: messages.modelsPage.title,
      description: messages.modelsPage.subtitle,
      label: messages.header.models,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: messages.header.models }],
      actions: [
        { href: '/dealers/', label: messages.header.dealers },
        { href: '/blog/', label: messages.header.blog, ghost: true },
      ],
      stats: [
        { value: formatNumber(data.models.length, intlLocale), label: prerenderCopy[lang].modelStats[0] },
        { value: formatNumber(brands.length, intlLocale), label: prerenderCopy[lang].modelStats[1] },
        { value: formatNumber(bodyTypes.length, intlLocale), label: prerenderCopy[lang].modelStats[2] },
      ],
      sections,
    }),
  };
};

const renderListingsPage = (
  data: PublicSiteData,
  dealersById: Map<string, Dealer>,
  lang: AppLocale,
): PageDefinition => {
  const messages = getMessages(lang);
  const intlLocale = getIntlLocale(lang);
  const averagePrice =
    data.listings.length > 0
      ? Math.round(data.listings.reduce((sum, listing) => sum + listing.price, 0) / data.listings.length)
      : 0;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: messages.listings.seoTitle,
    description: messages.listings.seoDesc,
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
      messages.listings.title,
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
                      <div class="pr-fact"><strong>${escapeHtml(messages.listings.priceRange)}</strong>${escapeHtml(
                        formatCurrency(listing.price, listing.priceCurrency, intlLocale),
                      )}</div>
                      <div class="pr-fact"><strong>${escapeHtml(messages.listings.fields.mileage)}</strong>${escapeHtml(
                        `${formatNumber(listing.mileage, intlLocale)} km`,
                      )}</div>
                      <div class="pr-fact"><strong>${escapeHtml(messages.contactPage.address)}</strong>${escapeHtml(location || messages.listings.locationFallback)}</div>
                    </div>
                    ${
                      dealer
                        ? `<p class="pr-muted" style="margin-top:10px;">${escapeHtml(messages.listings.soldBy)} <a class="pr-link" href="/dealers/${encodeURIComponent(
                            dealer.id,
                          )}/">${escapeHtml(dealer.name)}</a></p>`
                        : ''
                    }
                  </article>
                `;
              })
              .join('')}
          </div>`
        : `<p>${escapeHtml(messages.listings.noResults)}</p>`,
    ),
  ];

  return {
    outputRoute: '/listings/',
    canonicalPath: '/listings/',
    lang,
    title: messages.listings.seoTitle,
    description: messages.listings.seoDesc,
    keywords: [messages.listings.title, messages.header.listings, 'Makina Elektrike'],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang,
      title: messages.listings.title,
      description: messages.listings.seoDesc,
      label: messages.header.listings,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: messages.header.listings }],
      actions: [
        { href: '/dealers/', label: messages.header.dealers },
        { href: '/models/', label: messages.header.models, ghost: true },
      ],
      stats: [
        { value: formatNumber(data.listings.length, intlLocale), label: messages.listings.countSuffix },
        { value: averagePrice ? formatCurrency(averagePrice, 'EUR', intlLocale) : '—', label: messages.listings.priceRange },
      ],
      sections,
    }),
  };
};

const renderBlogPage = (data: PublicSiteData, lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const intlLocale = getIntlLocale(lang);
  const localizedBlogPosts = data.blogPosts.map(post => getLocalizedBlogPost(post, lang));
  const getPostHref = (post: BlogPost) => {
    const blogPath = `/blog/${encodeURIComponent(post.slug)}`;
    return getBlogContentLocale(post, lang) === lang || lang === DEFAULT_LOCALE
      ? blogPath
      : `${SITE_URL}${blogPath}`;
  };
  const faqItems = (messages.blogPage?.faqItems ?? []) as Array<{ question: string; answer: string }>;
  const insights = (messages.blogPage?.insights ?? []) as Array<{ title: string; description: string }>;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: messages.blogPage.metaTitle,
    description: messages.blogPage.metaDescription,
    url: `${SITE_URL}/blog/`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: localizedBlogPosts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: post.title,
        url: getPostHref(post),
      })),
    },
  };

  const sections = [
    renderSection(
      messages.blogPage.introTitle,
      `<p>${escapeHtml(messages.blogPage.introSubtitle)}</p>`,
    ),
    renderSection(
      messages.blogPage.title,
      `<div class="pr-list-grid">
        ${localizedBlogPosts
          .map(
            post => `
              <article class="pr-card">
                <h3><a class="pr-link" href="${escapeHtml(getPostHref(post))}">${escapeHtml(post.title)}</a></h3>
                <p class="pr-muted" style="margin-top:8px;">${escapeHtml(formatDate(post.date, intlLocale))} • ${escapeHtml(
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
      messages.blogPage.insightsTitle,
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
    faqItems.length ? renderFaqSection(messages.blogPage.faqTitle, faqItems) : '',
  ].filter(Boolean);

  return {
    outputRoute: '/blog/',
    canonicalPath: '/blog/',
    lang,
    title: messages.blogPage.metaTitle,
    description: messages.blogPage.metaDescription,
    keywords: (messages.blogPage.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang,
      title: messages.blogPage.title,
      description: messages.blogPage.subtitle,
      label: messages.header.blog,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: messages.header.blog }],
      actions: [
        { href: '/models/', label: messages.header.models },
        { href: '/help-center/', label: messages.header.helpCenter, ghost: true },
      ],
      stats: [
        { value: formatNumber(localizedBlogPosts.length, intlLocale), label: prerenderCopy[lang].blogStats[0] },
        {
          value: localizedBlogPosts[0] ? formatDate(localizedBlogPosts[0].date, intlLocale) : '—',
          label: prerenderCopy[lang].blogStats[1],
        },
      ],
      sections,
    }),
  };
};

const renderHelpCenterPage = (lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const intlLocale = getIntlLocale(lang);
  const content = getHelpCenterContent(lang);

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
    lang,
    title: content.metaTitle,
    description: content.metaDescription,
    keywords: content.metaKeywords,
    structuredData,
    bodyHtml: renderStandardLayout({
      lang,
      title: content.title,
      description: content.subtitle,
      label: messages.header.helpCenter,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: messages.header.helpCenter }],
      actions: [
        { href: content.supportPrimaryTo, label: content.supportPrimaryLabel },
        { href: content.supportSecondaryTo, label: content.supportSecondaryLabel, ghost: true },
      ],
      stats: [
        { value: formatNumber(content.sections.length, intlLocale), label: prerenderCopy[lang].helpStats[0] },
        {
          value: formatNumber(content.sections.reduce((sum, section) => sum + section.articles.length, 0), intlLocale),
          label: prerenderCopy[lang].helpStats[1],
        },
      ],
      sections,
    }),
  };
};

const renderAboutPage = (lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const pillarsTitleByLocale: Record<AppLocale, string> = {
    sq: 'Shtyllat tona',
    en: 'Our pillars',
    it: 'I nostri principi',
  };
  const pillars = (messages.aboutPage.pillars ?? []) as Array<{ title: string; description: string }>;
  const faqItems = (messages.aboutPage.faqItems ?? []) as Array<{ question: string; answer: string }>;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: messages.aboutPage.metaTitle,
    description: messages.aboutPage.metaDescription,
    url: `${SITE_URL}/about/`,
  };

  const sections = [
    renderSection(
      messages.aboutPage.title,
      `<p>${escapeHtml(messages.aboutPage.p1)}</p>
       <p>${escapeHtml(messages.aboutPage.p2)}</p>
       <p>${escapeHtml(messages.aboutPage.p3)}</p>
       <p>${escapeHtml(messages.aboutPage.p4)}</p>`,
    ),
    renderSection(
      messages.aboutPage.transparencyTitle,
      `<p>${escapeHtml(messages.aboutPage.transparencyP1)}</p>
       <p>${escapeHtml(messages.aboutPage.transparencyP2)}</p>
       <p>${escapeHtml(messages.aboutPage.transparencyP3)}</p>`,
    ),
    renderSection(
      pillarsTitleByLocale[lang],
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
    renderFaqSection(messages.aboutPage.faqTitle, faqItems),
  ];

  return {
    outputRoute: '/about/',
    canonicalPath: '/about/',
    lang,
    title: messages.aboutPage.metaTitle,
    description: messages.aboutPage.metaDescription,
    keywords: (messages.aboutPage.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang,
      title: messages.aboutPage.title,
      description: messages.aboutPage.metaDescription,
      label: messages.header.about,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: messages.header.about }],
      actions: [{ href: '/contact/', label: messages.aboutPage.collaborationCtaButton }],
      sections,
    }),
  };
};

const renderContactPage = (lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const faqItems = (messages.contactPage.faqItems ?? []) as Array<{ question: string; answer: string }>;
  const highlights = (messages.contactPage.highlights ?? []) as Array<{ title: string; description: string }>;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: messages.contactPage.metaTitle,
    description: messages.contactPage.metaDescription,
    url: `${SITE_URL}/contact/`,
  };

  const sections = [
    renderSection(
      messages.contactPage.title,
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
      messages.footer.contact,
      `<div class="pr-meta-grid">
        <div class="pr-fact"><strong>${escapeHtml(messages.contactPage.email)}</strong><a class="pr-link" href="mailto:info@makinaelektrike.al">info@makinaelektrike.al</a></div>
        <div class="pr-fact"><strong>${escapeHtml(messages.contactPage.address)}</strong>${escapeHtml(messages.contactPage.addressDetails)}</div>
      </div>`,
    ),
    renderFaqSection(messages.contactPage.faqTitle, faqItems),
  ];

  return {
    outputRoute: '/contact/',
    canonicalPath: '/contact/',
    lang,
    title: messages.contactPage.metaTitle,
    description: messages.contactPage.metaDescription,
    keywords: (messages.contactPage.metaKeywords ?? []) as string[],
    structuredData,
    bodyHtml: renderStandardLayout({
      lang,
      title: messages.contactPage.title,
      description: messages.contactPage.p1,
      label: messages.footer.contact,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: messages.footer.contact }],
      actions: [
        { href: 'mailto:info@makinaelektrike.al', label: 'info@makinaelektrike.al' },
        { href: '/help-center/', label: messages.header.helpCenter, ghost: true },
      ],
      sections,
    }),
  };
};

const renderRegisterUserPage = (lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const content = messages.registerUserPage;
  const sections = [
    renderSection(
      content.benefitsTitle,
      `<ul class="pr-list">
        ${(content.benefits as string[]).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>`,
    ),
    renderSection(
      content.title,
      `<p>${escapeHtml(content.subtitle)}</p>`,
    ),
  ];

  return {
    outputRoute: '/register/',
    canonicalPath: '/register/',
    lang,
    robots: 'noindex, nofollow',
    title: content.metaTitle,
    description: content.metaDescription,
    keywords: content.metaKeywords as string[],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: content.metaTitle,
      description: content.metaDescription,
      url: `${SITE_URL}/register/`,
    },
    bodyHtml: renderStandardLayout({
      lang,
      title: content.title,
      description: content.subtitle,
      label: messages.header.register,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: messages.header.register }],
      actions: [
        { href: '/dealers/', label: messages.header.dealers },
        { href: '/models/', label: messages.header.models, ghost: true },
      ],
      sections,
    }),
  };
};

const renderRegisterDealerPage = (lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const content = messages.registerDealerPage;
  const sections = [
    renderSection(
      content.benefitsTitle,
      `<ul class="pr-list">
        ${(content.benefits as string[]).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>`,
    ),
    renderSection(
      content.title,
      `<p>${escapeHtml(content.subtitle)}</p>`,
    ),
  ];

  return {
    outputRoute: '/register-dealer/',
    canonicalPath: '/register-dealer/',
    lang,
    robots: 'noindex, nofollow',
    title: content.metaTitle,
    description: content.metaDescription,
    keywords: content.metaKeywords as string[],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: content.metaTitle,
      description: content.metaDescription,
      url: `${SITE_URL}/register-dealer/`,
    },
    bodyHtml: renderStandardLayout({
      lang,
      title: content.title,
      description: content.subtitle,
      label: messages.header.becomeDealer,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: messages.header.becomeDealer }],
      actions: [
        { href: '/contact/', label: messages.footer.contact },
        { href: '/help-center/', label: messages.header.helpCenter, ghost: true },
      ],
      sections,
    }),
  };
};

const renderChargingStationsPage = (lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const content = prerenderCopy[lang].charging;

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqItems.map(item => ({
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
      content.howToUseTitle,
      `<ol class="pr-numbered">
        ${content.howToUseSteps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
      </ol>`,
    ),
    renderSection(
      content.coverageTitle,
      content.coverageParagraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join(''),
    ),
    renderFaqSection(content.faqTitle, content.faqItems),
  ];

  return {
    outputRoute: '/albania-charging-stations/',
    canonicalPath: '/albania-charging-stations/',
    lang,
    title: `${content.title} | Makina Elektrike`,
    description: content.description,
    keywords: content.keywords,
    structuredData,
    bodyHtml: renderStandardLayout({
      lang,
      title: content.title,
      description: content.description,
      label: content.label,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: content.title }],
      actions: [
        { href: '/help-center/', label: content.primaryCta },
        { href: '/contact/', label: content.secondaryCta, ghost: true },
      ],
      sections,
    }),
  };
};

const renderSitemapPage = (data: PublicSiteData, lang: AppLocale): PageDefinition => {
  const messages = getMessages(lang);
  const localizedBlogPosts = data.blogPosts.map(post => getLocalizedBlogPost(post, lang));
  const getPostHref = (post: BlogPost) => {
    const blogPath = `/blog/${encodeURIComponent(post.slug)}`;
    return getBlogContentLocale(post, lang) === lang || lang === DEFAULT_LOCALE
      ? blogPath
      : `${SITE_URL}${blogPath}`;
  };
  const navigationSections = [
    {
      title: messages.sitemap.sections.explore.title,
      items: [
        { href: '/', label: messages.header.home },
        { href: '/dealers/', label: messages.header.dealers },
        { href: '/models/', label: messages.header.models },
        { href: '/albania-charging-stations/', label: messages.header.chargingStations },
        { href: '/blog/', label: messages.header.blog },
      ],
    },
    {
      title: messages.sitemap.sections.services.title,
      items: [
        { href: '/register/', label: messages.footer.userSignup },
        { href: '/register-dealer/', label: messages.footer.dealerSignup },
        { href: '/help-center/', label: messages.header.helpCenter },
      ],
    },
    {
      title: messages.sitemap.sections.company.title,
      items: [
        { href: '/about/', label: messages.header.about },
        { href: '/contact/', label: messages.footer.contact },
        { href: '/sitemap/', label: messages.footer.sitemap },
      ],
    },
    {
      title: messages.sitemap.sections.legal.title,
      items: [
        { href: '/privacy-policy/', label: messages.footer.privacy },
        { href: '/terms/', label: messages.footer.terms },
        { href: '/cookie-policy/', label: messages.footer.cookies },
      ],
    },
  ];

  const sections = [
    renderSection(
      messages.sitemap.sections.explore.title,
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
      messages.sitemap.dynamic.models,
      `<p>${escapeHtml(messages.sitemap.dynamic.modelsDescription)}</p>
       <ul class="pr-list">
        ${data.models
          .slice(0, 18)
          .map(model => `<li><a class="pr-link" href="/models/${encodeURIComponent(model.id)}/">${escapeHtml(model.brand)} ${escapeHtml(model.model_name)}</a></li>`)
          .join('')}
      </ul>
      <p style="margin-top:14px;"><a class="pr-link" href="/models/">${escapeHtml(messages.sitemap.dynamic.viewAllModels)}</a></p>`,
    ),
    renderSection(
      messages.sitemap.dynamic.dealers,
      `<p>${escapeHtml(messages.sitemap.dynamic.dealersDescription)}</p>
       <ul class="pr-list">
        ${data.dealers
          .slice(0, 18)
          .map(dealer => `<li><a class="pr-link" href="/dealers/${encodeURIComponent(dealer.id)}/">${escapeHtml(dealer.name)}</a></li>`)
          .join('')}
      </ul>
      <p style="margin-top:14px;"><a class="pr-link" href="/dealers/">${escapeHtml(messages.sitemap.dynamic.viewAllDealers)}</a></p>`,
    ),
    renderSection(
      messages.sitemap.dynamic.blog,
      `<p>${escapeHtml(messages.sitemap.dynamic.blogDescription)}</p>
       <ul class="pr-list">
        ${localizedBlogPosts
          .slice(0, 18)
          .map(post => `<li><a class="pr-link" href="${escapeHtml(getPostHref(post))}">${escapeHtml(post.title)}</a></li>`)
          .join('')}
      </ul>
      <div class="pr-inline-links">
        <a class="pr-link" href="/blog/">${escapeHtml(messages.sitemap.dynamic.viewAllPosts)}</a>
        <a class="pr-link" href="/sitemap.xml">${escapeHtml(messages.sitemap.xmlCta)}</a>
      </div>`,
    ),
  ];

  return {
    outputRoute: '/sitemap/',
    canonicalPath: '/sitemap/',
    lang,
    title: messages.sitemap.metaTitle,
    description: messages.sitemap.metaDescription,
    keywords: (messages.sitemap.metaKeywords ?? []) as string[],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: messages.sitemap.metaTitle,
      description: messages.sitemap.metaDescription,
      url: `${SITE_URL}/sitemap/`,
    },
    bodyHtml: renderStandardLayout({
      lang,
      title: messages.sitemap.title,
      description: messages.sitemap.subtitle,
      label: messages.footer.sitemap,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: messages.footer.sitemap }],
      sections,
    }),
  };
};

const renderLegalPage = (options: {
  lang: AppLocale;
  outputRoute: string;
  canonicalPath: string;
  title: string;
  description: string;
  keywords: string[];
  updated: string;
  intro: string;
  sections: Array<{ title: string; items: string[] }>;
}) => {
  const messages = getMessages(options.lang);
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
    lang: options.lang,
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
      lang: options.lang,
      title: options.title,
      description: options.intro,
      label: messages.footer.legal,
      breadcrumbs: [{ href: '/', label: messages.header.home }, { label: options.title }],
      stats: [{ value: options.updated, label: prerenderDetailCopy[options.lang].common.updated }],
      sections: [
        ...sectionHtml,
        renderSection(
          messages.legal.common.questionsTitle,
          `<p>${escapeHtml(messages.legal.common.questionsBody)}</p>
           <div class="pr-inline-links">
             <a class="pr-link" href="/contact/">${escapeHtml(messages.legal.common.contactCta)}</a>
             <a class="pr-link" href="/terms/">${escapeHtml(messages.footer.terms)}</a>
             <a class="pr-link" href="/privacy-policy/">${escapeHtml(messages.footer.privacy)}</a>
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
  lang: AppLocale,
) => {
  const messages = getMessages(lang);
  const intlLocale = getIntlLocale(lang);
  const detailCopy = prerenderDetailCopy[lang];
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
    const fallbackDescription = interpolateLabel(messages.dealerDetails.metaDescription, {
      name: dealer.name,
      city: dealer.city || messages.listings.locationFallback,
      brands: (dealer.brands || []).length ? (dealer.brands || []).join(', ') : 'EV',
    });
    const description = truncate(
      dealer.description || fallbackDescription,
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
        messages.dealerDetails.aboutDealer,
        `<p>${escapeHtml(
          dealer.description ||
            interpolateLabel(messages.dealerDetails.aboutDescription, {
              name: dealer.name,
              city: dealer.city || messages.listings.locationFallback,
            }),
        )}</p>
         <div class="pr-meta-grid">
           <div class="pr-fact"><strong>${escapeHtml(detailCopy.common.city)}</strong>${escapeHtml(
             dealer.city || messages.listings.locationFallback,
           )}</div>
           ${
             displayAddress
               ? `<div class="pr-fact"><strong>${escapeHtml(messages.dealerDetails.address)}</strong>${escapeHtml(displayAddress)}</div>`
               : ''
           }
           ${
             dealer.contact_phone || dealer.phone
               ? `<div class="pr-fact"><strong>${escapeHtml(messages.dealerDetails.phone)}</strong><a class="pr-link" href="tel:${escapeHtml(
                   dealer.contact_phone || dealer.phone || '',
                 )}">${escapeHtml(dealer.contact_phone || dealer.phone || '')}</a></div>`
               : ''
           }
           ${
             dealer.contact_email || dealer.email
               ? `<div class="pr-fact"><strong>${escapeHtml(messages.dealerDetails.email)}</strong><a class="pr-link" href="mailto:${escapeHtml(
                   dealer.contact_email || dealer.email || '',
                 )}">${escapeHtml(dealer.contact_email || dealer.email || '')}</a></div>`
               : ''
           }
           ${
             dealer.website
               ? `<div class="pr-fact"><strong>${escapeHtml(messages.dealerDetails.website)}</strong><a class="pr-link" href="${escapeHtml(
                   dealer.website,
                 )}">${escapeHtml(dealer.website)}</a></div>`
               : ''
           }
         </div>`,
      ),
      renderSection(
        detailCopy.dealer.brandsAndLanguages,
        `<div class="pr-grid">
          <article class="pr-card">
            <h3>${escapeHtml(messages.dealerDetails.brandsSold)}</h3>
            <div class="pr-chip-list">
              ${(dealer.brands || []).map(brand => `<span class="pr-pill">${escapeHtml(brand)}</span>`).join('')}
            </div>
          </article>
          <article class="pr-card">
            <h3>${escapeHtml(messages.dealerDetails.languagesSpoken)}</h3>
            <div class="pr-chip-list">
              ${(dealer.languages || []).length
                ? dealer.languages.map(language => `<span class="pr-pill">${escapeHtml(language)}</span>`).join('')
                : `<span class="pr-muted">${escapeHtml(messages.dealerDetails.noLanguages)}</span>`}
            </div>
          </article>
        </div>`,
      ),
      renderSection(
        messages.dealerDetails.modelsAvailable,
        relatedModels.length
          ? `<ul class="pr-list">
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
            </ul>`
          : `<p>${escapeHtml(messages.dealerDetails.noDealerModels)}</p>`,
      ),
    ];

    return {
      outputRoute: canonicalPath,
      canonicalPath,
      lang,
      title: `${dealer.name} | ${messages.dealerDetails.metaTitleSuffix}`,
      description,
      keywords: [dealer.name, dealer.city, ...(dealer.brands || [])],
      structuredData,
      bodyHtml: renderStandardLayout({
        lang,
        title: dealer.name,
        description,
        label: messages.dealerDetails.officialBadge,
        breadcrumbs: [
          { href: '/', label: messages.header.home },
          { href: '/dealers/', label: messages.header.dealers },
          { label: dealer.name },
        ],
        actions: [
          { href: '/dealers/', label: messages.dealerDetails.backLink },
          dealer.website
            ? { href: dealer.website, label: messages.dealerDetails.visitWebsite, ghost: true }
            : { href: '/contact/', label: messages.footer.contact, ghost: true },
        ],
        stats: [
          { value: formatNumber((dealer.brands || []).length, intlLocale), label: messages.dealerDetails.brandsSold },
          {
            value: formatNumber((dealer.languages || []).length, intlLocale),
            label: messages.dealerDetails.languagesSpoken,
          },
          { value: formatNumber(relatedModels.length, intlLocale), label: messages.dealerDetails.modelsAvailable },
        ],
        sections,
      }),
    };
  });
};

const renderModelDetailPages = (
  data: PublicSiteData,
  dealersById: Map<string, Dealer>,
  lang: AppLocale,
) => {
  const messages = getMessages(lang);
  const intlLocale = getIntlLocale(lang);
  const detailCopy = prerenderDetailCopy[lang];
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
      interpolateLabel(messages.modelDetails.metaDescription, {
        brand: model.brand,
        model: model.model_name,
        range: model.range_wltp ?? '—',
        battery: model.battery_capacity ?? '—',
      }),
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
        messages.modelDetails.specifications,
        `<div class="pr-facts">
          <div class="pr-fact"><strong>${escapeHtml(messages.modelDetails.battery)}</strong>${escapeHtml(
            model.battery_capacity ? `${model.battery_capacity} kWh` : '—',
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(messages.modelDetails.range)}</strong>${escapeHtml(
            model.range_wltp ? `${model.range_wltp} km` : '—',
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(messages.modelDetails.power)}</strong>${escapeHtml(
            model.power_kw ? `${model.power_kw} kW` : '—',
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(messages.modelDetails.acceleration)}</strong>${escapeHtml(
            model.acceleration_0_100 ? `${model.acceleration_0_100} s` : '—',
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(messages.modelDetails.chargingAC)}</strong>${escapeHtml(
            model.charging_ac || '—',
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(messages.modelDetails.chargingDC)}</strong>${escapeHtml(
            model.charging_dc || '—',
          )}</div>
        </div>`,
      ),
      model.notes ? renderSection(detailCopy.model.description, `<p>${escapeHtml(model.notes)}</p>`) : '',
      renderSection(
        messages.modelDetails.availableAt,
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
          : `<p>${escapeHtml(messages.modelDetails.availabilityComingSoon)}</p>`,
      ),
    ].filter(Boolean) as string[];

    return {
      outputRoute: canonicalPath,
      canonicalPath,
      lang,
      title: `${model.brand} ${model.model_name} | ${messages.modelDetails.metaTitleSuffix}`,
      description,
      keywords: [model.brand, model.model_name, `${model.brand} ${model.model_name}`],
      structuredData,
      bodyHtml: renderStandardLayout({
        lang,
        title: `${model.brand} ${model.model_name}`,
        description,
        label: messages.header.models,
        breadcrumbs: [
          { href: '/', label: messages.header.home },
          { href: '/models/', label: messages.header.models },
          { label: `${model.brand} ${model.model_name}` },
        ],
        actions: [
          { href: '/models/', label: messages.modelDetails.backLink },
          dealers[0]
            ? {
                href: `/dealers/${encodeURIComponent(dealers[0].id)}/`,
                label: messages.modelDetails.contactDealer,
                ghost: true,
              }
            : { href: '/dealers/', label: messages.header.dealers, ghost: true },
        ],
        stats: [
          {
            value: model.battery_capacity ? `${model.battery_capacity} kWh` : '—',
            label: messages.modelDetails.battery,
          },
          { value: model.range_wltp ? `${model.range_wltp} km` : '—', label: messages.modelDetails.range },
          { value: formatNumber(dealers.length, intlLocale), label: messages.modelDetails.availableAt },
        ],
        sections,
      }),
    };
  });
};

const renderListingDetailPages = (
  data: PublicSiteData,
  dealersById: Map<string, Dealer>,
  lang: AppLocale,
) => {
  const messages = getMessages(lang);
  const intlLocale = getIntlLocale(lang);
  const detailCopy = prerenderDetailCopy[lang];

  return data.listings.map<PageDefinition>(listing => {
    const dealer = dealersById.get(listing.dealerId);
    const canonicalPath = `/listings/${listing.id}/`;
    const description = truncate(
      listing.description || `${listing.year} ${listing.make} ${listing.model} | Makina Elektrike`,
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
        messages.listings.specifications,
        `<div class="pr-facts">
          <div class="pr-fact"><strong>${escapeHtml(detailCopy.listing.price)}</strong>${escapeHtml(
            formatCurrency(listing.price, listing.priceCurrency, intlLocale),
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(messages.listings.fields.year)}</strong>${escapeHtml(String(listing.year))}</div>
          <div class="pr-fact"><strong>${escapeHtml(messages.listings.fields.mileage)}</strong>${escapeHtml(
            `${formatNumber(listing.mileage, intlLocale)} km`,
          )}</div>
          <div class="pr-fact"><strong>${escapeHtml(messages.listings.fields.fuelType)}</strong>${escapeHtml(listing.fuelType)}</div>
          ${
            listing.batteryCapacity
              ? `<div class="pr-fact"><strong>${escapeHtml(messages.listings.fields.battery)}</strong>${escapeHtml(`${listing.batteryCapacity} kWh`)}</div>`
              : ''
          }
          ${
            listing.range
              ? `<div class="pr-fact"><strong>${escapeHtml(messages.listings.fields.range)}</strong>${escapeHtml(`${listing.range} km`)}</div>`
              : ''
          }
        </div>`,
      ),
      listing.description ? renderSection(messages.listings.description, `<p>${escapeHtml(listing.description)}</p>`) : '',
      dealer
        ? renderSection(
            messages.listings.soldBy,
            `<p><a class="pr-link" href="/dealers/${encodeURIComponent(dealer.id)}/">${escapeHtml(dealer.name)}</a></p>
             <p class="pr-muted">${escapeHtml(dealer.city)}</p>`,
          )
        : '',
    ].filter(Boolean) as string[];

    return {
      outputRoute: canonicalPath,
      canonicalPath,
      lang,
      title: `${listing.make} ${listing.model} (${listing.year}) | Makina Elektrike`,
      description,
      keywords: [listing.make, listing.model, String(listing.year), messages.header.listings],
      structuredData,
      bodyHtml: renderStandardLayout({
        lang,
        title: `${listing.make} ${listing.model}`,
        description,
        label: messages.header.listings,
        breadcrumbs: [
          { href: '/', label: messages.header.home },
          { href: '/listings/', label: messages.header.listings },
          { label: `${listing.make} ${listing.model}` },
        ],
        actions: [
          { href: '/listings/', label: detailCopy.listing.backToListings },
          dealer
            ? {
                href: `/dealers/${encodeURIComponent(dealer.id)}/`,
                label: detailCopy.listing.viewDealer,
                ghost: true,
              }
            : { href: '/dealers/', label: detailCopy.listing.browseDealers, ghost: true },
        ],
        stats: [
          { value: formatCurrency(listing.price, listing.priceCurrency, intlLocale), label: detailCopy.listing.price },
          { value: String(listing.year), label: messages.listings.fields.year },
          { value: `${formatNumber(listing.mileage, intlLocale)} km`, label: messages.listings.fields.mileage },
        ],
        sections,
      }),
    };
  });
};

const renderBlogPostPages = (posts: BlogPost[], lang: AppLocale) => {
  const messages = getMessages(lang);
  const intlLocale = getIntlLocale(lang);
  const detailCopy = prerenderDetailCopy[lang];

  return posts.flatMap<PageDefinition>(post => {
    const contentLocale = getBlogContentLocale(post, lang);
    if (lang !== DEFAULT_LOCALE && contentLocale !== lang) {
      return [];
    }

    const localizedPost = getLocalizedBlogPost(post, lang);
    const canonicalPath = `/blog/${localizedPost.slug}`;
    const faqEntities =
      localizedPost.faqs?.map(faq => ({
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
        headline: localizedPost.title,
        description: localizedPost.metaDescription,
        image: [localizedPost.imageUrl],
        datePublished: localizedPost.date,
        author: {
          '@type': 'Person',
          name: localizedPost.author,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Makina Elektrike',
          url: SITE_URL,
        },
        mainEntityOfPage: `${SITE_URL}${canonicalPath}`,
        keywords: localizedPost.tags.join(', '),
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

    const sections = localizedPost.sections.map(section =>
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

    if (localizedPost.faqs?.length) {
      sections.push(renderFaqSection(messages.blogPage.faqTitle, localizedPost.faqs));
    }

    if (localizedPost.cta) {
      sections.push(
        renderSection(
          detailCopy.common.continueExploring,
          `<p><a class="pr-link" href="${localizedPost.cta.url}">${escapeHtml(localizedPost.cta.text)}</a></p>`,
        ),
      );
    }

    return {
      outputRoute: canonicalPath,
      canonicalPath,
      lang,
      title: localizedPost.metaTitle,
      description: localizedPost.metaDescription,
      keywords: localizedPost.tags,
      image: localizedPost.imageUrl,
      ogType: 'article',
      robots: localizedPost.metaRobots,
      alternateLocales: getBlogAlternateLocales(post),
      structuredData,
      bodyHtml: renderStandardLayout({
        lang,
        title: localizedPost.title,
        description: localizedPost.excerpt,
        label: messages.header.blog,
        breadcrumbs: [
          { href: '/', label: messages.header.home },
          { href: '/blog/', label: messages.header.blog },
          { label: localizedPost.title },
        ],
        actions: [
          { href: '/blog/', label: messages.blogPage.backToAllPosts },
          localizedPost.cta
            ? { href: localizedPost.cta.url, label: localizedPost.cta.text, ghost: true }
            : { href: '/models/', label: messages.header.models, ghost: true },
        ],
        stats: [
          { value: formatDate(localizedPost.date, intlLocale), label: detailCopy.common.published },
          { value: localizedPost.readTime, label: detailCopy.common.readTime },
          { value: localizedPost.author, label: detailCopy.common.author },
        ],
        sections,
      }),
    };
  });
};

const renderLocalizedLegalPages = (lang: AppLocale): PageDefinition[] => {
  const messages = getMessages(lang);

  return [
    renderLegalPage({
      lang,
      outputRoute: '/privacy-policy/',
      canonicalPath: '/privacy-policy/',
      title: messages.legal.privacy.metaTitle,
      description: messages.legal.privacy.metaDescription,
      keywords: messages.legal.privacy.metaKeywords as string[],
      updated: messages.legal.privacy.updated,
      intro: messages.legal.privacy.intro,
      sections: messages.legal.privacy.sections as Array<{ title: string; items: string[] }>,
    }),
    renderLegalPage({
      lang,
      outputRoute: '/terms/',
      canonicalPath: '/terms/',
      title: messages.legal.terms.metaTitle,
      description: messages.legal.terms.metaDescription,
      keywords: messages.legal.terms.metaKeywords as string[],
      updated: messages.legal.terms.updated,
      intro: messages.legal.terms.intro,
      sections: messages.legal.terms.sections as Array<{ title: string; items: string[] }>,
    }),
    renderLegalPage({
      lang,
      outputRoute: '/cookie-policy/',
      canonicalPath: '/cookie-policy/',
      title: messages.legal.cookies.metaTitle,
      description: messages.legal.cookies.metaDescription,
      keywords: messages.legal.cookies.metaKeywords as string[],
      updated: messages.legal.cookies.updated,
      intro: messages.legal.cookies.intro,
      sections: messages.legal.cookies.sections as Array<{ title: string; items: string[] }>,
    }),
  ];
};

const generatePages = (data: PublicSiteData) => {
  const dealersById = mapDealersById(data.dealers);
  const modelsById = mapModelsById(data.models);

  const staticPages = SUPPORTED_LOCALES.flatMap<PageDefinition>(lang => [
    renderHomePage(data, lang),
    renderDealersPage(data, lang),
    renderModelsPage(data, lang),
    renderListingsPage(data, dealersById, lang),
    renderBlogPage(data, lang),
    renderHelpCenterPage(lang),
    renderAboutPage(lang),
    renderContactPage(lang),
    renderRegisterUserPage(lang),
    renderRegisterDealerPage(lang),
    renderChargingStationsPage(lang),
    renderSitemapPage(data, lang),
    ...renderLocalizedLegalPages(lang),
  ]);

  const dynamicPages = SUPPORTED_LOCALES.flatMap<PageDefinition>(lang => [
    ...renderDealerDetailPages(data, dealersById, modelsById, lang),
    ...renderModelDetailPages(data, dealersById, lang),
    ...renderListingDetailPages(data, dealersById, lang),
    ...renderBlogPostPages(data.blogPosts, lang),
  ]);

  return [...staticPages, ...dynamicPages].map(finalizePage);
};

const main = async () => {
  const data = await loadPublicSiteData();
  const pages = generatePages(data);
  const blogTranslationCoverage = getBlogTranslationCoverage(data.blogPosts);
  pages.forEach(writePage);

  console.log(
    `Prerendered ${pages.length} public HTML documents (dealers=${data.dealers.length}, models=${data.models.length}, listings=${data.listings.length}, blog=${data.blogPosts.length}, blogTranslations=en:${blogTranslationCoverage.en}/${blogTranslationCoverage.total},it:${blogTranslationCoverage.it}/${blogTranslationCoverage.total}).`,
  );
};

main().catch(error => {
  console.error('Failed to prerender public pages.', error);
  process.exitCode = 1;
});
