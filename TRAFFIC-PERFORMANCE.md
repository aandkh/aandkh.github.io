# Traffic loading and freshness

The colored roads and incident badges are separate sources. Flow comes from the existing TomTom tile proxy; badges come from three official MoDOT active-impact categories (closed, expected delays and possible delays). Incident duration never becomes a driving-delay estimate.

## Diagnosed behavior

- The app recreated the entire traffic raster when metadata refreshed, dropping every visible decoded tile while replacements loaded. Transient failed images had no retry.
- All three MoDOT queries were wrapped in `Promise.all`. A slow category delayed every badge; any failed category removed all previously shown reports.
- The sandbox rejected any response exceeding 200 records instead of following MoDOT's supported pagination. A truncated category therefore became a complete failure.
- A direct sample on November 17, 2026 returned all 14 requested center/adjacent flow tiles at zooms 9, 10, 11, 12, 14, 16 and 18 with HTTP 200 and 256×256 PNG dimensions. Observed request duration was 1.92–3.23 seconds in this environment. Some zoom 16/18 tiles were wholly transparent; other tiles showed roads. A blank source image is valid coverage data, not proof of failed loading. This sample did not reproduce a missing-tile server error.
- MoDOT's ordered regional queries returned 4 closed, 3 expected-delay and 0 possible-delay records in 2.59–2.63 seconds in a separate sample. Counts are observations from that check, not fixtures or promises of current road conditions.

## Implementation

`traffic-flow.js` uses Leaflet's public GridLayer/createTile APIs and draws the original 256×256 source pixels into canvas tiles. No road geometry, zoom detail, colors, coordinates or provider attribution changes. Native zoom support is 0–22, as documented by TomTom; it is not capped at a guessed low zoom.

Initial loading follows Leaflet's center-first tile order, with at most six image requests active. A failure retries once after 500 ms; each attempt times out after eight seconds. Tile pruning cancels images, timers and queued work. Cancellation during a zoom waits until the current synchronous pruning pass finishes before filling request slots. Intermediate animated zoom levels do not start unnecessary new tile grids. A two-tile buffer retains nearby decoded imagery.

Keep the existing flow layer when metadata refreshes and call `layer.refresh()`. Five-minute frame URLs request new data; unchanged frame requests do no work. Existing imagery remains visible until its replacement loads. An unsuccessful replacement leaves the last received pixels temporarily in place with a partial status. Each successful paint arms a ten-minute expiry timer that clears those pixels even if metadata requests and refresh callbacks stop. Repainting replaces the timer; removing a tile or layer cancels it. Expiry updates failure status without starting another request. This is a bounded UI fallback, never a claimed observation timestamp. Source/server caching can still affect observation age.

The helper emits `trafficstatus` with `{status,pending,failed,retained}`. Combine flow and incident status messages instead of allowing one source to clear the other's warning. The layer exposes `setOpacity` through GridLayer and `refresh` for the app's existing freshness scheduler.

MoDOT categories now publish independently. Successful categories refresh every three minutes; only failed categories retry after 30 seconds. Previously received reports survive a transient category failure for no more than six minutes, and their original receipt age is retained. End/deactivation times are evaluated again during snapshots. A 30-second visible-tab tick prunes expired records. Hidden tabs do not fetch. Superseded/disabled requests cannot publish late results. Gold selected pins remain excluded from ordinary incident badges as before.

The opaque sandbox pages in stable OBJECT_ID order, 200 records per page, up to 2,000 per category with a 20-second total deadline. A source beyond this defensive limit is explicitly unavailable, never silently truncated. Parent and sandbox both validate bounded plain data; JSONP never executes in the application origin. The exact bridge script remains authorized by its generated CSP hash.

## Validation

- `node scripts/traffic-security-test.mjs`: sandbox/source/origin/token checks, field limits, invalid payloads, abort/timeout cleanup, complete 201-record pagination and explicit capacity failure.
- `node scripts/traffic-performance-test.mjs`: first category publishes while others wait; failure does not erase other categories; independent retry; cache receipt age/record expiry; canceled generations; bounded tile concurrency; pruned queued work never starts; unchanged frame creates zero additional requests; refresh clears zero loaded tiles while pending; autonomous expiry without metadata or refresh callbacks; repaint rearming/removal/destruction cleanup; native zoom bounds.
- `node scripts/build-traffic-bridge.mjs --check`: generated HTML and CSP hash match reviewed source.

These are targeted behavioral tests and a small live network sample, not a claim of measured whole-site speed or low-end phone performance. Browser integration must also check pan/zoom, same-layer refresh, opacity, partial errors and selected incident pins. External feed latency, legitimate transparent traffic coverage, and unavailable categories remain possible.

## Primary references

- TomTom raster flow tiles and native zoom range: https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/raster-flow-tiles
- TomTom zoom-dependent road categories: https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/traffic-flow-service
- MoDOT layer metadata (supportsPagination, supportsOrderBy, OBJECT_ID): https://mapsonline.modot.mo.gov/arcgis/rest/services/TravelerInformation/TravelerInformationMod/MapServer/0?f=pjson
- Esri ordered pagination and exceededTransferLimit: https://developers.arcgis.com/rest/services-reference/enterprise/query-map-service-layer/
- Leaflet 1.9.4 public GridLayer API: https://leafletjs.com/reference-1.9.4.html#gridlayer
