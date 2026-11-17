# Traffic loading and freshness

The colored roads and incident badges are separate sources. Flow comes from the existing TomTom tile proxy; badges come from three official MoDOT active-impact categories (closed, expected delays and possible delays). Incident duration never becomes a driving-delay estimate.

## Diagnosed behavior

- The app recreated the entire traffic raster when metadata refreshed, dropping every visible decoded tile while replacements loaded. Transient failed images had no retry.
- All three MoDOT queries were wrapped in `Promise.all`. A slow category delayed every badge; any failed category removed all previously shown reports.
- The sandbox rejected any response exceeding 200 records instead of following MoDOT's supported pagination. A truncated category therefore became a complete failure.
- A direct sample on November 17, 2026 returned all 14 requested center/adjacent flow tiles at zooms 9, 10, 11, 12, 14, 16 and 18 with HTTP 200 and 256×256 PNG dimensions. Observed request duration was 1.92–3.23 seconds in this environment. Some zoom 16/18 tiles were wholly transparent; other tiles showed roads. A blank source image is valid coverage data, not proof of failed loading. This sample did not reproduce a missing-tile server error.
- MoDOT's ordered regional queries returned 4 closed, 3 expected-delay and 0 possible-delay records in 2.59–2.63 seconds in a separate sample. Counts are observations from that check, not fixtures or promises of current road conditions.
- A later cold image sample returned valid PNGs in 9.30–9.49 seconds. The original eight-second attempt deadline could cancel these successful requests before they finished, causing unnecessary retry/partial-map behavior. Warm sample requests took approximately 3.8 seconds.
- Actual proxy imagery contains the TomTom `relative0` palette, including exact opaque green `#2EAB30` and amber `#F1BF40` pixels. Its green band includes speeds at least 75% of free flow; it must not be labeled as proof of full-speed or uncongested travel. The renderer now exports the verified legend for the controls/key to share.
- **Upstream availability defect, independently reproduced:** a no-cache request for `/api/traffic/10/258/392.png?trafficFrame=5982954` returned HTTP 503 with the public error `Traffic key not configured` and `Cache-Control: no-store`, while the adjacent x256 tile returned a 7,951-byte PNG. At the same time, `/api/capabilities` still advertised traffic and `/api/layers/traffic` reported `status: live`. This does not establish whether working images came from cached content or another backend path. Actual visible image health must take precedence over the generic metadata. Repairing the separate API configuration is outside this frontend repository.

## Implementation

`traffic-flow.js` uses Leaflet's public GridLayer/createTile APIs and draws the original 256×256 imagery into canvas tiles. A light under-stroke expands source color by at most 0.45 CSS pixels at regional zoom, or 0.2 at closer zoom; the original image is then drawn last at its exact original position. This makes narrow roads legible while retaining provider colors and centerlines. Existing white road edging separates them from the base map/weather. No image readback, geographic inference, invented roads or numeric speed inference is used. Transparent imagery stays transparent. Native zoom support remains 0–22.

Initial loading batches Leaflet's synchronous tile list and prioritizes the current viewport center, with at most eight requests active. Only tiles intersecting the current viewport at its current native zoom may consume a slot. Loaded parent/offscreen tiles can remain as a backdrop, but don't compete with visible replacements or participate in refresh downloads. Pan/zoom updates cancel departed-view requests and reprioritize the queue. Such cancellation is not reported as a source failure. A two-tile buffer retains nearby decoded imagery; revisiting it preserves original receipt ages and refreshes it only when needed.

A failure retries once after 500 ms; each attempt now has a 12-second deadline. A failed tile has a 30-second cooldown so repeated small pans cannot repeatedly restart a failing source. Explicit `layer.refresh()`/`queue.refresh({force:true})` bypasses that cooldown. Unloading cancels images, retries, receipt expiry and pump timers. Refilling waits until the synchronous pruning pass completes. Intermediate animated zooms do not start unnecessary grids.

For a bounded live comparison, two interleaved sets of 20 regional zoom-10 tiles took 13.33 seconds with concurrency six and 9.14 seconds with concurrency eight. Each set returned 12 valid PNGs and eight HTTP 503 responses, with successful-request median approximately 3.1 seconds. No additional errors appeared at eight. The sets differed spatially and this is one network sample, not a general performance guarantee or browser benchmark. The same upstream configuration issue explains why a concurrency change alone cannot make all tiles available.

