# Frontend, UI/UX, and Performance Fix Plan

## Goal

Resolve the current frontend defects, translation gaps, dead code, broken routes, missing Help Center, modal/mobile issues, and performance bottlenecks without mixing unrelated refactors into the same implementation pass.

## Execution Principles

- Fix user-visible correctness issues before visual polish.
- Remove broken or dead paths before optimizing them.
- Keep public-site fixes separate from admin-only cleanup where possible.
- Add verification as each block lands so regressions are caught early.
- Do route-splitting and data-loading changes only after route integrity and i18n stability are restored.

## Phase 0: Baseline and Safety Net

### Scope

- Capture the current state before touching behavior.
- Establish a repeatable QA checklist for homepage, listings, models, dealers, blog, contact, register, favorites, admin shell, and dealer shell.

### Tasks

1. Record baseline screenshots for:
   - Homepage
   - Dealers list/detail
   - Models list/detail
   - Listings list/detail
   - Blog list/detail
   - Contact
   - Register user
   - Register dealer
   - Favorites
2. Check those flows in:
   - Albanian
   - English
   - Italian
   - Mobile and desktop
3. Record current performance baselines for homepage:
   - Lighthouse mobile
   - Network request count
   - LCP and CLS
4. Run static validation:
   - `npm test`
   - `npm run build`
   - `npx tsc --noEmit`

### Acceptance Criteria

- We have a baseline for visual comparison and performance comparison.
- Current failures are documented before code changes begin.

## Phase 1: Route Integrity, Help Center Entry Point, and Dead Code Cleanup

### Priority

P0

### Scope

Remove obviously broken navigation, add the missing Help Center entry point, and isolate or delete code that is no longer part of the product.

### Tasks

1. Fix broken header navigation:
   - Keep `/help-center` as a supported product route in [components/Header.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/Header.tsx)
   - Add a real route in [App.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/App.tsx)
   - Ensure both desktop and mobile navigation expose it correctly
2. Remove the unused `MigrationTool` import from [App.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/App.tsx).
3. Decide the fate of:
   - [components/ChatWidget.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/ChatWidget.tsx)
   - [components/ChatButton.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/ChatButton.tsx)
   - [pages/DealerInventoryPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/DealerInventoryPage.tsx)
4. For `DealerInventoryPage`, choose one path:
   - mount and fix it properly, or
   - remove it entirely if the dealer dashboard already replaces it
5. If `DealerInventoryPage` is retained:
   - fix `/register/dealer` to `/register-dealer`
   - fix the SEO prop mismatch

### Acceptance Criteria

- No internal navigation points to a non-existent route.
- `/help-center` resolves to a real page from both desktop and mobile navigation.
- Dead components are either removed or explicitly brought back into supported product scope.
- Route table reflects only pages we actually support.

## Phase 2: Translation Integrity and Content Ownership Cleanup

### Priority

P0

### Scope

Make language switching reliable and eliminate mixed-language UI, raw key leakage, and hardcoded public copy.

### Tasks

1. Build a translation audit pass for all `t(...)` calls and compare them against:
   - [i18n/locales/sq.json](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/i18n/locales/sq.json)
   - [i18n/locales/en.json](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/i18n/locales/en.json)
   - [i18n/locales/it.json](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/i18n/locales/it.json)
2. Add missing keys for:
   - header actions
   - comparison modal
   - favorites modal/actions
   - enquiry labels
   - listing detail labels
   - public-page CTA copy
3. Replace hardcoded strings on public pages:
   - [pages/RegisterDealerPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/RegisterDealerPage.tsx)
   - [pages/RegisterUserPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/RegisterUserPage.tsx)
   - [pages/ContactPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/ContactPage.tsx)
   - [pages/ListingDetailPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/ListingDetailPage.tsx)
   - [pages/BlogPostPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/BlogPostPage.tsx)
   - [components/Footer.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/Footer.tsx)
4. Remove page-to-page translation leakage:
   - replace `aboutPage.collaborationCta*` usage in [pages/ContactPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/ContactPage.tsx) with contact-specific keys
5. Add `defaultValue` only where a safe short fallback is useful during rollout, not as a substitute for real locale coverage.
6. Verify that switching language updates:
   - nav
   - cards
   - footer
   - modals
   - forms
   - not-found states

### Acceptance Criteria

- No public page shows mixed Albanian, English, and Italian copy during the same session unless content itself is intentionally language-specific.
- No visible raw translation keys appear in buttons, labels, modal titles, or form copy.
- All three locales remain in sync for the supported public UI.

## Phase 3: Help Center Product Build

