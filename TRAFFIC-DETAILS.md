# Traffic reports, source facts and selected road segments

`traffic-details.js` converts official incident facts into readable road names and details. `IS55S` and `IS 55 S` become **I-55 · southbound**; `RV 70 E` becomes **I-70 reversible lanes · eastbound**; ramp connections retain each published road and direction. Unknown designation codes are not assigned an invented meaning. Reports sort by readable road names with numeric route sorting.

The November 17, 2026 source audit checked MoDOT's live regional categories and its published ArcGIS field schema. `DESIGNATION`, `DIRECTION`, `COUNTY_NAME`, `BEGIN_DESCRIPTION`, and `END_DESCRIPTION` were available but previously discarded. They now survive both bounded sandbox and parent validation. A current sample described an I-55 southbound crash, two left lanes closed, and start/end descriptions relative to the Imperial Main Street ramp. Such examples describe the audited source response, not a persistent claim about current traffic.

`EXT_COMMENT` is preserved as source text. Lane details are extracted only from explicit statements such as “2 left lanes closed”; a full-road closure code does not fabricate a lane count. A reported driving delay requires an explicit number of minutes described as a delay. `ESTIMATED_HOUR_DURATION` and estimated clearance clocks are not driving-delay estimates. An unknown delay is shown as **Not reported**.

## Integration contract

- `normalizeModotTraffic(feature, {now, receivedAt})` returns a current normalized record or `null`. Existing `id`, `lat`, `lng`, `title`, `road`, `description`, `delay`, `label`, `updated`, `closed` and `crash` remain available. `selectionId` is source-qualified (`modot:123`), while `id` remains the source DATA_ID. `kind` is `crash`, `closure` or `other`; `closed` remains independently available when a crash also closes a road.
- The record adds `roadName`, `direction`, `impact`, `lanes`, `from`, `to`, `county`, `geometry`, `geometryKind`, `locationNote`, `startedAt`, `updatedAt`, `expiresAt`, `source`, `sourceURL` and `receivedAt`. Expiry uses the earlier supplied end/deactivation time. Missing source dates remain null. Receipt never renews or substitutes for an incident update.
- `trafficFeature(record)` supports both MoDOT and normalized IDOT records, preserves actual Point/LineString/MultiLineString/Polygon/MultiPolygon geometry, and provides `trafficDetail: true` properties for the detail view. Its title includes the road and direction. Invalid supplied source geometry is rejected instead of replaced with a point. `trafficSummary(record)` provides the same readable title for lists; `compareTrafficRoads(a,b)` provides stable natural road ordering.
- `appendTrafficDetails(host, properties, {format})` shows impact, explicit lane facts, source location descriptions, known schedule/update times, and checked/dataset times separately. `_trafficUnconfirmed` or `trafficCurrentStatus: 'unconfirmed'` labels saved reports whose current state could not be established. `'not-active'` says the report is absent from latest active data without claiming that the road has cleared. `retained`/`stale` indicate delayed updates.

`trafficFeature` accepts IDOT `sourceUrl`, `startTime`, `endTime`, `checkedAt` and `sourceUpdatedAt` aliases. If IDOT supplies only a dataset timestamp, incident update remains **Time not supplied by source**. HTTPS source links are restricted to official MoDOT, Illinois, and Getting Around Illinois hosts, with credentials, ports and whitespace/control characters rejected. Source strings enter the DOM through text nodes.

## Geometry and bounded source access

MoDOT categories 0/5/9 publish representative **midpoints**. Those pins are labeled as reported locations and do not claim to mark the full affected segment or exact crash point. Their matching line layers are 13/18/22. The bridge supports these line layers only for a selected numeric DATA_ID; there is no new broad line polling. The renderer retains the original report pin while the selected source line is highlighted. An unavailable line does not produce an invented road segment.

`traffic-bridge.js` retains its opaque-origin sandbox and single approved MoDOT script origin. Line queries require a safe numeric ID, compare returned DATA_IDs, use the fixed regional envelope, and cap the response at 200 records, 64 paths per feature, and 20,000 vertices total. Extra ordinates are removed; longitude and latitude must be finite and in range. Broad midpoint paging retains the existing 2,000-record cap. Source-only user identifiers and unrelated fields are not transferred. Rebuild `traffic-bridge.html` with `node scripts/build-traffic-bridge.mjs` whenever the source changes; the generated CSP contains the exact script hash.

## Verification

Run `node --test scripts/traffic-details-test.mjs scripts/traffic-bridge-details-test.mjs`, `node scripts/traffic-security-test.mjs`, and `node scripts/build-traffic-bridge.mjs --check`. Tests cover road/ramp directions, the reversible roadway designation, lane-negation handling, unknown delay and timestamps, schedule/deactivation expiry, IDOT aliases, source geometry preservation, unsafe URL rejection, saved status language, exact-ID line requests, injection attempts, malformed paths, field filtering and response bounds.

Official source references:

- [MoDOT midpoint schema](https://mapsonline.modot.mo.gov/arcgis/rest/services/TravelerInformation/TravelerInformationMod/MapServer/0?f=pjson)
- [MoDOT traffic layer listing](https://mapsonline.modot.mo.gov/arcgis/rest/services/TravelerInformation/TravelerInformationMod/MapServer?f=pjson)
- [MoDOT crash-report manual, reversible roadway designation](https://epg.modot.org/forms/general_files/TS/MUCR_Manual.pdf)
- [Missouri Highway Patrol 2026 crash-report manual](https://www.mshp.dps.mo.gov/MSHPWeb/PatrolDivisions/PRD/documents/MUCRManual_01_01_26v7_2.pdf)

No comment-derived coordinates, guessed street routes, invented lane counts, estimated driving delays or inferred clearance are added.
