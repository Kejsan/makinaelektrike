# Charging Stations in Albania Page

The `/albania-charging-stations` route displays live data from Open Charge Map with a clustered Leaflet map, synced list view, and SEO content. This document outlines configuration knobs and maintenance tips.

## Environment variables

The page expects an Open Charge Map API key on the server side. Provide it to Netlify or your local dev server using `OCM_API_KEY`.

```
OCM_API_KEY=your_open_charge_map_key
```

If no key is supplied the server proxy will reject requests. Always configure a dedicated key for production and local development to avoid disruptions.

## Map defaults

The default map centre and zoom are set in `pages/ChargingStationsAlbaniaPage.tsx`:

```
const DEFAULT_CENTER: [number, number] = [41.3275, 19.8187];
const DEFAULT_ZOOM = 8;
```

Update these constants to change the initial viewport (for example to focus on a different Albanian region).

## Query behaviour

Fetching logic lives in `services/ocm.ts` and `pages/ChargingStationsAlbaniaPage.tsx`.

- `maxresults` is currently capped at 200 to balance coverage and performance.
- Auto-update re-queries OCM when the user pans/zooms with a 450 ms debounce.
- Manual searches reuse the latest bounds when you press “Search this area”.

Adjust the options in `fetchStations` or the debounce timing inside `handleMapMove` if you need different performance characteristics.

## Search and export controls

The search input filters the in-memory station list by title, operator, and address. Adjust the predicate in `visibleStations` inside `pages/ChargingStationsAlbaniaPage.tsx` if you need additional matching rules.

The CSV/JSON exports are generated client-side from the currently visible stations. Adjust the columns inside `exportData` if you need additional attributes.

## Shareable URLs

The page syncs the search term, map position, auto-update state, and the selected POI to the query string. When adding new URL parameters update both the effect that calls `setSearchParams` and the `shareStation` helper so deep links stay aligned.