### Priority

P0

### Scope

Build a real Help Center page and seed it with high-quality support content based on the actual platform behavior, EV marketplace best practices, and help-center information architecture best practices.

### Tasks

1. Create the Help Center route and page:
   - add a new page component such as [pages/HelpCenterPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/HelpCenterPage.tsx)
   - mount it in [App.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/App.tsx)
   - wire header and footer entry points
2. Define a Help Center information architecture with sections that match the product:
   - Getting started with Makina Elektrike
   - Browsing models and listings
   - Comparing vehicles and using favorites
   - Finding dealers and contacting sellers
   - Charging stations and EV ownership basics
   - User account and registration help
   - Dealer onboarding and dealership profile management
   - Troubleshooting and support escalation
3. Write the initial support content based on the platform we actually have, not imagined features:
   - what the site is for
   - how buyers should use models, listings, dealers, favorites, and comparison
   - what dealer registration does and what happens after submission
   - what contact and enquiry flows do
   - what the charging-stations page is for
   - basic EV buyer guidance that supports the marketplace journey
4. Structure the content like a real help center:
   - searchable article groups or clearly grouped topic cards
   - short answer summaries first
   - step-by-step guidance where needed
   - escalation path to contact/support
   - cross-links to relevant live pages
5. Use content patterns that scale:
   - central content data structure for categories and articles
   - support article anchors or section ids for direct linking
   - optional FAQ schema and breadcrumbs for SEO
6. Localize the Help Center:
   - Albanian
   - English
   - Italian
   - keep the article taxonomy and CTA labels in sync with the rest of the site
7. Add UX conventions expected from a proper Help Center:
   - clear page title and support-oriented intro
   - topic grouping
   - quick links to key tasks
   - "still need help?" section that points to contact or dealer registration where appropriate
   - mobile-safe content hierarchy and spacing
8. Verify that the Help Center content is aligned with the real platform surface after Phases 1 and 2 land.

### Acceptance Criteria

- `/help-center` is a first-class page, not a placeholder.
- The Help Center explains the actual platform clearly for buyers and dealers.
- Content is actionable, internally linked, and localized.
- The page follows support-page best practices instead of reading like marketing copy.

## Phase 4: SEO, Crawlability, and AI Discoverability Program

### Priority

P0

### Scope

Run a full search and discoverability program across the public site so the platform is easier for search engines, AI-driven search surfaces, and assistant crawlers to understand, index, cite, and rank.

This phase covers classic SEO, technical SEO, structured data governance, internationalization strategy, snippet control, and AI-search discoverability constraints.

### Why this is a separate phase

The code audit and research show that the current site already contains some SEO work, but it is structurally limited by the current rendering model and metadata delivery pattern.

Current high-impact issues already identified:

- [components/SEO.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/SEO.tsx) injects canonical, robots, Open Graph, Twitter tags, and JSON-LD client-side in `useEffect`, which means the initial HTML response does not contain route-specific SEO metadata.
- Raw HTML responses for `/`, `/blog/`, and `/models/` currently return the same shell with a generic `<title>` and without route-specific descriptions, canonicals, or structured data before JavaScript runs.
- [public/robots.txt](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/public/robots.txt) explicitly allows `GPTBot` but does not explicitly allow `OAI-SearchBot`, which is the OpenAI crawler used for ChatGPT search inclusion.
- [public/robots.txt](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/public/robots.txt) uses `Crawl-delay`, which Google does not support.
- [scripts/generate-sitemap.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/scripts/generate-sitemap.ts) currently emits dynamic dealers, models, and blog posts, but not dynamic listing detail URLs.
- [pages/ChargingStationsAlbaniaPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/ChargingStationsAlbaniaPage.tsx) has a malformed canonical and Open Graph URL due to an embedded space in the URL string.
- The site has no localized URL system and no `hreflang` implementation, despite serving Albanian, English, and Italian content.
- The site uses `FAQPage` markup across several pages, but Google currently limits FAQ rich results to authoritative government and health sites.
- [pages/HomePage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/HomePage.tsx) contains a `SearchAction`, but the target query parameter does not currently map to an implemented public search URL behavior.

### Research-Constrained Rules for This Phase

- For Google AI features, use normal SEO best practices. There is no special AI-only schema or machine-readable file required.
- For Google Search, server-side rendering, static rendering, or hydration is preferred over relying purely on client-side rendering for critical public content.
- For ChatGPT search inclusion, `OAI-SearchBot` must be allowed if we want reliable discoverability.
- For Anthropic, crawl permissions should be explicit and intentional for `ClaudeBot` and `Claude-User`.
- Any experimental assets such as `llms.txt` should be treated as optional experiments only after core crawlability, rendering, metadata, and content architecture are correct.

