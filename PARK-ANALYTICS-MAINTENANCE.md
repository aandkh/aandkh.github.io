# Park analytics

`park-analytics.json` is a compact, precomputed companion to the named regional
`quieter-parks.json` directory. Match records by unchanged OSM feature ID. City,
County and surrounding communities share one inventory; no jurisdiction selector.

## Refresh only on a change signal or requested correction

This is static reference analysis, **not part of the morning changing-data job**.
Do not add it to the daily runner. Run after a relevant OSM/USGS update, boundary
correction, or explicit request. Python dependencies: Shapely 2+ and pyproj.

```
python scripts/park-analytics-refresh.py
```

The raw OSM category responses and DEM batches cache in `/tmp/andymap-park-cache`.
Use `--refresh-osm` only when fresh geometry is needed. Removing a DEM cache file
forces that batch to be sampled again. `--skip-elevation` is for debugging and must
not replace a complete published dataset. Failed OSM fetches abort without replacing
published data. Inspect upstream remarks, unexpectedly low counts and metrics before
publishing. Geographic coverage is the existing app region, not just City or County.

## What the measurements mean

- **Area:** polygon footprint in EPSG:26915 meters converted to acres. Multipolygon
  parts and holes retained. Points/lines cannot establish acreage and are omitted
  from the analytics companion; their original map listings remain available.
- **Walking paths:** length of mapped footway/path/pedestrian/steps/cycleway geometry
  clipped to the park. Explicit `access=private/no` or `foot=private/no` excluded.
  Union overlapping geometry before length; this is a mapped walking-network proxy,
  not an audited accessibility, safety or subjective walkability rating.
- **Path density:** mapped walking miles per100acres. Paved share uses explicit OSM
  surface tags; unknown surfaces are not assumed paved. Wheelchair-tagged mileage
  includes only explicit `wheelchair=yes`, not a complete accessibility audit.
- **Water:** clipped `natural=water` footprints. Largest pond/lake uses explicit
  `water=pond/lake/reservoir`; river and retention-basin polygons are excluded from that comparison.
  Tagged member ways are deduplicated against relations; overlapping water polygons
  unioned. Pond count is distinct connected mapped bodies, not a field inventory.
- **Woodland:** union of mapped `natural=wood` ways and `landuse=forest` polygons clipped
  to park boundaries. This is **mapped woodland footprint**, never canopy percentage,
  actual shade, or a remotely sensed vegetation survey. Natural-wood multipolygon
  relations could not be fetched reliably and are omitted, so this is a lower-bound
  mapped footprint; source metadata records that limitation.
- **Trees:** mapped tree points and explicitly tagged `species` values only. Semicolon
  lists split, spelling case normalized. Genus-only records do not inflate species
  totals. Species count missing when no explicit species tags; not zero biodiversity.
- **Amenities:** mapped benches, playgrounds, picnic sites, sports pitches, drinking
  water and dog areas intersecting the park. Private/no-access amenities excluded.
- **Elevation:** USGS3DEP bare-earth samples on a150m interior grid, adapted for large
  parks, plus representative point and12inset boundary samples. Display sampled low,
  high and range, not surveyed extrema, route climbing totals or road-deck height.
  All samples must resolve and at least3samples are required. Terrain voids remain null.

Zeros mean no matching **mapped** feature, not proven absence. Completeness varies by
park. Tiny rounded values may appear0. Measurements are estimates; all applicable
sorts place missing values last. Tree taxonomy is especially sparse. Keep sources
compact and available from the card, preserve OSM attribution/ODbL and USGS credit.

## Validation

Run focused geometry tests covering holes, multipolygons, clipping, union/dedup,
private paths, river exclusion and missing values. Review large/small City and County
parks for plausible acreage/path/water values and absence of >100%footprint fractions.
Do not run broad stable-data or full-site audit jobs for this feature.

### November 16 source limitation

Woodland includes5,669`natural=wood`ways and228`landuse=forest`features. Natural-wood
multipolygon relation requests failed, so the published woodland footprint remains
an explicit lower bound. Full region paths and water queries succeeded.

Tree and amenity source queries (combined and individual, across alternate endpoints)
returned502/timeouts. Their fields remain null and unsupported sort controls stay
hidden. After a confirmed failure, `--amenities-unavailable` allows the independently
verified geometry/terrain dataset to be generated without fabricating zeros. Existing
successful tree/amenity values and their actual verification time are retained when
present. Do not use this flag to imply a successful amenity refresh. Retry those
adapters on a specific source recovery/change signal, not every morning.

Tower Grove Park has a separate official tree-collection note: approximately7,000
trees and340tree types, from https://www.towergrovepark.org/about, verified
November16,2026. Keep this named-source fact distinct from OSM mapped-species counts;
“types” does not establish a comparable regional species census. Do not include this
single official note in an OSM species ranking or re-research it every morning.
