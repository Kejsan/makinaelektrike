# Security Fix Implementation Backlog

Generated: 2026-04-21
Source: `security_best_practices_report.md`

## Goal

Turn the remaining security findings into an execution-ready backlog with clear ordering, file ownership, dependencies, and effort estimates.

## Assumptions

- Deployment target remains Netlify.
- Firebase stays the primary data store and auth layer.
- Netlify Functions will be used as the first server-side boundary for secret-bearing API calls.
- Public UX should remain stable while security changes are rolled out.

## Delivery Order

1. Move secret-bearing API calls server-side.
2. Lock down blog draft visibility.
3. Move enquiries behind a protected server-side submission path.
4. Add CSP and reduce third-party script exposure.
5. Add regression coverage for rules and server-side proxies.

## Milestone 1: Secret-Bearing APIs Behind Server-Side Proxies

### SEC-001A: Establish Netlify Functions foundation

- Effort: `1 day`
- Dependencies: none
- Files:
  - [netlify.toml](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/netlify.toml)
  - New: `netlify/functions/_lib/http.ts`
  - New: `netlify/functions/_lib/env.ts`
  - New: `netlify/functions/_lib/validation.ts`
  - [.env.example](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/.env.example)
- Tasks:
  - Configure a `functions` directory in Netlify.
  - Add shared helpers for env loading, request parsing, timeouts, and error shaping.
  - Define a standard JSON response format for all security-sensitive proxies.
- Acceptance:
  - A trivial function can run locally and in Netlify.
  - Secrets are read only from server-side env, never from `VITE_*`.

### SEC-001B: Proxy API Ninjas requests

- Effort: `0.5 day`
- Dependencies: `SEC-001A`
- Files:
  - [services/apiNinjas.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/services/apiNinjas.ts)
  - [components/admin/EVModelSearch.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/admin/EVModelSearch.tsx)
  - New: `netlify/functions/api-ninjas-electricvehicle.ts`
- Tasks:
  - Replace direct browser calls to API Ninjas with same-origin fetches.
  - Validate `make` and `model` query params server-side.
  - Keep rate-limit and error handling behavior stable.
- Acceptance:
  - No `VITE_API_NINJAS_KEY` remains in client code.
  - EV search still works from the admin UI.

### SEC-001C: Proxy DeepL translation requests

- Effort: `0.5 day`
- Dependencies: `SEC-001A`
- Files:
  - [services/deepl.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/services/deepl.ts)
  - [components/admin/BlogPostForm.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/admin/BlogPostForm.tsx)
  - New: `netlify/functions/deepl-translate.ts`
- Tasks:
  - Proxy translation requests through Netlify.
  - Validate target language and max text length.
  - Reject HTML translation mode unless explicitly needed.
- Acceptance:
  - No `VITE_DEEPL_API_KEY` remains in client code.
  - Auto-translate still works in the blog editor.

### SEC-001D: Proxy Gemini model enrichment and chat requests

- Effort: `1.5 days`
- Dependencies: `SEC-001A`
- Files:
  - [services/gemini.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/services/gemini.ts)
  - [components/ChatWidget.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/ChatWidget.tsx)
  - [components/admin/EVModelSearch.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/admin/EVModelSearch.tsx)
  - [components/admin/ModelForm.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/admin/ModelForm.tsx)
  - [services/gemini.test.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/services/gemini.test.ts)
  - New: `netlify/functions/gemini-enrich-model.ts`
  - New: `netlify/functions/gemini-chat.ts`
- Tasks:
  - Split enrichment and chat into separate server-side functions.
  - Keep model-specific prompt construction on the server.
  - Remove direct `GoogleGenAI` instantiation from the browser.
  - Fix the existing Gemini test mock to cover the new server-client boundary.
- Acceptance:
  - No Gemini key is accessible from the browser.
  - Admin enrichment and chat both work through server-side functions.
  - `services/gemini.test.ts` is updated to reflect the new call pattern.

