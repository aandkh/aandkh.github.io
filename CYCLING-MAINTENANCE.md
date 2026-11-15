# Cycling routes

## Sources and scope

The combined regional directory uses Great Rivers Greenway's public **Completed** geometry, restricted to `ShowPublic = Yes` and `Internal_Status = Completed`. It is linked by the agency's GIS resource portal:

- Agency portal: https://greatriversgreenway.org/resources/gis-design/
- Public map: https://greatrivers.maps.arcgis.com/apps/instant/sidebar/index.html?appid=c74447caca8d4e3aa75441af79f1373f
- Public geometry: https://maps2.civildesigninc.com/arcgis/rest/services/GreatRiversGreenway/GRG_All_Projects_ReadOnly/FeatureServer/0
- Terrain: https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples
- USGS documentation: https://www.usgs.gov/3d-elevation-program
- Air data: the app's current EPA AirNow polygon feed, using the same timestamp and category rules as Air Quality.

28 named greenways / sections currently cover St. Louis City, County and nearby communities in one list. This is a maintained greenway directory, not a complete catalog of every possible bicycle ride. Some entries contain branches or separate mapped sections. Connections across gaps are **never invented**. Planned and under-construction features are excluded.

## Daily refresh

Dependencies: Python 3 standard library only; no packages or API keys. Run `python scripts/cycling-refresh.py`. A failed source request or unexpectedly small response leaves the prior JSON untouched; successful output is replaced atomically. The script downloads geometry, samples terrain approximately every 180 metres, and writes the static compact JSON. Elevation sampling occurs during refresh, never while a visitor opens the menu. Unchanged route geometry reuses its stored terrain profile and original `elevationCheckedAt`, so an ordinary daily refresh makes **one geometry request and zero elevation requests**. New or changed routes are sampled in batches of 60 points, at most four requests at once. Use `--cache-dir` for response caching during an interrupted refresh. Run `--refresh-elevation` monthly to deliberately resample unchanged terrain as well. DEM dates/resolutions vary, and bare-earth ground does not necessarily follow the deck of a bridge.

Review official trail pages for changed routes, flood damage, work zones and closures. The app does not label a completed route as open in real time. Confirm that city routes (Riverfront, River des Peres, Brickline) and county routes (Gravois, Meramec, Fee Fee, Cliff Cave) remain present. Never add a city/county toggle. A transient DEM failure for a changed route leaves unavailable terrain fields absent; it does not erase profiles for unchanged routes.

Run `node scripts/cycling-test.mjs` after refreshing. Confirm newly changed geometry and low elevation sampling coverage before publication. Do not delete route records merely because the DEM request failed; unsupported terrain/effort values remain absent and sort last. The refresher stores no unneeded staff names or management/budget fields from the GIS source.

## UI integration

- `enrichCycling(result)` replaces arbitrary path fragments with named greenways when the local snapshot is available; retains backend fallback if the snapshot is unavailable.
- `refreshCyclingAir(result, {airData})` joins current regional AQI to route samples. If no data is supplied, it requests one regional AirNow response; requests are deduplicated and cached for ten minutes. Call asynchronously after initial route display so air data does not delay browsing.
- `availableCyclingSorts(features)` only exposes sorts with available values. `sortCycling` always puts missing values last.
- `cyclingSummary` supplies compact result-card details; `appendCyclingDetails` shows distance, terrain range, effort estimate, an elevation profile and the method disclosure.
- Include `cycling-routes.css`. The details panel remains in the existing map-visible shell.

## Meaning of the metrics

Mapped length is the geodesic length of the displayed source geometry (with exact duplicate lines removed), including branches. It is not necessarily one continuous ride and is never doubled automatically for a return journey. Terrain range is the highest minus the lowest valid sampled ground elevation, **not cumulative ascent**. Profiles cover the longest connected mapped section. Terrain statistics require at least 95% sample coverage.

Effort is explicitly an Andymap estimate: `mapped miles / 6 + terrain range in feet / 200`. Below 1.5 is Easy; below 3.5 is Moderate; otherwise Long / hilly. This supports useful sorting without claiming an official technical rating. It does not assess traffic, surfaces, skills, fitness or temporary hazards.

Air sorting uses the highest current regional category intersecting route samples, requires at least 90% sample coverage and observations less than three hours old, and puts unknowns last. Unshaded regions are unknown, never clean air. These are interpolated regional areas, not trail-side exposure measurements.

No popularity control is exposed: aggregate greenway visit totals do not provide a comparable per-route popularity ranking. Add it only if genuine compatible route-level counts and their time periods become available.
