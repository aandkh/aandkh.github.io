# Point inspection

`spot-data.js` exports `createSpotInspector`, `SPOT_SECTIONS`, `spotContains`,
`spotDistanceMeters`, and `spatialFeatureItems`. The inspector never changes map
layers or the map viewport. It reports progressive sections through `onSection`;
`start()` loads the complete manifest. `dispose()` aborts requests and suppresses
all later callbacks. Root UI owns list paging and feature selection.

## Source coverage

| Sections | Point lookup |
| --- | --- |
| Geography | Containing Census county, municipality, school, Congressional, state legislative polygons and stored neighborhood polygons |
| Terrain | Containing USGS bedrock units, actual USGS 3DEP ground-elevation sample, actions for the existing raster reference maps |
| Population and housing | Containing ACS tract; every mode advertised by the existing API, including source period and original margins of error |
| Floodplains | Containing existing FEMA polygons; source simplification and regulatory scope retained |
| Forecast and air | Point forecast, identified nearby observation, and containing PM2.5/ozone AQI areas; unknown readings remain unknown |
| Alerts, traffic, outages | Current supplied alert footprints, MoDOT incidents, county electricity totals and dated official utility notices; unmapped records are counted separately |
| River levels and rainfall | Nearest supplied river gauges within 15 miles, existing rolling gauge baselines, and dated station rainfall with station distance |
| Sky | Point-calculated Sun/Moon times and phase, dated valid planetary angles, and the stored historical night-light grid |
| Wildlife | Public research-grade species counts in the selected radius over the past five years; current Chicago month weighs 85% and year-round local commonness 15% |
| Parks, cycling and joyrides | Actual polygon/route geometry distance; park analytics use the existing source snapshot |
| Quieter surroundings | Actual distance to the existing major-road geometry; not a decibel measurement |
| Aircraft, transit, construction, foliage | Existing live/reference adapters, with real footprint or point distance |
| All other displayed categories | Nearby indexed source records from the global search inventory, with lazy exact-record hydration on selection; includes food, venues, events, history, haunted folklore, birds, gyms, culture and public places |
| Radar | Existing observed/forecast radar view action; no fabricated point intensity from tile colors |

Unmapped records and unavailable sources never imply an all-clear or a count of
zero. Timed events disappear at their start, date-only events retain unknown start
time, upcoming events sort soonest first, and crime uses incident date with a
rolling seven-day view. Indexed incidents are explicitly approximate. County and
City share the same lookup architecture.

## Performance and lifecycle

- Cached-file reads and live calls each have an independent maximum of three
  concurrent requests. The compact catalog starts first, so live feed latency
  does not hold nearby source records behind weather requests.
- The decoded catalog has reusable geographic buckets. A new pin examines only
  intersecting buckets; decoding yields every 400 records. Static data uses a
  bounded 24-entry cache keyed to its reader, with a ten-minute lifetime.
- Full detail geometry is not downloaded for every nearby point result. Existing
  `searchItem` descriptors resolve the original feature only on selection.
- Polygon containment and line distance use actual geometry. Stored points are
  not substituted for missing polygon footprints. All available matches remain
  reachable; the UI bounds DOM rendering rather than silently cutting data.
- Point queries do not run generation jobs or alter daily maintenance scope.

## Relevant checks

`node --test scripts/spot-data-test.mjs scripts/spot-source-fixtures-test.mjs scripts/spot-terrain-test.mjs`

The tests cover real source contracts plus polygon holes, line distances,
temporal filtering, ordering, all-metric Census lookup, source failures, unknown
wind, approximate locations, cancellation, caching and independent read queues.

## Starting radius

A new flag defaults to exactly 100 feet (`100/5280` miles), shared by the map UI,
all nearby spatial lookups, catalog buckets and share-link validation through
`spot-radius.js`. The picker includes 100ft, 300ft, the existing 800ft option,
half a mile, one mile and three miles. Existing saved larger selections retain
their radius. Containing polygons still report the enclosing geography, and
explicit nearest-station references keep their documented wider search radius.
Wildlife source points remain rounded and labeled approximate.

## Visible matches and seasonal wildlife

The flag menu shows only sections with real entries. Pending, empty and failed
sections stay hidden; one compact status reports loading or a wholly empty
result. Navigation shortcuts alone do not qualify as a hit. Existing results
remain visible during refresh until replacement results arrive.

Only the flag uses `spot-wildlife.js`; the main Wildlife layer retains its
chosen date filters. Two fully paginated iNaturalist species-count queries use
the exact flag radius and the past five years: all months and the current
Chicago calendar month. Only species in the flag-radius baseline are eligible.

Ranking gives seasonal evidence 85% and local year-round commonness 15%.
With at least 20 current-month reports in the flag radius, seasonal evidence is
the species' share of those reports. When fewer are available, additional
queries within ten miles are restricted to the already-local species IDs.
Each species' nearby month/year rate weights its flag-radius baseline count;
those values are normalized into seasonal shares. Local evidence contributes
`min(1, localMonthReports / 20)` and nearby evidence supplies the remainder.
A species missing nearby evidence gets a neutral 1/12 rate, not a fabricated
observation. Rows distinguish nearby seasonal counts from flag-radius counts.
The section explains the evidence area and historical date window once.

These are reported occurrences, not population estimates, live sightings or
current weather predictions. Private, obscured and threatened-species records
remain excluded. Query failures never silently become annual fallback results.
A successful query with no seasonal reports is labeled explicitly. Duplicate
leaf taxa are not counted twice, and subspecies fold into their species using
source ancestors. Pagination is bounded at 10,000 taxa per query; an incomplete
query fails rather than displaying a biased ranking.

Species selection opens its profile with the original flag radius, dates and
month. An aggregate species never becomes a fabricated animal pin. Saved/shared
species views preserve the 100-foot radius (0.03048 km).

Primary source contract: https://api.inaturalist.org/v1/docs/ and
https://github.com/inaturalist/iNaturalistAPI/blob/main/lib/views/swagger_v1.yml.ejs.

Validation: `node scripts/spot-wildlife-test.mjs`, plus the existing spot data,
source-fixture, explorer UI, integration and wildlife share-state tests.
