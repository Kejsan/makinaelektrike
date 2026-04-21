# Security Best Practices Report

Generated: 2026-04-20

## Executive Summary

The repo had several high-impact issues concentrated in three areas: client-exposed credentials, overly permissive Firebase rules, and HTML injection sinks in privileged UI flows. The current working tree fixes the most direct platform-compromise paths locally:

1. Browser-held storage credentials were removed from the upload path.
2. Firestore and Storage rules were tightened to block obvious privilege escalation and self-approval paths.
3. Two exploitable HTML injection flows were neutralized.
4. Baseline security headers were added at the static hosting layer.

The codebase still has a short list of important follow-up items. The largest remaining risk is that several third-party API keys are still used directly from browser code. Those need a server-side proxy or serverless function layer to be fully fixed.

## Addressed In This Patch

### [FIX-001] Removed browser-held storage credentials from uploads

- Severity before patch: Critical
- Locations:
  - `services/storage.ts:1`
  - `services/storage.ts:29`
  - `services/storage.ts:39`
  - `services/listings.ts:144`
  - `services/listings.ts:149`
  - `storage.rules:31`
  - `storage.rules:39`
  - `storage.rules:44`
  - `storage.rules:49`
- What changed:
  - Replaced direct S3/R2 client uploads in the browser with Firebase Storage uploads.
  - Added client-side allowlisting for file type and size.
  - Sanitized listing upload filenames.
  - Locked storage writes to admin or verified owner paths.
- Security impact:
  - Users no longer need browser-visible storage credentials to upload media.
  - Dealer/model/listing uploads are now constrained by Firebase Storage rules instead of an exposed object-store secret.

### [FIX-002] Closed Firestore privilege-escalation and self-approval paths

- Severity before patch: Critical
- Locations:
  - `firestore.rules:17`
  - `firestore.rules:57`
  - `firestore.rules:84`
  - `firestore.rules:115`
  - `services/api.ts:399`
  - `services/api.ts:400`
  - `contexts/DataContext.tsx:688`
- What changed:
  - Prevented self-created `/users/{uid}` documents from claiming privileged roles.
  - Restricted self-created dealer records to pending, inactive, non-approved state.
  - Restricted self-created listings to pending state and verified dealer ownership.
  - Narrowed public dealer reads to approved + active dealers, and aligned the public dealer query with that rule.
  - Corrected pending dealer creation to default inactive in the client data layer.
- Security impact:
  - A first-write role escalation to `admin` is no longer possible through Firestore rules.
  - Dealers can no longer self-approve or activate their own records by writing directly with the client SDK.

### [FIX-003] Closed HTML injection in chat and export flows

- Severity before patch: High
- Locations:
  - `components/ChatWidget.tsx:7`
  - `components/ChatWidget.tsx:15`
  - `components/ChatWidget.tsx:137`
  - `components/admin/MigrationTool.tsx:109`
  - `components/admin/MigrationTool.tsx:118`
  - `components/admin/MigrationTool.tsx:139`
- What changed:
  - Escaped HTML before applying markdown formatting in the chat widget.
  - Escaped exported table headers and cell content before printing admin PDF/print views.
  - Opened the export popup with `noopener,noreferrer` and nulled the opener.
- Security impact:
  - Model output can no longer inject executable markup into the chat UI.
  - Stored HTML in exported Firestore data can no longer execute in the admin export popup.

### [FIX-004] Added baseline static-hosting security headers

- Severity before patch: Medium
- Locations:
  - `public/_headers:1`
- What changed:
  - Added `X-Content-Type-Options: nosniff`
  - Added `X-Frame-Options: DENY`
  - Added `Referrer-Policy: strict-origin-when-cross-origin`
  - Added a restrictive `Permissions-Policy`
- Security impact:
  - This improves baseline browser hardening for the deployed static app.

## Outstanding Findings

### [SEC-001] Third-party API credentials are still exposed to the browser

- Severity: High
- Locations:
  - `services/apiNinjas.ts:5`
  - `services/apiNinjas.ts:191`
  - `services/deepl.ts:10`
  - `services/deepl.ts:33`
  - `services/gemini.ts:15`
  - `services/gemini.ts:34`
  - `components/ChatWidget.tsx:51`
  - `services/ocm.ts:109`
  - `services/ocm.ts:147`
- Evidence:
  - Browser code reads API keys from `import.meta.env` and sends them in request headers or query strings.
  - The chat widget still instantiates `GoogleGenAI` directly in the client.
- Impact:
  - Anyone with browser access can extract these credentials and reuse them for quota exhaustion, billing abuse, or service impersonation.
- Fix:
  - Move API Ninjas, DeepL, Gemini, and Open Charge Map calls behind Netlify Functions or another server-side proxy.
  - Keep only non-secret feature flags in client-delivered env vars.

### [SEC-002] Blog posts remain world-readable in Firestore rules

- Severity: High
- Locations:
  - `firestore.rules:206`
  - `firestore.rules:207`
  - `pages/AdminPage.tsx:506`
- Evidence:
  - `match /blogPosts/{postId}` still allows `read: if true`.
  - The admin UI already understands a draft filter, so unpublished states are part of the data model.
- Impact:
  - Any future draft or unpublished blog document stored in Firestore can be queried directly with the public client SDK even if the public UI hides it.
- Fix:
  - Introduce an explicit public visibility field and backfill existing content.
  - Change public queries to request only public posts.
  - After the data migration, restrict rules to published content for public users and full reads for admins only.

### [SEC-003] No Content Security Policy is enforced while loading remote scripts/import maps

- Severity: Medium
- Locations:
  - `index.html:11`
  - `index.html:21`
  - `index.html:24`
  - `public/_headers:1`
- Evidence:
  - The app loads Google Analytics and an `aistudiocdn.com` import map.
  - `_headers` now sets several hardening headers, but no `Content-Security-Policy`.
- Impact:
  - The app has weaker containment against XSS and supply-chain compromise than it should for a public production site.
- Fix:
  - Add a CSP in Netlify headers.
  - Prefer bundling or self-hosting over remote import maps where possible.
  - If remote sources must remain, pin the minimal origins and use hashes/nonces for inline scripts.

### [SEC-004] Public enquiry creation can still be spammed

- Severity: Medium
- Locations:
  - `firestore.rules:140`
  - `firestore.rules:164`
- Evidence:
  - The rules now validate shape and size, but the create path is still intentionally public.
  - There is no visible rate limiting, CAPTCHA, App Check, or server-side abuse control in the repo.
- Impact:
  - Attackers can still flood the `enquiries` collection and degrade dealer workflows.
- Fix:
  - Move submission behind a server endpoint with rate limiting, CAPTCHA, and abuse logging; or add Firebase App Check plus additional gatekeeping.

## Verification

- `npm run build` passed on 2026-04-20.
- `npm test` still fails in `services/gemini.test.ts` because the existing test double does not provide `client.models.generateContent`; the failure message is `Cannot read properties of undefined (reading 'generateContent')`. That failure appears unrelated to this patch set.