### Tasks

1. Perform a page-template SEO audit for all public routes:
   - homepage
   - dealers list/detail
   - models list/detail
   - listings list/detail
   - blog list/detail
   - charging stations
   - about
   - contact
   - register user
   - register dealer
   - favorites
   - sitemap
   - Help Center
2. Decide and implement the rendering strategy for indexable public pages:
   - evaluate static prerendering, full static generation, or SSR-compatible delivery
   - stop treating client-side `useEffect` head mutation as the primary SEO delivery mechanism
   - ensure important metadata and primary content are present in the initial HTML response for public pages
3. Build a metadata architecture by page template:
   - unique titles
   - unique meta descriptions
   - canonical URLs
   - Open Graph and Twitter tags
   - robots directives where necessary
   - image metadata strategy for share cards
4. Fix immediate technical SEO defects already visible in code:
   - malformed canonical/Open Graph URL in charging stations page
   - broken or inconsistent canonical patterns
   - generic base HTML title for route responses
   - missing Help Center route in SEO surfaces
5. Redesign international SEO strategy:
   - decide whether localized content should remain on one URL or move to locale-specific URLs
   - if locale-specific URLs are adopted, add `hreflang` support and alternate references
   - update sitemap generation to include localized alternates if implemented
   - ensure the chosen approach works with the existing i18n setup and Netlify deployment model
6. Restructure sitemap strategy:
   - include listings detail URLs
   - include Help Center URLs
   - keep canonical-only URLs in sitemaps
   - keep `<lastmod>` tied to meaningful content updates
   - consider image or locale sitemap extensions only if they align with the chosen architecture
7. Review robots and crawler policy:
   - explicitly decide treatment for `Googlebot`, `Google-Extended`, `OAI-SearchBot`, `GPTBot`, `ClaudeBot`, `Claude-User`, `CCBot`, and other relevant crawlers
   - add `OAI-SearchBot` if ChatGPT search discoverability is desired
   - verify that robots rules do not conflict with page-level `noindex`
   - review parameter-disallow rules so they do not block future crawlable search/category pages we actually want indexed
   - remove unsupported or misleading directives where appropriate
8. Establish structured data governance:
   - keep only structured data types that match visible content and supported use cases
   - review `Organization`, `WebSite`, `LocalBusiness`/`AutoDealer`, `Vehicle`, `Product`, `ItemList`, `BlogPosting`, `Article`, and `BreadcrumbList`
   - reduce reliance on `FAQPage` as a ranking or rich-result strategy for non-eligible pages
   - add breadcrumb schema where hierarchy is real and stable
   - align structured data with the exact visible on-page content
9. Improve entity clarity and trust signals:
   - strengthen organization-level identity on the homepage
   - add stronger publisher, author, and editorial signals for blog and Help Center content
   - add clear bylines, publish dates, updated dates, and editorial ownership where appropriate
   - define content sourcing and update standards for EV data pages
10. Improve information architecture and internal linking:
   - connect pillar pages and deep pages intentionally
   - add breadcrumb navigation where useful
   - link Help Center, blog, models, listings, dealers, and charging content into topic clusters
   - reduce orphan-like public pages
11. Add a real content-authority program for the strategic goal of being the most trusted EV source in Albania and nearby countries:
   - publish people-first, source-backed content
   - cluster content around EV buying, charging, ownership, incentives, comparisons, and market updates
   - add Albania-first and regional coverage intentionally, not as thin localized duplicates
   - surface first-hand expertise, local market knowledge, and dealership ecosystem context
12. Add AI-search discoverability review:
   - make sure pages intended to be surfaced in ChatGPT search are crawlable by `OAI-SearchBot`
   - review whether AI-facing discoverability should be limited or expanded for training crawlers separately from search crawlers
   - confirm that important public content is available as readable text in the initial response, not only after hydration
   - make sure title, URL, visible headings, and page purpose are clear enough to be cited well by assistant-style experiences
13. Add search-console and diagnostics work:
   - verify sitemap submission and indexing coverage
   - monitor page indexing, enhancements, and manual actions
   - track structured-data validity
   - plan recurring checks for title-link rewrites, indexing drift, and crawl anomalies
14. Review 404 and soft-404 behavior:
   - make sure unknown routes and removed content are not served as misleading successful pages
   - define how Netlify, SPA routing, and any prerender/SSR layer should return proper status behavior
