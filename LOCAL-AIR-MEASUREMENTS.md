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

Round numbered monitor pins show the selected PM2.5/ozone AQI; other stations use a neutral symbol. A wind arrow is displayed only for fresh valid measured wind at least 1 mph, pointing FROM+180 degrees. A collapsed detail comparison uses DNR permit-point geometry for Champ (record432, active) and Bridgeton SLF (record627, inactive). It reports distance, source-to-selection bearing, wind-station distance/time, and angular separation; no arbitrary downwind risk radius, dispersion plume, pollutant concentration, source attribution, or safety classification is calculated. Facility points are not exact gas outlets; inactive permit does not imply zero emissions. DNR's H2S GIS inventory contains inactive stations, so no H2S measurement is fabricated.

Additional test: `node --test scripts/air-monitors-test.mjs`.

## Independent EPA gas feed

Official specification: https://docs.airnowapi.org/docs/HourlyAQObsFactSheet.pdf. The latest eligible complete UTC beginning-hour DAT file supplies raw NO2/SO2 (ppb), CO (ppm), and optional provider-supplied 1-hour NO2 AQI only. The refresh searches within four hours and retains date-specific source URLs per reading. Build with `python scripts/build-airnow-gases.py`; tests: `python scripts/airnow-gases-test.py`. The shared workflow runs on every main push as well as hourly, refreshing both source files together.