### SEC-001E: Proxy Open Charge Map requests

- Effort: `0.5 day`
- Dependencies: `SEC-001A`
- Files:
  - [services/ocm.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/services/ocm.ts)
  - [pages/ChargingStationsAlbaniaPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/ChargingStationsAlbaniaPage.tsx)
  - New: `netlify/functions/ocm-reference-data.ts`
  - New: `netlify/functions/ocm-stations.ts`
- Tasks:
  - Proxy reference-data and station lookups.
  - Stop sending OCM keys in query strings from the browser.
  - Preserve current filter behavior.
- Acceptance:
  - No OCM key remains in client-visible requests.
  - Charging-station search still works.

### SEC-001F: Remove browser secret exposure from config

- Effort: `0.5 day`
- Dependencies: `SEC-001B` through `SEC-001E`
- Files:
  - [.env.example](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/.env.example)
  - [vite-env.d.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/vite-env.d.ts)
  - [README.md](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/README.md)
- Tasks:
  - Remove `VITE_*` entries for secrets.
  - Document server-only env vars and local dev setup.
  - Rotate all previously exposed keys after deployment.
- Acceptance:
  - `rg "VITE_.*(KEY|SECRET)"` only returns genuinely public config.

## Milestone 2: Blog Draft Visibility and Access Control

### SEC-002A: Normalize blog visibility model

- Effort: `0.5 day`
- Dependencies: none
- Files:
  - [types.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/types.ts)
  - [components/admin/BlogPostForm.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/admin/BlogPostForm.tsx)
  - [services/api.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/services/api.ts)
  - [contexts/DataContext.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/contexts/DataContext.tsx)
- Tasks:
  - Standardize on `status: 'draft' | 'published'`.
  - Keep `published` only as a compatibility field if needed.
  - Add explicit admin controls for draft/published state.
- Acceptance:
  - Blog post creation and editing can intentionally produce draft or published content.

### SEC-002B: Backfill existing blog documents

- Effort: `0.5 day`
- Dependencies: `SEC-002A`
- Files:
  - New: `scripts/backfillBlogVisibility.ts`
  - Optional notes in [security_best_practices_report.md](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/security_best_practices_report.md)
- Tasks:
  - Mark all current public posts as published.
  - Produce a dry-run mode before writing.
  - Record any ambiguous documents for manual review.
- Acceptance:
  - Existing public posts continue to be public after the migration.

### SEC-002C: Restrict Firestore blog reads

- Effort: `1 day`
- Dependencies: `SEC-002A`, `SEC-002B`
- Files:
  - [firestore.rules](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/firestore.rules)
  - [services/api.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/services/api.ts)
  - [pages/AdminPage.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/pages/AdminPage.tsx)
- Tasks:
  - Restrict public reads to published documents only.
  - Keep full reads for admins.
  - Ensure public subscriptions and detail lookups query only published data.
- Acceptance:
  - Draft blog posts are visible in admin and unreadable from the public client SDK.

## Milestone 3: Protected Enquiry Submission Path

### SEC-004A: Move enquiry creation to a server-side endpoint

- Effort: `1 day`
- Dependencies: `SEC-001A`
- Files:
  - [services/enquiries.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/services/enquiries.ts)
  - [components/listings/EnquiryModal.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/listings/EnquiryModal.tsx)
  - [firestore.rules](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/firestore.rules)
  - New: `netlify/functions/create-enquiry.ts`
- Tasks:
  - Submit enquiries through a function instead of direct Firestore writes.
  - Apply server-side validation and Firestore write logic there.
  - Remove anonymous direct `create` from Firestore rules.
- Acceptance:
  - Public users can still send enquiries through the site.
  - Anonymous Firestore clients cannot create enquiry documents directly.

### SEC-004B: Add abuse controls

