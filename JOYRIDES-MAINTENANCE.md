# Joyrides

Sixteen continuous public-road touring loops/corridors combine St. Louis city,
St. Louis County, and nearby Missouri/Illinois river-country drives. The list is
regional, with no city/county toggle. Every map line comes from OSRM's OSM driving
graph through audited named-road waypoints. No straight-line route links are
invented. These are Andymap selections; area guides do not endorse the itineraries.

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
referrer. Do not turn it into a high-volume routing job. There are at most 16
monthly route requests. USGS terrain uses deduplicated batches of 60 points, at
most four concurrent requests, and one retry for a transient failure. Local
cached batches are reused. No runtime service availability promise is made.

Initial curation used public OSM named-road way geometry via Overpass. Each
waypoint persists its `osmWayId`, exact requested road node, intended road name,
OSRM snap distance and snapped road name. `--roadways-cache FILE` is for a
deliberate recuration from an Overpass JSON `out geom` response. Ordinary refresh
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

Official area-guide links and individual OSM way links are also preserved in
each route. Live traffic, closures and construction remain the Traffic layer's
responsibility; a routing graph is not a live closure guarantee.
