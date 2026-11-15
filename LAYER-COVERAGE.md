# Layer coverage audit — November 15, 2026

## Completion pass

The endpoint-only table below records the earlier audit, not the current frontend inventory. The browser now supplements those endpoints with directly verified public data:

- 415 dated local/independent movie screenings, 168 home sports events, 152 concert performances and 209 comedy/theater performances. National cinema chains and undated theater pins are excluded.
- 28 named completed greenways with precomputed terrain profiles; Joyrides adds real routed public-road comparisons. Geometry and expensive terrain work are maintained offline, not downloaded repeatedly on phones.
- 23 local food venues (14 City, 9 County), 12 dated openings (6 each), 34 upcoming public food-truck stops and 70 operator schedule links.
- Combined City and County reported crime/crash ingestion with lazy monthly archives, actual source dates, masked locations and explicit reporting-lag information. See INCIDENT-MAINTENANCE.md for source coverage.
- 71 of 75 river gauges have valid recent 30-day comparisons; insufficient histories remain unknown.
- Sky viewing combines forecast cloud cover, calculated Moon/twilight and 792 sampled NASA night-light values. Its comparison index is not a detection probability.
- Official water notices join electricity outage totals. Cached USGS Streams tiles replace the failing dynamic image. Unsupported camera/restroom controls and ISP-map placeholders are removed.

All inventories remain partial. Historical audit failures below do not describe the present status of working sources; each record retains its own actual observation/verification time. Daily instructions are in MAINTENANCE.md.

## Original endpoint-only audit

Checked all 46 catalog layer endpoints with a metro-wide bounding box (-90.8,38.35,-90.1,38.95). Counts below are current returned records, NOT completeness claims. Point locations were classified against Census City (29510) and County (29189) polygons returned by the civic feed. The metro query includes neighboring jurisdictions, so counts need not sum to totals. Frontend concert/movie/crime supplements are additional.

## Findings

- No frontend-wide City-only or County-only boundary filter was found. Normal queries use map bounds; regional traffic bounds include both.
- Civic and outages explicitly return both 29189 and 29510. Demographics returns tracts from both. Annual crime covers City plus reporting municipalities, not complete County coverage.
- Restaurants, bars, nightlife, parking, EV, recreation, culture, markets, rivers, transit, birding, local food, movies and university events have examples on both sides.
- Current sports, arts and festivals are university-calendar limited and their returned events are County-only at this check. That is a SOURCE coverage gap, not proof that City has no events. Expand City sports/performing arts sources.
- New businesses has one City listing and needs verified County openings. Food trucks is one operator and currently one City stop; expand County and other operators. Restrooms is Forest Park-only but already hidden from the layer UI.
- Concert frontend supplement adds City venues and County Factory and other venues according to actual venue coordinates; curated coverage remains partial.
- Crime previously had only reviewed City incidents; this change merges County releases into the same archive.
- AQI feed reported stale; aircraft unavailable. Neither failure establishes a geographic omission.
- NWS alerts cover LSX region, not all civil emergencies. Forecast is map-center based; EPA UV is specifically ZIP 63101 and must not be represented as a separate County observation.
- Terrain/FEMA/radar/imagery layers are regional tiled products, not point inventories. Zero feature count is normal. MoDOT excludes local/non-Missouri road coverage; regional map extent alone is not complete crash coverage.

## Point inventory sample

| Layer | Returned points | City | County | Status |
|---|---:|---:|---:|---|
| arts | 4 | 0 | 4 | partial |
| bars | 264 | 141 | 64 | reference |
| birding | 4 | 1 | 2 | reference |
| businesses | 1 | 1 | 0 | partial |
| communityevents | 13 | 1 | 12 | partial |
| concerts | 20 | 1 | 19 | partial |
| culture | 895 | 502 | 298 | reference |
| ev | 71 | 32 | 27 | reference |
| exhibitions | 8 | 6 | 2 | partial |
| family | 896 | 281 | 453 | reference |
| festivals | 1 | 0 | 1 | partial |
| foodtrucks | 1 | 1 | 0 | partial |
| free | 16 | 4 | 12 | partial |
| localfood | 5 | 4 | 1 | reference |
| markets | 19 | 4 | 12 | reference |
| movies | 18 | 6 | 9 | partial |
| nightlife | 284 | 150 | 64 | reference |
| parking | 8672 | 3088 | 3796 | reference |
| parks | 42 | 2 | 28 | reference |
| recreation | 2758 | 396 | 1609 | reference |
| restaurants | 1212 | 512 | 540 | reference |
| restrooms | 3 | 3 | 0 | reference |
| rivers | 75 | 4 | 41 | live |
| sports | 14 | 0 | 14 | partial |
| transit | 70 | 30 | 28 | live |

## Maintenance obligations

Repeat both geographic source checks daily, inspect pagination and result limits, and expand the missing-side source inventory. Preserve one merged feed per layer. Never treat a source outage, zero current events, an unmapped record or a partial directory as proof that the area has no activity. Backend source/deployment access is unavailable; changes to that service cannot be claimed. Frontend curated supplements can be maintained and published through GitHub.

## Gyms — added November 15, 2026

One combined regional snapshot covers city, county and nearby communities. 87 named gyms/studios; partial OSM coverage plus an explicit Memento Fitness Club entry in Eureka. Local/neighborhood listings first, regional/community clubs second, national chains last. Source-backed hours only, unknown hours last within each group. See `GYMS-MAINTENANCE.md` for sources and refresh requirements.
