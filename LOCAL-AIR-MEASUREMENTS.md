# Local measured air observations

`data/air-local-observations.json` adds Missouri DNR's preliminary hourly Rider Trail I-70 station measurements: SO2, NO, NO2, NOx and measured wind. These are **not hydrogen sulfide measurements**, not landfill-source attribution, and not concentrations at an arbitrary nearby address. No AQI is calculated from these raw hourly values.

## Source and parsing

- Official [station metadata](https://dnr.mo.gov/air/hows-air/monitoring/sites/rider-trail-i-70-st-louis-county): EPA ID 29-189-0016; 38.75264, -90.44884.
- [DNR current report](https://dnrservices.mo.gov/env/esp/aqm/docs/ridertrail.pdf): PDF, hourly averages, 10 recent days.
- [DNR time/quality policy](https://dnr.mo.gov/air/what-were-doing/reports/missouri-air-quality-index): all reports fixed CST (UTC-06:00), including summer; preliminary data, instrument flags.

`python scripts/refresh-air-local.py` downloads the PDF, runs Poppler `pdftotext -layout`, requires the exact instrument/units/header and 1-hour interval, then extracts only unflagged numeric observations. Missing cells never shift values into another pollutant. Negative concentrations, status codes, suspect suffixes, future/incomplete hours and observations older than four hours are omitted. A pollutant may have an earlier individually preserved timestamp when its newest hour is flagged. Calm wind has no direction. Source direction is wind **from** degrees clockwise from true north; a transport arrow points 180 degrees opposite. Nothing here assumes measured wind is a pollutant plume.

`fetchedAt` is fetch time, not observation time. `observedAt` is the report's hour-start timestamp; `periodEnd` adds one hour. Source PDF generation time is independently retained. Clients must enforce max age against their current clock; a frozen deployment must never continue showing a reading as live.

## Refresh and failure behavior

`.github/workflows/air-local-refresh.yml` schedules refresh at minute 23 hourly and supports manual dispatch. It checks out the exact triggering main commit, tests, fetches, and deploys a Pages artifact containing the refreshed JSON. It does not create hourly data commits. The custom workflow waits for the corresponding legacy Pages deployment to finish before publishing fresh data, with latest-main guards before upload and deployment. It uses a separate concurrency group to avoid deadlocking the legacy publisher. A newer main revision aborts an older publication; the newer push starts its own refresh. Frontend freshness checks remain mandatory. Failed retrieval or changed schema fails that source step rather than silently manufacturing data. The independent EPA gas feed may still publish its successful update; if both sources fail, publication stops. The client ages out old data from a failed source. The Pages workflow must be enabled and its first deployment verified before claiming automatic refresh works.

Test: `python scripts/air-local-test.py`. The fixture is actual DNR report text retrieved November 18, 2026, 10:11 CST, not synthetic observations.

## Frontend station layer and transport context

`air-monitors.js` reads EPA's official current-monitor ArcGIS layer (owner OAR_OSAP_EPA) for PM2.5, PM10 and ozone raw hourly concentrations plus source-supplied NowCast AQI, and the two independently refreshed local JSON files for gases and measured wind. ArcGIS `ValidTime` labels the hour ending; `observedAt` is normalized to one hour earlier, with `periodEnd` retained. AirNow's [about the data](https://www.airnow.gov/about-the-data/) describes hour-ending display, while the raw hourly DAT format and DNR reports label hour beginning. All measurements expire four hours after interval start, independently of fetch time and other pollutants at the same station. Station markers derive their selected pollutant AQI from the individual reading timestamp, not newest station wind/gas time. Sources without fresh values show unavailable/no-fresh-readings, never zero.

Co-located AQS IDs merge only when coordinates agree within 0.005 degrees. Duplicate pollutant/time/value records retain both provenance links and any valid source-supplied AQI. Contradictory simultaneous measurements remain separate. Actual station observations never replace, regrade, or interpolate the existing regional category contours. No new health threshold is calculated from local gases or wind. Negative EPA instrument concentrations may be displayed as reported negative values; sentinel/missing concentrations do not discard a separately supplied valid NowCast.

The air detail panel shows source readings at nearby stations. The landfill calculation uses wind separately as described below.

Additional test: `node --test scripts/air-monitors-test.mjs`.

## Independent EPA gas feed

Official specification: https://docs.airnowapi.org/docs/HourlyAQObsFactSheet.pdf. The latest eligible complete UTC beginning-hour DAT file supplies raw NO2/SO2 (ppb), CO (ppm), and optional provider-supplied 1-hour NO2 AQI only. The refresh searches within four hours and retains date-specific source URLs per reading. Build with `python scripts/build-airnow-gases.py`; tests: `python scripts/airnow-gases-test.py`. The shared workflow runs on every main push as well as hourly, refreshing both source files together.

## Overlay correction, 2026-11-18

Station pins are no longer rendered. Actual same-hour source-issued AQIs support a bounded, piecewise-linear shaded surface inside Delaunay station triangles. PM2.5/Ozone use provider NowCast AQIs; the NO₂ selector uses provider 1-hour AQI, never PM fallback. Each triangle must have edges no longer than 30 km and all angles at least 10 degrees. These are conservative visualization masks, not validated exposure or source-detection limits. Outside those triangles, original regional contours remain, geometrically clipped so two products never double-color a point. No support means unknown, never clean.

Map taps use the selected location’s barycentric estimate, visibly identified as estimated; the source observations, distances and times remain available inside that same overlay panel. The category-based advice remains, but its grade uses the estimated point index rather than a source-observation claim. Each region retains its pollutant, category, and time.

Clipping uses polygon-clipping 0.15.7 (MIT, official npm distribution), vendored with its license and an ES-module wrapper. It changes geometry only. Hourly ingestion, private analytics, existing domain, palette and other map controls are unchanged.

## Landfill estimates in the air-quality fill

The local windows grade combines the selected pollutant with a qualitative estimate of landfill odor or, at two utility sites, windblown dust. AirNow quantities and official categories remain separate. The colors, distance scales, and local grade adjustments are Andymap display assumptions. The output does not estimate chemical concentrations, personal exposure, or an EPA health category.

### Sources and coverage

The inventory covers 38 facilities within the existing Andymap region. It includes eight operating municipal landfills, 27 closed or inactive municipal sites, Rock Hill’s operating demolition landfill, and the active Labadie and Sioux utility waste landfills. The two Champ pits bring the total to 39 modeled source areas. The review compared 148 state records and 20 EPA LMOP records. Co-located permit phases and aliases were consolidated. Verified separate neighboring facilities, including Milam and North Milam, retain separate locations. Unverified historic disposal records, transfer stations, and exclusively treated-water or intermittent incinerator ash operations have insufficient evidence for a routine odor field.

Each facility links to its source in `landfill-sites.js`. Reported disposal acreage gives an equivalent-area radius where available. Where acreage is missing, a profile-specific representative radius is assumed. Champ’s north and south pits and Missouri Pass use separately traced NAIP outlines. Buffers start at each outline’s convex envelope. This keeps the adjacent Champ quarry outside the source geometry. The Bridgeton location represents its sanitary disposal area. The larger West Lake Superfund property boundary does not determine its modeled extent.

- [Missouri DNR permit locations](https://gis.dnr.mo.gov/host/rest/services/waste/SW_Facilities/FeatureServer/0) and [Illinois EPA landfill inventories](https://geoservices.epa.illinois.gov/arcgis/rest/services/Environmental/IllinoisLandfills/MapServer)
- [Illinois EPA 2025 disposal and capacity report](https://epa.illinois.gov/content/dam/soi/en/web/epa/topics/waste-management/landfills/landfill-capacity/documents/2025LandfillCapacityReportFinal.pdf) and [EPA LMOP landfill data](https://www.epa.gov/lmop/landfill-technical-data)
- [Champ permit and pit maps](https://dnrservices.mo.gov/env/wpp/permits/issued/docs/0097543.pdf), [Missouri Pass gas collection permit](https://dnr.mo.gov/sites/dnr/files/vfc/2019/02/main/bfi-mopass2010op.pdf), and [NAIP imagery](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer)

### Weather and grading

Each facility takes the nearest eligible observation within 30 km. The Rider Trail hourly average must be complete. Airport observations use the original report time from the St. Louis forecast office’s [IEM airport feed](https://mesonet.agron.iastate.edu/api/1/currents.json?networkclass=ASOS&wfo=LSX). Both expire two hours after their observation or interval end. Geographic downwind is the wind-from bearing plus 180 degrees. Variable or sub-2-mph winds give a compact, nondirectional odor field. If all reports expire, a shorter proximity-only estimate remains. The site discloses the wind station, speed, and time on a map tap.

Operating waste has the broadest potential reach. Closed sites with documented gas generation or management retain a smaller field. Other closed sanitary sites use a weaker field. Rock Hill has a short debris-odor profile because drywall can generate hydrogen sulfide in a landfill. Profiles distinguish the evidence for a pathway and operating status. They do not imply that gas collection increases emissions. Local surface winds, emission rates, topographic channeling, inversions, and episodic operations remain sources of uncertainty.

The model generates nested asymmetric contours with increasing width and downwind length away from the source. Increasing wind above 9 mph reduces the odor extension. On a favorable regional background the four local grade floors progress through A, A−, B+, and B−. On a Moderate pollutant background the two lighter local bands can move the windows grade one step, and the two stronger bands can move it two, capped at C+. Unhealthy-for-Sensitive-Groups and worse pollutant grades take precedence. Overlapping sources contribute the strongest local band once. Site proximity alone never produces an orange or red health alert. Where a pollutant reading is unavailable, only the local footprint is shaded and labeled as a local-only estimate.

At Labadie and Sioux the model screens for dust only with directional wind of at least 12 mph, relative humidity up to 55%, and a reported zero hourly precipitation total at the same station. Unknown required weather suppresses the dust field. The thresholds describe a dry, windy weather proxy. They do not measure moisture at the landfill or establish that ash is being handled.

The map fill, map-center card, taps and spot lookup use the same contours and grade rule. Display polygons are clipped to the original map region and maintain the selected opacity. Metro-wide clipping runs in a browser worker where supported.

- [Missouri DHSS / ATSDR Bridgeton assessment](https://www.atsdr.cdc.gov/HAC/pha/BridgetonSanitary/Bridgeton-Sanitary-Landfill-HC-508.pdf), [EPA landfill gas FAQ](https://www.epa.gov/lmop/frequent-questions-about-landfill-gas), and [AirNow AQI](https://www.airnow.gov/aqi/aqi-basics/)
- [EPA construction and demolition landfill guidance](https://www.epa.gov/system/files/documents/2023-12/tribal_construction_demolition_landfill_guide-2023.pdf), [EPA fugitive dust guidance](https://www.epa.gov/sites/default/files/2020-10/documents/13.2.4_aggregate_handling_and_storage_piles.pdf), [Labadie](https://www.ameren.com/sustainability/waste/ccr/compliance-reports/labadie) and [Sioux](https://www.ameren.com/sustainability/waste/ccr/compliance-reports/sioux) dust-control records

Run `node --test scripts/air-*-test.mjs` after changing the model or its display.