15. Review image and media SEO:
   - ensure images are discoverable, sized correctly, and described with meaningful alt text
   - avoid hotlinked media where it weakens control over indexing, caching, or metadata consistency
   - align social-preview image strategy with canonical page ownership

### Acceptance Criteria

- Public indexable pages deliver meaningful metadata and primary content in the initial HTML response, not only after client-side hydration.
- The site has an explicit and coherent crawl/index policy for search bots and AI-search crawlers.
- Canonicals, sitemaps, structured data, and internal links all reinforce the same preferred URL structure.
- Internationalization strategy is explicit and technically coherent.
- The site has a credible plan for earning authority in EV information, not just for exposing pages to crawlers.
- SEO changes are aligned with the current stack and do not create conflicts with security, routing, translation, or performance work.

## Phase 5: Public Form and Interaction Correctness

### Priority

P0

### Scope

Fix pages that currently look complete but behave inconsistently or incompletely.

### Tasks

1. Contact page:
   - replace `action="#"` with a real submission path
   - connect to the chosen backend flow or Netlify Function
   - add success and error states
   - ensure translated labels, placeholders, button text, and validation messages
2. Register user page:
   - fully localize headings, helper text, labels, button text, validation, and success/error copy
3. Register dealer page:
   - same treatment as user register page
4. Listing detail page:
   - localize labels and not-found state
   - verify favorite actions, enquiry opening, gallery navigation, and back navigation
5. Favorites and comparison:
   - patch missing keys
   - verify empty state, compare modal controls, close controls, and CTA labels

### Acceptance Criteria

- Public forms either work end to end or fail gracefully with proper feedback.
- Every CTA shown to the user is readable, translated, and intentional.
- No public workflow depends on placeholder form behavior.

## Phase 6: Modal, Layout, and Mobile Viewport Fixes

### Priority

P1

### Scope

Fix overflow, viewport-bounds, and mobile interaction issues that will surface more clearly after translations are corrected.

### Tasks

1. Standardize modal sizing rules in:
   - [components/ModalLayout.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/ModalLayout.tsx)
   - [constants/modalStyles.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/constants/modalStyles.ts)
2. Add:
   - `max-height`
   - internal scroll containment
   - mobile-safe padding
   - keyboard-safe layout behavior where practical
3. Refactor [components/listings/EnquiryModal.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/listings/EnquiryModal.tsx) to either:
   - use the shared modal layout, or
   - mirror the same viewport constraints
4. Review large panels and overlays in:
   - favorites compare flow
   - admin forms
   - dealer dashboard forms
5. Fix any duplicated or repeated UI blocks, starting with [components/admin/ModelForm.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/admin/ModelForm.tsx)

### Acceptance Criteria

- No modal exceeds the viewport height without providing an internal scroll path.
- Close controls remain accessible on mobile.
- Long translated copy does not break modal layout.

## Phase 7: Route-Level Code Splitting and Bundle Isolation

### Priority

P1

### Scope

Reduce initial load size by preventing admin-only and secondary routes from loading on the homepage.

### Tasks

1. Convert major page imports in [App.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/App.tsx) to `React.lazy` and `Suspense`.
2. Split admin and dealer areas into separate lazy-loaded route chunks.
3. Ensure admin-only components and libraries are not pulled into the public homepage path:
   - bulk import
   - migration tool
   - map-heavy forms
   - XLSX and CSV import dependencies
4. Check whether large shared components can be split further:
   - Google Maps components
   - comparison modal
   - gallery-heavy detail views

### Acceptance Criteria

- Homepage no longer pulls every page module on first load.
- Admin libraries are absent from the public route path unless the user enters admin/dealer flows.
- Initial request count and JS execution cost visibly drop.

## Phase 8: Data Loading and Subscription Narrowing

### Priority

P1

### Scope

Stop treating the entire app like one data screen.

### Tasks

1. Review [contexts/DataContext.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/contexts/DataContext.tsx) and separate:
   - always-needed data
   - page-specific data
   - admin-only data
2. Replace broad app-load subscriptions with narrower patterns:
   - homepage gets only homepage data
   - blog pages get only published blog data
   - listings pages get listing-specific data
   - admin pages load admin datasets when entered
3. Evaluate whether some collections should move from live subscription to fetch-on-demand for public browsing.
4. Keep memoization and cache behavior explicit so route navigation does not thrash the UI.

### Acceptance Criteria

- Homepage does not subscribe to data it does not render.
- Public browsing no longer opens avoidable Firestore listeners on first visit.
- Admin data is loaded only when the admin interface is in use.

