# Forecast outdoor insights

Only three new weather planning calculations belong to this pass: best outdoor
hour, weather turning points, and ventilation windows. Rain budget and quieter
park surroundings have separate guides. Do not add the other proposed ideas.

The main NWS hourly forecast comes from the existing map API. If unavailable,
`forecast-fallback.js` reads NWS points and the returned official forecastHourly
endpoint directly. It does not invent observations or gusts; source notes explain
wind ranges using their upper endpoint. Forecasts older than 18 hours are excluded
from recommendations, and dated source times are shown. All labels use Chicago
time; missing numeric values stay missing, while real zero remains zero.

`weather-insights.js` calculates daytime preferences, changes between adjacent
hours, and contiguous ventilation windows. It uses up to 24 forecast rows from
the current hour. Temperature preferences remain in memory for the session.
Air quality uses the CAMS global modeled U.S. AQI via Open-Meteo, a regional
approximately 45 km grid rather than a local monitor. The request uses rounded
map-center coordinates (0.1 degree), not a raw device position. Results are
deduplicated and cached for one hour. No advertising or analytics collection.

If air coverage is incomplete, every outdoor hour is ranked on weather alone;
unknown air is never treated as clean. Ventilation requires known air quality,
temperature, dew point, rain chance and wind. The default constraints are
explained in the UI, as are missing indoor conditions and pollen. No health
probability, indoor-air measurement or guaranteed quiet is implied.

Daily maintenance: check a live Forecast view, timestamps, hourly coverage,
the Open-Meteo/CAMS endpoint, the source links, and the air-layer shortcut.
Keep existing 6 a.m. America/Chicago task; runtime weather and air fetches remain
independent of that research check. Do not bake a transient forecast into static
HTML or renew an old issue time after a fetch.

Primary source references:
- https://www.weather.gov/documentation/services-web-api
- https://open-meteo.com/en/docs/air-quality-api
- https://ads.atmosphere.copernicus.eu/datasets/cams-global-atmospheric-composition-forecasts
- https://www.airnow.gov/aqi/aqi-basics/
- https://www.epa.gov/indoor-air-quality-iaq/biological-contaminants-and-indoor-air-quality

Validation: `node scripts/weather-insights-test.mjs`, module linking, desktop
and phone-width Forecast UI. Test a known qualifying ventilation period in
fixtures as well as the live no-window case, temperature preference controls,
hour selections, expired data, null fields, failed requests and retries.