- Effort: `1 day`
- Dependencies: `SEC-004A`
- Files:
  - [components/listings/EnquiryModal.tsx](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/components/listings/EnquiryModal.tsx)
  - New: `components/security/TurnstileField.tsx`
  - New: `netlify/functions/_lib/rateLimit.ts`
  - New: `netlify/functions/_lib/turnstile.ts`
  - [netlify.toml](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/netlify.toml)
- Tasks:
  - Add rate limiting by IP and listing/dealer target.
  - Add CAPTCHA verification. Recommended default: Cloudflare Turnstile.
  - Log rejected submissions with safe redaction.
- Acceptance:
  - Repeated automated submissions are throttled or blocked.

## Milestone 4: CSP and Third-Party Script Hygiene

### SEC-003A: Remove or reduce remote import-map dependency

- Effort: `1 day`
- Dependencies: none
- Files:
  - [index.html](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/index.html)
  - [package.json](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/package.json)
  - [vite.config.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/vite.config.ts)
- Tasks:
  - Remove the `aistudiocdn.com` import map if it is no longer required.
  - Ensure all runtime dependencies are bundled by Vite.
  - Keep Google Analytics only if still required.
- Acceptance:
  - The app builds and runs without the remote import map.

### SEC-003B: Add report-only CSP, then enforce

- Effort: `1 day`
- Dependencies: `SEC-003A`
- Files:
  - [public/_headers](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/public/_headers)
  - [index.html](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/index.html)
- Tasks:
  - Add a report-only CSP first.
  - Resolve any remaining inline-script or third-party source violations.
  - Move to an enforcing policy once clean.
- Acceptance:
  - Production can run with CSP enabled and no broad `unsafe-eval`.
  - Inline script allowances are minimal and documented.

## Milestone 5: Regression Coverage and Verification

### SEC-005A: Add Firebase rules tests

- Effort: `1 day`
- Dependencies: `SEC-002C`, `SEC-004A`
- Files:
  - [package.json](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/package.json)
  - New: `tests/firestore.rules.test.ts`
  - New: `tests/storage.rules.test.ts`
  - [firestore.rules](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/firestore.rules)
  - [storage.rules](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/storage.rules)
- Tasks:
  - Add emulator-backed tests for anonymous, user, dealer, and admin roles.
  - Cover blog draft visibility, dealer self-approval denial, listing ownership, and storage upload constraints.
- Acceptance:
  - Rules changes are validated by automated tests instead of manual checks only.

### SEC-005B: Add proxy-function tests and fix existing Gemini test failure

- Effort: `0.5 day`
- Dependencies: `SEC-001B` through `SEC-001E`
- Files:
  - [services/gemini.test.ts](/C:/Users/Admin/Downloads/Vibe%20Coding/Makina%20Elektrike/makinaelektrike/services/gemini.test.ts)
  - New: `netlify/functions/**/*.test.ts`
- Tasks:
  - Add unit tests for request validation and error mapping in server-side functions.
  - Update the Gemini test suite so it matches the refactored architecture.
- Acceptance:
  - `npm test` passes.

## Suggested Parallelization

- Track A:
  `SEC-001A` -> `SEC-001B` -> `SEC-001C`
- Track B:
  `SEC-001A` -> `SEC-001D` -> `SEC-001E`
- Track C:
  `SEC-002A` -> `SEC-002B` -> `SEC-002C`
- Track D:
  `SEC-003A` -> `SEC-003B`
- Track E:
  `SEC-004A` -> `SEC-004B`

## Estimated Total Effort

- Sequential: `9-10.5 engineer days`
- With parallel execution: `4-6 working days`

## Definition of Done

- No secret-bearing API call originates from browser code.
- Draft blog posts are not readable by the public client.
- Enquiry submission is server-mediated and abuse-controlled.
- CSP is deployed and enforced without breaking the app.
- Firebase rules and proxy functions are covered by automated tests.
- `npm test` and `npm run build` both pass.
