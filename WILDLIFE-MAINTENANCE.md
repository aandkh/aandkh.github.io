# Wildlife variety

`wildlife.js` queries the public iNaturalist v1 API without authentication. It uses research-grade, wild (`captive=false`), georeferenced observations at species rank or below, with `geoprivacy=open`, `taxon_geoprivacy=open`, `obscuration=none`, and `threatened=false`. The regional bounding box covers St. Louis City and County together and neighboring regional land: southwest 38.3,-90.85; northeast 38.99,-89.95. A report is not proof of continued presence, animal abundance, native status, access permission, or a complete inventory.

## Source and queries

- Official API: https://api.inaturalist.org/v1/docs/
- Official usage rules: https://www.inaturalist.org/pages/api+recommended+practices
- Observations `/v1/observations`, sorted by observation date descending, 200/page. Start at one page; explicit load-more reaches five pages/1,000 records. API total_results is shown separately from the downloaded/map sample.
- `/v1/observations/species_counts`: full matching query taxon count, and 200 leading taxa with report counts. Label these as taxa, not a census of species: subspecies can be represented. The picker cap is disclosed. Narrowing group/date/month supplies a new query.
- `/v1/observations/histogram?date_field=observed&interval=month_of_year`: full-query monthly observation counts. This is report timing, not biological abundance or an effort-adjusted detection probability.
- Species name search uses official `/v1/taxa/autocomplete` with `rank=species`, `is_active=true`, `per_page=8`, `locale=en`. It shares the request queue/cache, debounces typing for 350ms, cancels superseded requests, and only offers returned active species IDs. Suggestions are global species names; regional absence is shown as zero reports, not inferred presence.
- User-selected group, taxon, date bounds and month apply to all three queries. The default is the preceding year through today.
- Requests are serialized at at least 1.05-second spacing and successful responses cached for 30 minutes. Birding can share `readWildlifeJson` and `wildlifeQuery` to use the same rate limiter. All requests have timeouts. Do not bulk-download historical observations as a routine job.

## Location protection and attribution

Never map private, obscured, taxon-obscured, captive, non-research-grade, or explicitly threatened-taxon records. Do not infer hidden coordinates. Remaining public observation coordinates are rounded to 0.01 degrees (about 1 km) and clearly labeled approximate. If the source supplies poorer accuracy, state that too. No raw user descriptions, private coordinates or home-address text are copied. Species illustrations use separately verified reusable photographs with photographer, license and original source links. Each point retains the original observation date, observer credit, source link, taxon ID/scientific name, and returned observation license code. A species-information link points to iNaturalist. Source credit is visible in the controls and details.

## Verified snapshot

`wildlife-snapshot.json` was generated November 16, 2026 from the same adapter and official live API, query November 16, 2025–November 16, 2026. The API returned 51,100 matching reports and 3,330 recorded taxa. The first three pages supplied 600 records; privacy/validity filtering left 600 map points. Full-query histogram and species-count aggregates are included; the 200-taxon picker is a subset.

Fallback preserves its real query range and checkedAt. It is used only for an identical selection or the initial unfiltered default; its actual older date range is shown. A failed custom filter never receives unrelated cached records. Source failures in secondary aggregates retain useful observation pins and label the missing aggregate. If the observation query fails and no faithful fallback applies, show unavailable.

The snapshot is a failure fallback, not a promise of always-current sightings. On-demand successful requests supply current records. Refresh this small default snapshot when there is a relevant dynamic-data change or adapter repair; do not add a static full-site audit. Tests: `node scripts/wildlife-test.mjs` after adapter changes.

## Heatmap default

Wildlife opens with the official iNaturalist `/v1/heatmap/{z}/{x}/{y}.png` tiles at `tiles.inaturalist.org`, verified against the official v1 Swagger contract. Tiles use the entire matching public query, not the capped newest-record list. Group, species, date and month filters affect both. The qualitative purple-to-red scale is observation concentration, not population density, habitat extent, or species richness. Observer effort affects it. Individual reports remain available as a view switch and list. The 512px provider images display on ordinary 256px XYZ tiles; native zoom is capped at 13 and stretched above it rather than adding false precision. Partial/failed tile loads have local status text. No zoom-to-fit changes.

The default fallback snapshot carries `queryPolicy=public-unthreatened-v2`; older aggregate snapshots without those source-side privacy constraints must not be substituted for the new filtered query. Test with `node scripts/wildlife-heat-test.mjs` and `node scripts/wildlife-test.mjs`.

## Species drill-down and dates (November 16)
Groups expose a paginated list of documented taxa, with per-query report counts.
Opening a species fetches its iNaturalist taxon record on demand; sourced Wikipedia
summaries and classification appear inside the inspector. Photos are included only
for CC0/CC BY/CC BY-SA with supplied attribution; missing descriptions/images are
not invented. The species action filters the map and keeps current dates/group.
Observation details also open species profiles. Date filtering uses the shared
two-handle date-range control. Species descriptions remain cached runtime reference
material, not an added daily research task.

## Species photographs and frequency ordering (November 17)

`species-photos.json` is loaded only when a species list or profile is shown.
`wildlife-photos.js` shares one metadata fetch, validates exact taxon IDs, and
accepts only CC0/CC BY/CC BY-SA images on the iNaturalist image hosts, with
photographer credit and original source links. Collapsed species rows show lazy
80×64 thumbnails; profiles and selected observations show larger source images.
Native photo pages preserve license versions for imported material; supplied
Creative Commons URLs are retained rather than inventing a version.

If an opened species is uncached, taxon metadata is checked for usable alternate
photos as well as its default. The runtime does not choose unreviewed observation photos when the taxon gallery
has no reusable image; that species remains without a photograph. Each image's
own license is checked; an observation license is insufficient. Offline
observation-photo sourcing requires visual review before adding to the catalog.
No artificial substitutes are used for missing photos.

Species-count queries explicitly request count descending. Species and the
downloaded report list default to that order; Name A–Z is still selectable and
shared state preserves it. Counts describe local observation reports, not an
effort-adjusted abundance estimate. The newest reports remain the underlying
downloaded sample, ordered for display by the full-query counts when available.

Tests: `node --test scripts/wildlife-photos-test.mjs`, existing wildlife request,
share-controls, heatmap and data tests.

Uncached list thumbnails use IntersectionObserver (100px margin) to start only
when the row approaches the visible viewport. At most two resolvers enter the
shared API queue; waiting work is capped at 64 and detached/aborted rows are
discarded. Completed photo results (including no reusable image) have a bounded
128-entry, 30-minute cache. Without IntersectionObserver, hover/focus or opening
the species initiates resolution. List redraws dispose old observers. Selected
observation cards use the same exact-taxon curated-gallery fallback directly.
