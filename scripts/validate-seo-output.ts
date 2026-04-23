import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type AppLocale,
  DEFAULT_LOCALE,
  buildLocalizedPath,
  isLocalizablePath,
} from '../utils/localizedRouting';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const siteUrl = (process.env.VITE_SITE_URL || 'https://makinaelektrike.com').replace(/\/+$/, '');

type SeoIssue = {
  file: string;
  message: string;
};

const issues: SeoIssue[] = [];

const addIssue = (file: string, message: string) => {
  issues.push({ file: path.relative(rootDir, file), message });
};

const listHtmlFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listHtmlFiles(fullPath);
    }

    return entry.isFile() && entry.name === 'index.html' ? [fullPath] : [];
  });
};

const getRouteFromFile = (file: string) => {
  const relative = path.relative(distDir, file).replace(/\\/g, '/');
  if (relative === 'index.html') {
    return null;
  }

  if (relative === '__prerendered/home/index.html') {
    return '/';
  }

  return `/${relative.replace(/\/index\.html$/, '/')}`;
};

const getExpectedLocale = (route: string): AppLocale => {
  if (route === '/en' || route.startsWith('/en/')) {
    return 'en';
  }

  if (route === '/it' || route.startsWith('/it/')) {
    return 'it';
  }

  return DEFAULT_LOCALE;
};

const getTagContent = (html: string, selector: RegExp) => html.match(selector)?.[1] ?? '';

const getHrefTags = (html: string) =>
  [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);

const getCanonicalCandidates = (route: string, locale: AppLocale) => {
  const localizedRoute = `${siteUrl}${buildLocalizedPath(route, locale)}`;
  const withoutTrailingSlash =
    route !== '/' && route.endsWith('/') ? `${siteUrl}${buildLocalizedPath(route.slice(0, -1), locale)}` : localizedRoute;

  return Array.from(new Set([localizedRoute, withoutTrailingSlash]));
};

const getJsonLdBlocks = (html: string) =>
  [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => match[1]);

const isNoindex = (html: string) => /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);

const assertSchemaTypes = (file: string, value: unknown) => {
  if (Array.isArray(value)) {
    value.forEach(item => assertSchemaTypes(file, item));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  const schemaType = record['@type'];
  if (typeof schemaType === 'string' && schemaType.startsWith('/')) {
    addIssue(file, `JSON-LD @type must not be localized as a path: ${schemaType}`);
  }

  Object.values(record).forEach(child => assertSchemaTypes(file, child));
};

const validateLocalizedLinks = (file: string, html: string, locale: AppLocale) => {
  for (const href of getHrefTags(html)) {
    if (!href.startsWith('/') || !isLocalizablePath(href)) {
      continue;
    }

    const expected = buildLocalizedPath(href, locale);
    if (href !== expected) {
      addIssue(file, `Internal link should be localized for ${locale}: ${href} -> ${expected}`);
    }
  }
};

const validateFile = (file: string) => {
  const route = getRouteFromFile(file);
  if (!route) {
    return;
  }

  const html = fs.readFileSync(file, 'utf8');
  const locale = getExpectedLocale(route);
  const canonical = getTagContent(html, /<link\s+rel="canonical"\s+href="([^"]+)"/);
  const htmlLang = getTagContent(html, /<html\s+lang="([^"]+)"/);

  if (!htmlLang) {
    addIssue(file, 'Missing html lang attribute.');
  } else if (htmlLang !== locale) {
    addIssue(file, `Expected html lang "${locale}", got "${htmlLang}".`);
  }

  if (!canonical) {
    addIssue(file, 'Missing canonical link.');
  } else if (!canonical.startsWith(siteUrl)) {
    addIssue(file, `Canonical must use site origin ${siteUrl}: ${canonical}`);
  } else {
    const expectedCanonicals = getCanonicalCandidates(route, locale);
    if (!expectedCanonicals.includes(canonical)) {
      addIssue(file, `Canonical mismatch. Expected one of ${expectedCanonicals.join(', ')}, got ${canonical}`);
    }
  }

  if (!isNoindex(html)) {
    const expectedSelf = getCanonicalCandidates(route, locale);
    const selfHreflang = locale === 'sq' ? 'sq-AL' : locale;
    if (!expectedSelf.some(href => html.includes(`hreflang="${selfHreflang}" href="${href}"`))) {
      addIssue(file, `Missing self hreflang alternate for ${locale}: ${expectedSelf.join(' or ')}`);
    }

    const expectedDefault = getCanonicalCandidates(route, DEFAULT_LOCALE);
    if (!expectedDefault.some(href => html.includes(`hreflang="x-default" href="${href}"`))) {
      addIssue(file, `Missing x-default alternate: ${expectedDefault.join(' or ')}`);
    }
  }

  validateLocalizedLinks(file, html, locale);

  for (const block of getJsonLdBlocks(html)) {
    try {
      assertSchemaTypes(file, JSON.parse(block));
    } catch (error) {
      addIssue(file, `Invalid JSON-LD: ${(error as Error).message}`);
    }
  }

  for (const blockedHost of ['raw.githubusercontent.com', 'images.unsplash.com', 'source.unsplash.com', 'picsum.photos']) {
    if (html.includes(blockedHost)) {
      addIssue(file, `Blocked third-party image/content host found: ${blockedHost}`);
    }
  }
};

const main = () => {
  const htmlFiles = listHtmlFiles(distDir);
  if (!htmlFiles.length) {
    throw new Error('No generated HTML files found. Run npm run build before SEO validation.');
  }

  const localizedCounts = {
    sq: htmlFiles.filter(file => {
      const route = getRouteFromFile(file);
      return route && getExpectedLocale(route) === 'sq';
    }).length,
    en: htmlFiles.filter(file => {
      const route = getRouteFromFile(file);
      return route && getExpectedLocale(route) === 'en';
    }).length,
    it: htmlFiles.filter(file => {
      const route = getRouteFromFile(file);
      return route && getExpectedLocale(route) === 'it';
    }).length,
  };

  htmlFiles.forEach(validateFile);

  if (!localizedCounts.en || !localizedCounts.it) {
    addIssue(distDir, `Expected localized prerender output for en and it, got en=${localizedCounts.en}, it=${localizedCounts.it}.`);
  }

  if (issues.length) {
    console.error(`SEO validation failed with ${issues.length} issue(s):`);
    issues.slice(0, 80).forEach(issue => {
      console.error(`- ${issue.file}: ${issue.message}`);
    });
    if (issues.length > 80) {
      console.error(`...and ${issues.length - 80} more issue(s).`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `SEO validation passed (${htmlFiles.length} HTML files; sq=${localizedCounts.sq}, en=${localizedCounts.en}, it=${localizedCounts.it}).`,
  );
};

main();
