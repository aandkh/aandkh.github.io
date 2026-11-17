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
| Wildlife | Existing public research-grade observation adapter, queried at the pin; radius filters displayed approximate locations |
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
