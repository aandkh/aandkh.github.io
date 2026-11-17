# Weather loading and rendering

The November 16, 2026 performance pass removes serial waits before useful weather
can appear. Observations and forecasts keep their actual source times.

## Station observations

`metroWeatherReadings` accepts `loadBackend({signal})` and `onUpdate(readings)`.
The backend and direct IEM/NWS observations run concurrently. Each usable source
publishes through the callback immediately; it does not wait for every station
or the slowest mirror. Previously the UI awaited the backend (up to six seconds),
then all primary mirrors (six more), then reserves (six more).

- Two-minute response reuse and in-flight sharing prevent duplicate public
  source requests. Subscriber cancellation cannot cancel another panel's read.
- Last-good observations retain original timestamps and the existing two-hour
  expiry. A failed fetch never renews an observation's age.
- Reserve loading starts when a primary station finishes without complete data;
  other slow primary requests do not delay it. The existing nearest valid
  replacement labeling and exact station coordinates remain in use.
- All source state is small and memory-only. The source-response map holds at
  most 64 completed entries; no visitor information is stored.

## Forecasts

`loadWeatherForecast(lat,lng,{loadPrimary,signal,onUpdate,force})` starts the
backend and direct NWS path together. With `onUpdate`, a useful direct forecast
can paint while richer backend details are still loading. Without it (spot/radar
cards), the first usable result resolves the request and cancels the losing path.

The result cache holds up to 32 exact four-decimal locations for five minutes.
Concurrent direct callers share the hourly response when their points resolve to
one NWS grid. An explicit force refresh bypasses the hourly/result cache while
retaining stable point routing. If both sources fail, a forecast cached less
than 30 minutes ago can remain only when it still contains future hours, with an
explicit saved-forecast notice and the unchanged original issue/check times.
Older or exhausted forecasts are rejected.

`nws-grid-points.js` contains five exact point-to-grid mappings verified from the
official NWS `/points` response, with a 30-day lifetime. Only the routing lookup
is omitted; the forecast is always requested from the live hourly source.
404/410 automatically rechecks the official point endpoint. Other locations use
NWS point lookup as before, and never borrow a neighboring point's coordinates.

| Location | Exact point | Verified hourly route |
| --- | --- | --- |
| Default map center | 38.6300,-90.4000 | LSX/88,74 |
| Arnold | 38.4450,-90.4140 | LSX/88,66 |
| Lambert | 38.7524,-90.3734 | LSX/89,80 |
| Chesterfield | 38.6572,-90.6558 | LSX/79,75 |
| Botanical Garden | 38.6127,-90.2608 | LSX/93,74 |

Each source URL is `https://api.weather.gov/points/<exact point>`; each forecast
URL is `https://api.weather.gov/gridpoints/<hourly route>/forecast/hourly`.
Do not refresh mappings daily; missing/expired mappings use the official route.

## Radar and rendering

Opening forecast radar fetches station forecasts through the same result/grid
cache. Pointer/focus warming can prepare the radar but no longer starts four
full station forecasts. There is no automatic map-startup radar warm call.
Playback frame timestamps, tile readiness, selected time, and paused shared
links are unchanged. Late station results cannot redraw an obsolete station set.

Observation expiry checks no longer request layouts when readings/visibility are
unchanged. Unrelated Leaflet layer additions/removals no longer schedule weather
work; the shared badge registry still reports actual badge/control arrivals.
Station projection is computed once per layout, card nodes are retained for
lookup, and an unchanged layout does not rebuild leader SVG.

## Measurements and checks

A single live-source sample in this environment returned primary forecast in
6.20 seconds, backend observations in 6.26 seconds, Lambert IEM in 3.93 seconds,
and Lambert NWS in 4.83 seconds. Exact NWS point-to-grid lookups cost 3.2–4.9
seconds. These are observed request times, not guarantees for visitors.

The repeatable synthetic benchmark uses identical delayed fixtures against
commit `8a66f63` and this implementation. Its five-run station medians were
120.9 ms before first visible readings versus 25.7 ms after; all four new cards
were available at 41.2 ms. A simulated failing primary forecast was visible at
136.5 ms before versus 57.1 ms after. These figures demonstrate the removed
serial dependency, not production network speeds.

```sh
node scripts/weather-loading-test.mjs
node scripts/weather-load-bench.mjs
node scripts/metro-weather-test.mjs
node scripts/weather-insights-test.mjs
node scripts/weather-layout-test.mjs
node scripts/weather-performance-test.mjs
node scripts/weather-overlay-state-test.mjs
node scripts/radar-scrub-test.mjs
node scripts/radar-tile-reuse-test.mjs
```

The new tests check early station/forecast publication, grid and in-flight reuse,
independent cancellation, closed-panel suppression, exact point labels, forced
refresh, stale notices, and known-grid remapping. Existing source conversion,
layout, radar interaction and shared-time tests also pass.
