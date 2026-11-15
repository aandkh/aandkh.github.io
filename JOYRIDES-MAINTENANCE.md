# Joyrides

Twenty-seven continuous public-road touring loops/corridors combine St. Louis city,
St. Louis County, and nearby Missouri/Illinois river-country drives. The list is
regional, with no city/county toggle. Every map line comes from OSRM's OSM driving
graph through audited named-road waypoints. No straight-line route links are
invented. These are Andymap selections; area guides do not endorse the itineraries.

Eleven additions were researched in actual driving-community discussions:
Ossenfort/Melrose/Bouquet; Route T through St. Albans and Labadie; Meramec
Bottom/Baumgartner; Highway 79 from Winfield to Elsberry; Route F to New Melle;
D/DD toward Broemmelsiek; Femme Osage Creek; Cappeln Osage's D/T loop;
Pere Marquette's bluff loop; Beaumont–Antire to High Ridge; and Old Lemay Ferry
toward Sandy Creek. Their `communityMentions` retain the source URL, concise
attributed explanation, known post date and actual review date. Those dates are
not renewed by the daily cache pass. Community recommendation details are
visible in the route card, separate from calculated metrics.

Forum descriptions are leads, not geometry or current road-condition evidence.
The Antire post loosely refers to Eureka, but the mapped public corridor actually
ends in High Ridge. The Highway 79 discussion recommends a longer drive toward
Hannibal; the included route clearly identifies its regional Winfield–Elsberry
segment. The Cappeln rider report covers a one-way road; Andymap adds the real
D/T return to make a loop. Extra waypoints keep OSRM from taking a quicker
Brandt Lane/T shortcut that bypasses the recommended Cappeln Osage road.

Known access context has its own source link/date. Route T carries the MoDOT
2026 work-project link. Illinois DNR listed Pere Marquette Scenic Drive open
when checked November 15, 2026; park hours and changing closures still apply.
Sandy Creek ends on the public approach road and never crosses the preserved
pedestrian covered bridge. An old Ossenfort tree-removal closure was checked
and identified as a February 2026 notice, not misrepresented as a current closure.

## Runtime contract

`joyrideRoutes()` returns a cached promise for the local FeatureCollection.
`sortJoyrides(features, key, center)` returns a new array. `JOYRIDES_SORTS` and
`availableJoyrideSorts(features)` provide the applicable sort controls; unsupported
metrics do not get disabled placeholder controls. `joyrideSummary(properties)`
provides list text. `appendJoyrideDetails(host, properties, {onHighlight})` adds
the profile, metrics, route waypoints, sources, and methodology. Optional
`onHighlight(geometry, {label,startMile,endMile})` receives the actual longest
straight or steepest sampled-terrain line, for highlighting without changing the
user's camera unless the user specifically asks to focus it.

The local snapshot is small and contains all geometry, terrain profiles and
metrics. Browsing never calls routing/elevation services and never performs heavy
terrain computations. Fetches are deduplicated and cached for five minutes. No
visitors' locations are uploaded to any generator/data source.

## What the numbers mean

- **Miles/time:** OSRM road distance and driving-profile duration. Time excludes
  live traffic, stops and parking. One-way/loop is visible; no return distance is
  quietly added.
- **Terrain range:** high minus low USGS sampled bare-earth elevation.
- **Estimated climb/descent:** ground sampled every 200 m, smoothed with a
  three-sample median, then 3 m vertical hysteresis to suppress small DEM chatter.
  Net elevation is final minus first smoothed elevation.
- **Sustained terrain grade:** largest absolute elevation change between samples
  at least 590 m apart (normally three 200 m intervals), divided by actual sample
  distance. It is not an instantaneous maximum road grade. Bridges and tunnels
  may differ materially from the ground below them.
- **Turning intensity:** resample routed geometry every 50 m; sum heading changes
  of at least 3°, divided by miles. This includes junctions. Direction-change
  groups join successive changes of at least 5° and count groups totaling 30°.
- **Longest straight:** consecutive 50 m geometry samples staying within 12° of
  the initial bearing and within 30 m of their endpoint chord. This does not imply
  an uninterrupted road: signals, entrances, crossings and junctions may occur.

All elevation samples must be present before cumulative climb or sustained grade
is exposed. Missing data never becomes zero. There is no fabricated popularity,
road-safety, driving-skill or speed score. These are geometry comparisons, not a
recommendation to drive fast. Map access remains subject to signs and closures.

## Refresh and verification

Python 3 standard library and Node are the only dependencies.

