# Official regional weather alerts

`weather-alerts.js` is the sole live NWS warning controller. The app enables serious warning checks independently of the Weather checkbox; Emergency alerts selects the complete watch/advisory list through `setShowAll(true)`. Do not also fetch or draw the former generic alerts layer.

## Source and regional coverage

A direct `api.weather.gov/alerts/active` request uses `status=actual` and all 24 county UGC identifiers intersecting longitude −91.2…−89.4, latitude 38.1…39.2. The list was verified on November 17, 2026 against NOAA's NWS reference-map county layer using a spatial intersection query. It includes Perry County, Illinois, which belongs to the Paducah forecast office; restricting all alerts to LSX would miss that edge of the region.

NWS's geolocation guide specifically recommends county identifiers for queries that must include both county warnings and forecast-zone products. A forecast-zone-only query can omit tornado and severe-thunderstorm warnings. The feed further checks supplied polygons against the regional rectangle, including holes, rather than assuming the entire issuing office or county is inside the region.

Current live checks of the exact county query and `zones/forecast/MOZ063` both returned HTTP 200 without redirects. The observed active-alert response contained zero records; the zone endpoint returned a Polygon. This observation is not a continuing all-clear. Offline tests use explicitly synthetic CAP-style fixtures; no demonstration alert is shipped as live data.

Primary source references:

- API and alert filtering: https://www.weather.gov/documentation/services-web-api
- Current API schema: https://api.weather.gov/openapi.json
- County/zone query behavior and missing-polygon guidance: https://www.weather.gov/media/documentation/docs/NWS_Geolocation.pdf
- CAP documentation: https://www.weather.gov/documentation/services-web-alerts
- Official county/public/fire boundary services: https://mapservices.weather.noaa.gov/static/rest/services/nws_reference_maps/nws_reference_map/MapServer
- County intersection query: `/2/query?f=geojson&where=1%3D1&geometry=-91.2,38.1,-89.4,39.2&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=false&outFields=*` on that reference service.

County codes in the module are stable political boundaries; the prioritization list of forecast zones comes from reference layer 8. Recheck these lists if NWS announces boundary changes. The prioritization list never excludes an unfamiliar forecast-zone URL: needed unknown zones remain eligible within the bounded lookup budget.

## Alert semantics and freshness

Only Actual Alert/Update messages with valid issuance time and a future information-expiry time survive normalization. Tests, exercises, drafts, invalid dates and implausibly future issuance times are excluded. A five-minute issuance clock-skew tolerance accommodates small client clock differences. Valid Update/Cancel references suppress superseded messages. The earlier of CAP `expires` and a supplied `ends` determines removal. Future onset does not invalidate an already issued warning.

A red exclamation badge requires a Warning (or Evacuation Immediate) with NWS Severe/Extreme severity. The tornado SVG is used only for an actual qualifying Tornado Warning, never a watch, forecast or radar shape. Watches/advisories use a quieter amber information treatment when the user enables all alerts. Labels say Current so warnings cannot be mistaken for dated forecast frames. When source checks fail or age past five minutes, retained alerts say updates are delayed. Valid unexpired received warnings remain visible during an outage, and are removed at their own CAP expiry by an independent timer. A failed or old check never produces an all-clear state.

Visible tabs poll at most every 90 seconds; the explicit Retry action may force a check. One refresh is shared while pending, each HTTP request times out at ten seconds, and the total operation has a thirty-second abort deadline. Hidden tabs abort pending work and do not poll. Controller removal aborts the request; destruction removes listeners and timers. Queries use no cookies/referrer and reject redirects to preserve the official-host boundary.

## Geometry and presentation

The original GeoJSON polygon is preserved. For a missing polygon, only validated `https://api.weather.gov/zones/{county|forecast|fire}/{MO|IL}...` links are fetched, at most three concurrently and 64 distinct URLs per refresh. Nonregional county links are skipped; known regional public zones are prioritized. Valid boundaries are cached for one day in a 96-entry LRU cache. Alert polygons render immediately while missing boundaries load. Partial failures are reported; unmapped alerts remain available in the list with their official area description, never as invented exact-location pins.

Zone fallback combines the official polygons without changing the raw alert feature. The badge and details label this area-wide coverage. It does not claim a tornado or lightning strike at a zone centroid. Full official description, instruction, expiry and source link remain accessible. Shared badge reservations place warnings after controls/selected pins and before traffic, places and weather cards; the `alerts` reservation priority is 5. Warning areas use pane 470, badges 650, below the selected-pin pane.

## Integration contract

`createWeatherAlerts(map,{onStatus,onSelect,showAll,fetcher,now})` returns `setVisible`, `setShowAll`, `refresh`, `getState` and `destroy`. Construction does not fetch; `setVisible(true)` starts checks. The default drawing includes only serious warnings. `onSelect(record)` may open app details; without it, the controller opens an accessible Leaflet popup containing the official text.

State includes `status`, `checkedAt` (receipt time in milliseconds), `alerts`, `features`, `count`, `dangerousCount`, `unmappedCount`, `partialCount`, `resolving`, `note` and `showAll`. `features` are the original current GeoJSON objects for storm-motion parsing, including CAP parameters and unchanged raw descriptions.

Normalized records include `id`, `feature`, `geometry`, `areaWide`, `event`, `headline`, `description`, `instruction`, `areaDesc`, `senderName`, `sentAt`, `effectiveAt`, `onsetAt`, `expiresAt`, `severity`, `urgency`, `certainty`, `sourceURL`, `dangerous`, `tornado`, `warning`, `kind`, `icon`, `color`, `stale` and `lastCheckedAt`. Expiry/issuance are validated milliseconds; optional effective/onset values can be NaN and must be checked before formatting. The original feature's null geometry stays null even when a separate normalized fallback geometry becomes available.

## Validation

Run `node scripts/weather-alerts-test.mjs`. It covers Actual/Update/Cancel relationships, invalid issuance times, expiration and earlier event ending, exact regional intersections and holes, serious-only/tornado presentation, county-query coverage, safe zone URLs, cached fallback boundaries, immediate polygon publication, shared refresh, stale warning retention and autonomous actual expiry, source-property preservation, and aborted late responses. Browser integration additionally checks the compact banner, red/tornado badges, overlap priority, official details, and current-warning labels during dated forecasts.
