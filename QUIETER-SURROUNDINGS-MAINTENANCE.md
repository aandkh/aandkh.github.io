# Quieter surroundings in Parks and trails

This feature compares **distance from mapped major roads**. It does not estimate decibels, traffic volume, current traffic, sound propagation, safety, or the probability that a place will be quiet.

## Coverage and provenance

`quiet-roads.json` contains 26,520 OpenStreetMap ways / 53,170 simplified line segments, fetched November 15, 2026. It covers the **entire existing Andymap region** from `core.js`: longitude −91.2 to −89.4, latitude 38.1 to 39.2. The query extends to longitude −91.35 to −89.25 and latitude 37.95 to 39.35 to avoid missing the nearest road just outside the application boundary. St. Louis City and County are always covered together, alongside St. Charles, Franklin, Jefferson and the Metro East.

The snapshot includes `motorway`, `trunk`, `primary`, `secondary` and their `_link` ramps. Secondary roads are included because they represent arterial connections in suburban areas too. These classifications express road-network importance; **they are not measured traffic counts**. See [OpenStreetMap highway definitions](https://wiki.openstreetmap.org/wiki/Key:highway) and [Overpass geometry queries](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example). The exact source query URL, OSM database timestamp, retrieval date, class counts and ODbL attribution are stored in the file.

The road file is approximately 1.02 MB / 455 KB gzip. Geometry uses encoded polylines with 5-decimal coordinates after a 5 m simplification. No proprietary noise data or guessed traffic values are involved.

## Honest measurement

- A point feature uses its mapped location.
- A polygon uses a representative **interior** point. If its centroid falls outside a concave polygon or in a hole, the algorithm finds a valid interior interval. MultiPolygons use the largest component. This describes neither the whole park nor its quietest place.
- A trail uses 3–33 evenly spaced points, aiming for a 250 m sample interval before the cap. The ranking uses the **median** nearest-road distance. Details separately identify the closest sampled approach, its road name and distance. Unsampled sections may be closer.
- Distances use the finite great-circle road segment, including correct endpoint handling. This is a spherical distance calculation, not driving distance. Figures are rounded for display.
- Barriers, terrain shielding, aircraft, railways, wind, road traffic and activity inside a park are **not** measured. No noise tiers or invented dB figures are produced.
- Outside-region or incomplete-edge calculations remain unknown. Unknown entries sort last. Road snapshots older than 90 days or dated more than five minutes in the future cannot produce a valid score.

## Fast initial results

`quieter-parks.json` is a focused fallback containing **849 named parks and trails** with precomputed comparisons. It retains original park outlines and simplifies trail lines by no more than 5 m. Road analysis used the original geometry before this display simplification. It is about 305 KB gzip and needs no road-index build to display its comparisons.

This is explicitly **partial coverage**: the live regional Parks request returned 1,260 of 6,622 objects. Unnamed entries and three representative locations outside the comparison area are omitted from the fallback. The API URL, returned/total counts, API snapshot date and OSM observation date are preserved. The live API can add more places as the user changes the view. A fallback older than 30 days is rejected rather than presented as freshly checked.

Initial result rendering should commit the precomputed snapshot immediately. The live API result can then be enriched in the background. A real 1,242-feature Parks fixture took about 484 ms for initial enrichment on this workspace and 51 ms on repeat; these are local checks, not a promise for every phone. Work yields every 32 features. Road downloads, decoding, grid indexing and coordinate calculations are cached. A full regional road index took 64–94 ms in tests; repeated lookups reuse it.

## Integration contract

Import from `quieter-surroundings.js` and include `quieter-surroundings.css`. Only the **Parks and trails** layer is in scope.

| Export | Contract |
| --- | --- |
| `quietParksSnapshot(now?)` | Returns an API-shaped partial Parks result with precomputed `properties.quieterSurroundings`. Throws on unavailable/expired source. Five-minute request cache. |
| `loadQuietRoads()` | Returns the local road snapshot. Concurrent calls share one request. Uses HTTP revalidation (`no-cache`), at most once per day in-session. |
| `enrichQuieterSurroundings(result, roadData?, now?)` | Returns a new result/features/properties without mutating initial results. Success: `quieterStatus: 'ready'`. Failure: original result plus `quieterStatus: 'unavailable'`. |
| `sortQuieterSurroundings(features, center?)` | Largest representative/median road distance first, unknown last; returns a new array. |
| `quieterSummary(properties)` | Short factual result text, or empty for unknown. |
| `appendQuieterDetails(host, properties)` | Appends an accessible detail section, nearest-road OSM link, location basis, source dates and an explanatory disclosure. No unsafe HTML interpolation. |

Suggested sorting label: **Quieter surroundings · road distance**. The enriched assessment is under `properties.quieterSurroundings`; its fields include `status`, `distanceMeters`, `nearestDistanceMeters`, `nearestRoadName`, `nearestRoadUrl`, `locationKind`, `locationBasis`, `sampleCount`, `checkedAt` and `sourceDataAt`.

## Refresh and tests

```sh
python scripts/quieter-roads-refresh.py
node scripts/quieter-parks-refresh.mjs
node scripts/quieter-surroundings-test.mjs
```

The road refresh is standard-library Python, cached for seven days by default. `--force` re-fetches. It performs one Overpass request and refuses partial/error responses, implausibly small inventories or a greater-than-25% count drop. Writes are atomic. `--source-json /path/to/overpass-response.json` allows a previously downloaded, reviewed response.

The Parks refresh uses Node built-ins, the existing Andymap Parks API and local road data. `--source-json /path/to/parks-response.json` avoids a repeated request. It checks counts and successful regional analysis before atomic replacement. A successful HTTP fetch does not turn this into a live access/closure or noise feed.

Tests cover spherical distances and endpoints, exhaustive-vs-grid nearest-road agreement, polygon holes, trails, cache reuse, future/expired data, unknown sorting, both City and County, and eight other regional locations. The precomputed fallback is also checked for City/County parks, preserved partial-coverage flags, cached loading and source expiration.
