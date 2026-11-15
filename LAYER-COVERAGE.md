# Layer coverage audit — November 15, 2026

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
