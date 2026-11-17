# Illinois traffic coverage

`illinois-traffic.js` adds public IDOT road-closure and construction reports for the same Greater St. Louis rectangle as MoDOT: longitude −91.2 to −89.4, latitude 38.1 to 39.2. It does not add a live Illinois crash feed, road speeds, driving delays or a routing engine.

## Verified official sources

The [IDOT Road Closures page](https://idot.illinois.gov/travel-and-maps/roadways/road-closures.html) links to [Getting Around Illinois Road Construction](https://www.gettingaroundillinois.com/RoadConstruction/index.html). That application's public configuration selects web map `ee4412b3b149497c81d6bcd78ccab9cb`, whose operational layers include all three sources used here:

- [ClosureIncidents, layer 0](https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/ClosureIncidents/FeatureServer/0): reported closure points, road, location, construction/closure type, dates and detour.
- [ClosureIncidentExtents, layer 0](https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/ClosureIncidentExtents/FeatureServer/0): published closure line segments, routes/directions, schedule, motorist text and work-time text.
- [Road_Construction_Public, layer 2](https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/Road_Construction_Public/FeatureServer/2): construction segments, dates, location and original comments, often including width restrictions.

The ArcGIS item owner is `IDOTAdmin`, organization `aIrBD8yn1TDTEXoz`, with public access and Illinois Department of Transportation attribution. The item terms are IDOT's accuracy/fitness disclaimer, not an asserted public-domain or Creative Commons license. We retain attribution and link to the official map. Direct JSON requests work with CORS `*`, without keys, registration or injected scripts. Site CSP needs `https://services2.arcgis.com` in `connect-src`.

Travel Midwest's [reuse policy](https://travelmidwest.com/About/InfoReusePolicy) and [FAQ](https://travelmidwest.com/Help/FAQs) describe a registered XML-download program and a five-minute minimum polling interval. This implementation does not register, scrape private feeds or imply those live speed/incident feeds are connected.

## Record contract and time honesty

`loadIllinoisTraffic({signal, fetcher=fetch, now=Date.now(), force=false})` returns `{records, status, checkedAt, receivedAt, sourceUpdatedAt, source, sourceURL, sources, coverageNote}`. `status` is `ready` or `partial`; every category appears separately in `sources`. If all categories fail, the call rejects. A missing category cannot erase successfully obtained categories or imply complete coverage.

Normalized records are compatible with `trafficFeature`: `selectionId`, `source`, official `sourceURL`, `lat/lng`, GeoJSON `geometry`, `geometryKind`, `locationNote`, road/direction, original description, impact, dates, `closed/crash`, `kind`, and `planned`. IDs are source-qualified (`idot:closure:…`, `idot:construction:…`). Official IDs are preferred; records without one use their event signature plus source object ID so ambiguous separate segments are retained.

Dates describe a reported schedule, not confirmation that crews or a road closure are physically present now. Expired reports are removed. Future starts are explicitly planned, never `closed:true`, and appear only within the next 30 days. Unknown starts remain `scheduleUnknown`; explicit reopened, canceled and completed descriptions are excluded. One closed lane is not promoted to an entirely closed road. Construction width limits do not become road closures or travel-delay estimates. Withdrawn reports disappear on the next successful refresh; the feed has no separate cancellation status field or cancellation push events.

These layers do **not** supply a per-record last-updated field. `updated/updatedAt/sourceUpdatedAt` remain null. `checkedAt/receivedAt` refer only to successful retrieval and keep their original age on cache hits. Source-layer edit timestamps were checked during research but are not assigned to individual events. Every normalization rechecks start/end validity against `now`, including cache hits.

Point and line records are joined only when location text and start/end timestamps match exactly, the join is unique in both directions, and the official point is within 150 meters of the official line. This is an explicitly conservative match of the source's parallel map layers, not an invented road segment. Ambiguous or distant records stay separate. The original point event ID is retained when its official extent is available. Original line vertices remain intact; map anchors are on supplied geometry within the regional rectangle. A point without a verified matching segment retains its point geometry and an explicit location note.

## Request and memory budgets

Cold loading issues three independent regional queries. Each requests only required fields, WGS84 output, a start/end window, and 200 records ordered by object ID. Pagination is followed only when the source explicitly reports truncation, with a maximum of 5 pages / 1,000 records per category. A repeated truncated page or exceeded cap fails that category rather than quietly truncating it. Each streamed JSON page is capped at 1 MiB; geometries are capped at 20,000 vertices per record and checked for actual intersection with the regional rectangle.

Three-minute in-memory reuse and in-flight deduplication are per fetcher, with exactly three source cache entries. Map and planted-flag consumers should use the same default fetcher to share requests. Subscriber cancellation is independent; when the last subscriber closes, that source request is aborted. A 12-second source deadline includes pagination. There are no timers or startup requests in the module: callers control visible-view refreshes. No credentials, referrer or HTTP redirects are permitted for source downloads.

## Checks

Run `node --test scripts/illinois-traffic-test.mjs`. Tests cover source IDs/timestamps, planned versus current status, expiry, reopened/canceled records, partial closures, regional geometry/anchors, conservative extent joins, bounded requests and payloads, pagination, partial failure, shared cache/receipt age and independent cancellation.

Live source check on 2026-11-17: IDOT returned 5 closure points, 5 corresponding closure extents and 29 regional construction records before date filtering. The current/upcoming query retained 17 construction schedules (49,229 bytes); normalization produced 22 reports, all with published segment geometry. Twelve expired construction records were excluded. The closure datasets had been edited that day. Counts reflect that check and are not promised future conditions.