## Phase 9: Analytics, Third-Party Script, and Image Strategy

### Priority

P1

### Scope

Cut third-party cost and improve LCP.

### Tasks

1. Defer analytics initialization in [services/firebase.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/services/firebase.ts):
   - initialize analytics lazily in the browser
   - avoid loading it during code paths that do not need it immediately
2. Review whether GTM in [index.html](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/index.html) should:
   - stay immediate
   - be delayed
   - be consent-gated
3. Rework homepage hero image in [pages/HomePage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/HomePage.tsx):
   - stop using the LCP image as a CSS background if possible
   - promote it to an actual image element or otherwise preload it correctly
4. Review all homepage card media and replace unstable remote hotlinks where practical:
   - GitHub raw
   - Unsplash
   - EV Database
   - EV Specifications
5. Add image loading strategy:
   - eager only for above-the-fold hero/LCP
   - lazy for below-the-fold cards and galleries
   - sizing and aspect-ratio guards to prevent layout shifts

### Acceptance Criteria

- LCP resource is discovered earlier.
- Third-party transfer size drops.
- Analytics and marketing scripts are no longer competing with primary content unnecessarily.

## Phase 10: Visual Polish and Public UX Consistency

### Priority

P2

### Scope

After correctness and performance are stable, improve perceived quality.

### Tasks

1. Review section spacing and alignment across public pages.
2. Standardize CTA hierarchy and button styling.
3. Audit cards for:
   - consistent image ratios
   - aligned copy blocks
   - consistent metadata spacing
4. Add restrained entrance/scroll motion only where it improves clarity:
   - homepage section reveals
   - card reveals
   - stat/insight blocks
5. Verify that animations:
   - do not shift layout
   - do not block interaction
   - respect performance constraints on mobile

### Acceptance Criteria

- Public pages feel consistent in spacing and interaction.
- Animation is additive, not decorative noise.
- No layout jumps are introduced by polish work.

## Phase 11: Type Safety and Cleanup Pass

### Priority

P2

### Scope

After behavior is corrected, finish the cleanup so the codebase is easier to maintain.

### Tasks

1. Resolve the `tsc` issues surfaced during the audit:
   - modal typing
   - blob/media typing in admin forms
   - sitemap script typing
2. Remove remaining unused imports, dead locals, and obsolete helpers.
3. Re-run dead-code search after route and modal changes land.

### Acceptance Criteria

- `npx tsc --noEmit` passes cleanly.
- No dead code remains in the supported product surface.

## Verification Matrix

Every phase that touches the public site should be checked in:

- Desktop:
  - Albanian
  - English
  - Italian
- Mobile:
  - Albanian
  - English
  - Italian

Core flows to verify:

1. Homepage language switch
2. Nav and footer links
3. Help Center navigation and content
4. Search metadata in initial HTML
5. Crawl rules and sitemap coverage
6. Dealer and model cards
7. Listings search and detail
8. Favorites and comparison
9. Contact submission
10. Register user
11. Register dealer
12. Blog list and blog detail
13. Dealer/admin shell entry points

## Suggested Implementation Order

1. Phase 1: route integrity and dead code
2. Phase 2: translation integrity
3. Phase 3: Help Center product build
4. Phase 4: SEO, crawlability, and AI discoverability
5. Phase 5: public form and interaction correctness
6. Phase 6: modal/mobile containment
7. Phase 7: route-level code splitting
8. Phase 8: data-loading narrowing
9. Phase 9: analytics and image strategy
10. Phase 10: visual polish
11. Phase 11: type-safety and cleanup

## Deliverables by Milestone

### Milestone A

- Broken routes fixed
- Dead code decision made
- Translation coverage restored for public UI
- Help Center route mounted

### Milestone B

- Help Center page and seeded support content complete
- SEO architecture and crawl policy defined
- High-priority SEO defects fixed
- Contact/register/listing/favorites flows corrected
- Modal and viewport bugs resolved

### Milestone C

- Public pages rendered in a search-friendly way
- Sitemap, canonical, and structured-data strategy aligned
- Homepage bundle reduced
- Data subscriptions narrowed
- LCP and third-party cost improved

### Milestone D

- Visual polish pass complete
- Type cleanup complete
- Final regression pass complete

## Notes

- The first working pass should target correctness, not aesthetics.
- Some performance wins will only be meaningful after route splitting and subscription narrowing land together.
- If we decide to permanently remove chat and dealer inventory, that cleanup should happen early so it does not distort later optimization work.
- Help Center content should be written from verified platform behavior. Where product behavior changes during implementation, the Help Center must be updated in the same pass.
