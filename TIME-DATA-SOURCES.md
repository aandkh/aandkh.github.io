# Date exploration sources

Implementation/research checked November 16, 2026. This inventory is reference
material, not an instruction to re-audit these sources during daily maintenance.

## Implemented range controls

- Wildlife and Birding: iNaturalist observation dates, selected regional bounds,
  group/species and public-observation privacy filters. Reports indicate recorded
  observations, not abundance or a complete species inventory. Earlier dates may
  have no records. Two handles replace paired calendar inputs.
- Crimes & Crashes: existing permanent archive; earliest selectable date comes
  from archive coverage metadata. City and County remain combined. Missing source
  periods are not filled or interpreted as zero crime.
- Upcoming events: actual published event dates in the loaded listings. Both map
  and list use the range. Timed events still expire at their start; undated
  operators remain explicitly undated. This is not a past-events archive.
- Rain Budget: 120 daily station records currently retained. Date selection sums
  the supplied measurements locally; normal departure requires complete readings
  and normals. Trace, missing and unfinished days retain their existing handling.

## Verified sources for possible later expansion (not connected by this change)

- IEM NWS daily climate archive: https://mesonet.agron.iastate.edu/json/cli.py?help=
  `station=KSTL&year=2006` and `year=2025` each returned 365 daily records.
  Temperature, precipitation, snow and wind fields are available. Sample years do
  not establish uninterrupted coverage. Check missing values and revisions.
- IEM hourly ASOS: https://mesonet.agron.iastate.edu/request/download.phtml
  `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py` returned 24 hourly
  STL observations on November 14, 2026, including temperature, wind speed and
  direction. Preserve missing values; wind speed is supplied in knots.
- USGS water history: https://api.waterdata.usgs.gov/docs/ogcapi/
  Mississippi at St. Louis `USGS-07010000` metadata has continuous gauge height
  from 2001-10-01 and daily SelectedValue from 1982-10-01. A November 1–7, 2025
  query returned seven approved daily readings using statistic `30800`;
  `00003` daily mean returned none. Read each gauge's series metadata before
  selecting a statistic. Never label a selected daily reading a daily mean.
- CAMS via Open-Meteo: https://open-meteo.com/en/docs/air-quality-api
  A November 1–2, 2026 STL query returned 48 hourly values. These are modeled
  archived forecasts (global grid approximately 45 km), not measured neighborhood
  pollution. Documentation lists global coverage from August 2022.
- NWS storm reports via IEM: https://mesonet.agron.iastate.edu/request/gis/lsrs.phtml
  Date-bounded reports include event time/location and magnitude qualifiers.
  The archive is explicitly incomplete/unofficial; retain NWS attribution and
  measured-versus-estimated distinctions if integrated.
- Traffic: https://docs.tomtom.com/traffic-stats/documentation/product-information/introduction
  Historical Traffic Stats is separate from live traffic and requires separate
  access. Current MoDOT incident data cannot reconstruct historical traffic
  colors. No free complete historical traffic feed was verified in this pass.
