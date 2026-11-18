# Metro observation cards

The reference points are Arnold, Lambert, Spirit of St. Louis Airport and Missouri Botanical Garden. In each geographic sector, choose the newest usable observation with temperature and wind. A nearby reporter can replace a working primary. Each card stays within 12 km of its reference point, and pairs retain at least 60% of their original separation. If the freshest choices would cluster, maximize complete sectors then minimize the age of the oldest reading. The default map camera stays fixed. Leader dots and forecast requests follow the actual instrument.

Cards expire at 20 minutes from observation. Partial reports can supply individual fields during outages. An empty sector displays dashes. The map checks every minute while visible and on return to the page. Official forecasts and their valid times still belong to forecast playback.

## Observations

The five-minute regional weather workflow refreshes one small file on the dedicated weather-observations-live branch. It reads a regional extract from [WxAlerts](https://wxalerts.org/docs/api/observations/) and the University of Missouri stations at the [Science Center](https://agebb.missouri.edu/weather/realtime/stlouissciencecenter.asp) and [Moscow Mills](https://agebb.missouri.edu/weather/realtime/moscowmills.asp). The map credits WxAlerts for its processing. The file retains individual measurement times and excludes withheld fields. The university clock explicitly gives CST or CDT. The scheduled run can be delayed, and the collector only replaces its previous file after a valid response.

The browser independently checks [Iowa Environmental Mesonet airport observations](https://mesonet.agron.iastate.edu/api/1/currents.json?networkclass=ASOS&wfo=LSX), the Botanical Garden and [NWS station histories](https://www.weather.gov/documentation/services-web-api). Bounded NWS histories also fill neighborhood gaps. The radar cards and air layer share in-flight requests and their short caches. NWS QC failures, future dates and impossible units or values are omitted. The regional feed uses the same fixed geographic bounds for every visitor.

Verify changes with the metro-weather, weather-loading, weather-integration and air-wind-screening tests, and the weather-ingestion test. Update versioned module imports and the app entry in index.html when deploying. Check live changes at ordinary refresh.