Keep the existing flow layer when metadata refreshes and call `layer.refresh()`. Five-minute frame URLs request new data; unchanged frame requests do no work. Existing imagery remains visible until its replacement loads. An unsuccessful replacement leaves the last received pixels temporarily in place with a partial status. Each successful paint arms a ten-minute expiry timer that clears those pixels even if metadata requests and refresh callbacks stop. Repainting replaces the timer; removing a tile or layer cancels it. Expiry updates failure status without starting another request. This is a bounded UI fallback, never a claimed observation timestamp. Source/server caching can still affect observation age.

The helper emits `trafficstatus` with `{status,pending,failed,retained,total,available,receivedAt,oldestReceivedAt,observedAt:null,coverage:'unknown',scope:'visible'}`. Every count and receipt bound refers only to the current visible zoom. Zero visible tiles is `idle`; `ready` means images loaded, not all roads covered or clear. `receivedAt` is the newest successful image receipt and `oldestReceivedAt` is the oldest still displayed receipt. Neither is a traffic observation time. Transparent pixels are not interpreted as free flow. The controller does not rely on pixel readback/CORS to distinguish empty imagery.

Combine flow and incident status messages instead of allowing one source to clear the other's warning. The layer exposes `setOpacity` through GridLayer and `refresh` for the app's existing freshness scheduler. `TRAFFIC_FLOW_SOURCE` and `TRAFFIC_FLOW_LEGEND` provide one consistent provider source and verified five-band legend to the UI. Unknown/uncolored coverage remains a separate caveat, never a green legend item.

MoDOT categories now publish independently. Successful categories refresh every three minutes; only failed categories retry after 30 seconds. Previously received reports survive a transient category failure for no more than six minutes, and their original receipt age is retained. End/deactivation times are evaluated again during snapshots. A 30-second visible-tab tick prunes expired records. Hidden tabs do not fetch. Superseded/disabled requests cannot publish late results. Gold selected pins remain excluded from ordinary incident badges as before.

The opaque sandbox pages in stable OBJECT_ID order, 200 records per page, up to 2,000 per category with a 20-second total deadline. A source beyond this defensive limit is explicitly unavailable, never silently truncated. Parent and sandbox both validate bounded plain data; JSONP never executes in the application origin. The exact bridge script remains authorized by its generated CSP hash.

## Validation

- `node scripts/traffic-security-test.mjs`: sandbox/source/origin/token checks, field limits, invalid payloads, abort/timeout cleanup, complete 201-record pagination and explicit capacity failure.
- `node scripts/traffic-performance-test.mjs`: first category publishes while others wait; failure does not erase other categories; independent retry; cache receipt age/record expiry; canceled generations; bounded tile concurrency; pruned queued work never starts; unchanged frame creates zero additional requests; refresh clears zero loaded tiles while pending; autonomous expiry without metadata or refresh callbacks; repaint rearming/removal/destruction cleanup; native zoom bounds.
- `node scripts/traffic-flow-test.mjs`: actual relative0 legend; current-zoom center priority; cancellation of departed views; visible-only status and receipt age; offscreen refresh suppression; nine-second successful images; failed-pan cooldown/explicit retry; hard eight-request limit; exact final source draw and subpixel under-stroke; native GridLayer view/listener cleanup.
- `node scripts/build-traffic-bridge.mjs --check`: generated HTML and CSP hash match reviewed source.

These are targeted behavioral tests and a small live network sample, not a claim of measured whole-site speed or low-end phone performance. Browser integration must also check pan/zoom, same-layer refresh, opacity, partial errors and selected incident pins. External feed latency, legitimate transparent traffic coverage, and unavailable categories remain possible.

## Primary references

- TomTom raster flow tiles and native zoom range: https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/raster-flow-tiles
- TomTom zoom-dependent road categories: https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/traffic-flow-service
- MoDOT layer metadata (supportsPagination, supportsOrderBy, OBJECT_ID): https://mapsonline.modot.mo.gov/arcgis/rest/services/TravelerInformation/TravelerInformationMod/MapServer/0?f=pjson
- Esri ordered pagination and exceededTransferLimit: https://developers.arcgis.com/rest/services-reference/enterprise/query-map-service-layer/
- Leaflet 1.9.4 public GridLayer API: https://leafletjs.com/reference-1.9.4.html#gridlayer
