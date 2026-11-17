# Traffic controls and map key

`traffic-ui.js` supplies a compact key, native button filters, and a dedicated incident list. It does not fetch data or start timers. `traffic-ui.css` belongs in the normal UI bundle; there is no new floating launcher.

## Source semantics

The key imports its palette from `traffic-flow.js`, matching the TomTom **relative0** raster style verified against the existing proxy. The [official palette](https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/raster-flow-tiles) describes speeds relative to free-flow speed:

| Label | Color | Relative speed |
| --- | --- | --- |
| Moving well | `#2EAB30` | At least 75% |
| Slower | `#F1BF40` | 35% to below 75% |
| Heavy | `#F18237` | 15% to below 35% |
| Very slow | `#E70704` | Below 15% |
| Closed | `#C1272D` with pale dashes and gray outline | Reported closed |

Uncolored roads mean no displayed traffic data. Loaded transparent tiles do not establish clear traffic. Image time is explicitly **received**, using the oldest receipt among visible tiles when available. The source exposes no tile observation time. Errors and retained imagery remain visible in status text.

Reports come from [MoDOT](https://traveler.modot.org/mapv3/index.html) and [IDOT road work and closures](https://www.gettingaroundillinois.com/RoadConstruction/index.html), not comprehensive coverage of all crashes or local roads. A successful empty feed says no reports were returned. Failed, partial and unchecked feeds have distinct wording. List cards use the source's incident update time; source check time stays separate. Reported delays are displayed only when supplied by the data normalizer. Planned work is counted separately, labeled with its source start time, and never presented as a currently closed road.

## Integration

- `appendTrafficControls(host,{filter,onFilter,onBrowse,incidentState,idPrefix,format})` appends one filter group and optional browse action. Use the default `traffic` prefix in the sidebar; results use `traffic-results`, so rebuilds retain unique focus targets.
- `appendTrafficKey(host,{flowState,incidentState,format})` appends the road key, incident symbols, source state and links.
- `renderTrafficResults(host,{records,filter,query,bounds,onSelect,onFilter,format,state,idPrefix})` replaces a result host and returns `{element,records}`. `onSelect` gets the exact original record. Bounds accept Leaflet bounds or `{west,east,south,north}`. Without bounds, results cover the feed's regional scope.
- `format`, when supplied, receives an ISO timestamp. Defaults use America/Chicago, including date and time zone.
- `trafficIncidentIcon(kind)` and `TRAFFIC_INCIDENT_COLORS` are shared by the incident renderer. Icons are fixed SVG strings; source content is inserted with `textContent`.

Filters are `all`, `crashes`, `closures`, `other`. Closed crashes match both relevant filters; planned work is in Other. Query matches road, direction, incident type, impact, comments and location. Map bounds include source line segments crossing the view even when the representative point is offscreen. Sorting prioritizes closed roads, crashes, expected delays and possible delays, then distance to the map center and source update time. Planned work sorts after current reports. No invented delay or road segment is shown.

Traffic map badges stay as 40-pixel icons below zoom 14, with a small count for grouped reports. At zoom 14 and closer, the bubbles show the road, direction and reported impact. Tooltips and accessible labels retain the full report at every zoom. Source dots and leader lines continue to identify the actual reported locations; selecting a report isolates its exact location.

Run `node --test scripts/traffic-ui-test.mjs` for source-status, timestamp, exact selection, query, filter, ordering and safe-text regression checks. Browser layout is reviewed by the parent integration task in the managed preview.

Construction reports are excluded from traffic map icons, source dots and grouped counts unless the Road closures and construction layer is selected. This includes construction-related closures from MoDOT and IDOT. Crashes and other unplanned incidents remain eligible. Full source records stay available for explicit report selection.
