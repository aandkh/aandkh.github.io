# Bird observation analytics

`birding-analytics.js` queries public iNaturalist v1 for research-grade, wild, georeferenced bird reports (taxon 3, Aves). Local cards use a clearly labeled radius; the regional view uses one bounding box spanning City and County. Dates are **observation dates**, not upload dates. Default range is January 1 four years before the current year through today; the user can change dates.

## What is calculated

- Identified taxa and report counts: `/observations/species_counts`; up to five pages of 200, with explicit incomplete-list labeling. Taxa may include species or finer identifications; do not relabel this as an exhaustive count of biological species living there.
- Month-of-year counts: `/observations/histogram?interval=month_of_year&date_field=observed`. These are source aggregate counts across the selected dates, not counts from the limited displayed map sample.
- Seasonal list comparison: independently fetch full taxon lists for winter (December/January/February), spring, summer and fall. Shared and season-only taxa are set operations. Overlap is intersection divided by union (Jaccard), with no percentage when both sets are empty. If either list hits the cap, suppress that comparison. Seasons pool calendar months across selected years; this is not a paired ecological trend estimate.
- First reports by year: for a selected taxon, query ascending `observed_on`, one record per year, with the selected date boundaries. At most the last five years of the selected range. Display the original observation link and matching report count. This is not a migration-arrival estimate.
- Species selection updates its monthly counts and can hand the same geography/date/taxon filter to Wildlife for source observations on the map.

The shared wildlife reader caches responses for 30 minutes and serializes requests approximately one per second. Do not run a daily static bird guide audit. API errors do not mean species absence; show retry/error states. Parent must call the returned `destroy()` when removing the panel so queued requests are canceled.

## Deliberate data limits

No encounter probability, effort-adjusted abundance, checklist-normalized frequency, true arrival trend or statistically supported habitat association is inferred from opportunistic iNaturalist observations. These require suitable effort/sampling information and environmental datasets. Preserve documented habitat descriptions on the existing spot cards. Do not add empty controls for unsupported statistics.

No photos, observation descriptions, private locations or observer personal profiles are copied into the analytics. Source credit links to iNaturalist contributors and the exact filtered observation query; annual first records link to their original public observation pages. Wildlife controls map coordinate privacy separately.

## Primary sources checked November 16, 2026

- iNaturalist API v1 documentation: https://api.inaturalist.org/v1/docs/
- iNaturalist API source / endpoint specification: https://github.com/inaturalist/iNaturalistAPI/blob/main/lib/views/swagger_v1.yml.ejs
- Cornell eBird analytical best practices (complete checklists, effort, spatial and temporal bias): https://ebird.github.io/ebird-best-practices/ebird.html

Live tests at the Forest Park reference location (38.63822, -90.28433), radius 5 km, 2022-01-01 through 2026-11-16: winter species endpoint returned 68 taxa; month histogram returned all 12 month buckets. This is a source-function verification, not a promise of constant counts. Current values are loaded from the source when opened.

Run `node scripts/birding-analytics-test.mjs` after changing these calculations or query semantics, not during unrelated daily refreshes.
