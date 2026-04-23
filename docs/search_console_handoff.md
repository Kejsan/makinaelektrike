# Search Console Handoff

This checklist covers the manual Search Console work after deploying the SEO build.

## Submit The Sitemap

1. Deploy the production build.
2. Open Google Search Console for `https://makinaelektrike.com/`.
3. Submit `https://makinaelektrike.com/sitemap.xml` in the Sitemaps report.
4. Recheck the report after Google processes it and fix any parsing errors before requesting manual indexing for individual URLs.

Google's Sitemaps report expects the sitemap to be hosted on the site; it does not upload a local file to Google.

Reference: https://support.google.com/webmasters/answer/7451001

## Inspect Priority URLs

Use URL Inspection after deployment for:

- `https://makinaelektrike.com/`
- `https://makinaelektrike.com/en`
- `https://makinaelektrike.com/it`
- `https://makinaelektrike.com/help-center/`
- `https://makinaelektrike.com/albania-charging-stations/`
- one dealer detail URL
- one model detail URL
- one translated blog detail URL once translated content exists

For each URL, run the live test, check the rendered HTML, confirm the Google-selected canonical, and review structured data/enhancement output.

Reference: https://support.google.com/webmasters/answer/9012289

## Hreflang Rules

Only advertise a localized URL as an alternate when the main content is actually translated. This is why blog article detail pages only emit `/en/...` or `/it/...` static HTML and sitemap alternates when the post has a usable translation.

Google notes that localized versions are considered duplicates if the main content remains untranslated, and each real language version must list itself and the other available language versions.

Reference: https://developers.google.com/search/docs/advanced/crawling/localized-versions

## Optional API Diagnostics

For recurring monitoring, connect the Search Console URL Inspection API to inspect a small set of representative URLs after deploys. This API exposes URL-level index data for properties managed in Search Console.

Reference: https://developers.google.com/search/blog/2022/01/url-inspection-api

## Local Predeploy Check

Run:

```bash
npm run build
npm run seo:validate
```

The validator checks generated HTML for canonicals, self `hreflang`, `x-default`, localized internal links, JSON-LD schema type corruption, localized `/en` and `/it` output, and blocked third-party image hosts.