```sh
python scripts/joyrides-refresh.py
node scripts/joyrides-test.mjs
python scripts/joyrides-metrics-test.py
```

A daily check can execute these commands. The checked-in snapshot itself is a
persistent cache: roads checked within 30 days and complete terrain profiles are
reused without network calls. `sourceCheckedAt` remains the actual route check
date; `generatedAt` is the separate snapshot-generation timestamp. Existing
`elevationCheckedAt` is preserved. Rebuild the routing graph snapshot monthly:

```sh
python scripts/joyrides-refresh.py --refresh-routes
```

Terrain is reused when actual line geometry is unchanged. If terrain needs a new
survey/source refresh, use `--refresh-elevation`. A route source failure preserves
its previous valid route. Catalog-size validation and an atomic rename prevent
empty/partial writes. Terrain failure omits its derived metrics rather than
fabricating values. `--cache-dir` selects a persistent download/sample cache.

The public OSRM service has a one-request-per-second limit; this generator makes
serial requests with a 1.1-second gap, a descriptive user-agent and website
referrer. Do not turn it into a high-volume routing job. There are at most 27
monthly route requests, one per catalog entry. USGS terrain uses deduplicated batches of 60 points, at
most four concurrent requests, and one retry for a transient failure. Local
cached point samples are reused even when retrying partially completed routes.
No runtime service availability promise is made.

Initial curation used public OSM named-road way geometry via Overpass and the
official OSM map API when Overpass was unavailable. Both are normalized into
the same `{elements:[{id,tags,geometry}]}` input structure. Each
waypoint persists its `osmWayId`, exact requested road node, intended road name,
OSRM snap distance and snapped road name. `--roadways-cache FILE` is for a
deliberate recuration from normalized OSM way geometry or an Overpass JSON
`out geom` response. Proposed/construction ways, non-driving path classes and
private/prohibited motor-vehicle access are excluded from waypoint selection.
Each requested waypoint must have an explicit matching road name/ref. Ordinary refresh
uses the approved nodes already in the snapshot; it does not move endpoints to
town centroids or random nearby subdivision streets. A 75 m router snap limit
rejects shifted endpoints. Non-driving/ferry routes are rejected.

## Primary sources

- [OSRM route API](https://project-osrm.org/docs/v26.4.0/http/)
- [Public routing-server usage policy](https://routing.openstreetmap.de/about.html)
- [OpenStreetMap attribution/license](https://www.openstreetmap.org/copyright)
- [USGS 3DEP](https://www.usgs.gov/3d-elevation-program)
- [Forest Park navigation](https://www.forestparkforever.org/navigation)
- [Missouri Tourism: Highway 94](https://www.visitmo.com/articles/scenic-drives-on-highway-94)
- [Meeting of the Great Rivers](https://www.riversandroutes.com/things-to-do/road-trips/meeting-of-the-great-rivers/)
- [Illinois Great River Road: Bluff Road](https://www.greatriverroad-illinois.org/bluff-road)
- [r/StLouis: Good driving roads in the County/City](https://www.reddit.com/r/StLouis/comments/d5p0m1/good_driving_roads_in_the_county_city/)
- [r/StLouis: Fun Driving Roads](https://www.reddit.com/r/StLouis/comments/1usrgob/fun_driving_roads/)
- [r/StLouis: Convertible drives](https://www.reddit.com/r/StLouis/comments/1ih4tdw/)
- [St. Louis MINI Club: Favorite rides](https://www.northamericanmotoring.com/forums/st-louis-mini-club/246837-favorite-rides.html)
- [Rider report: Femme Osage Creek Road](https://www.motorcycleroads.com/motorcycle-roads/missouri/femme-osage-creek-road)
- [Rider report: Cappeln Osage Road](https://www.motorcycleroads.com/motorcycle-roads/missouri/cappeln-osage-road)
- [r/StLouis: Fall-foliage drives](https://www.reddit.com/r/StLouis/comments/1xl9y8p/where_is_a_place_to_drive_to_see_fall_foliage/)
- [MoDOT: Route T work](https://www.modot.org/projects/route-t-pavement-resurfacing-franklin-and-st-louis-counties)
- [Illinois DNR: Pere Marquette](https://dnr.illinois.gov/parks/park.peremarquette)
- [Missouri State Parks: Sandy Creek](https://mostateparks.com/historic-site/sandy-creek-covered-bridge-state-historic-site)

Official area-guide links and individual OSM way links are also preserved in
each route. Live traffic, closures and construction remain the Traffic layer's
responsibility; a routing graph is not a live closure guarantee.
