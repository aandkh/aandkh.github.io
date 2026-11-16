# November 16, 2026 performance pass

Changes:
- Skip hidden results and closed mobile layer-control rendering; populate synchronously when opened.
- Build only expanded layer groups. Batch background source UI updates per animation frame, and avoid replacing an unrelated open results panel.
- Avoid duplicate progressive-source commits and zoom reconstruction of point-only layers / wildlife heat tiles. Continue reclustering visible markers.
- Avoid pan reloads of complete regional history, wildlife, gyms, joyrides, recent-incident and geology/stream datasets. Existing live refresh timers remain. Cycling retains pan enrichment for air-quality freshness.
- Reuse date formatters; bound caches for repeated place-name/domain classification while allowing changed records.
- Defer offscreen result-card layout with progressive CSS content visibility.
- Coalesce radar timeline input over 100 ms; release commits immediately. Keep displayed timestamps/weather values attached to the displayed frame. Stop/play/map movement cancel pending seeks.

Validation:
- Real 469-event CPU benchmark: 137.34 ms legacy versus 3.58 ms reused-formatters median in one local run; exact output matched.
- 608 real listings, 60 repeated classification passes: 182.56 ms versus 21.32 ms median in one run. These are helper-only Node CPU results, not whole-site or phone timings.
- Chrome preview, 390×780 viewport, 179 concert results: baseline result-render callbacks 41.6–64 ms; optimized callbacks 14.3–14.7 ms before the offscreen CSS change. This is a limited desktop-browser mobile-layout comparison, not a low-end handset guarantee.
- Real UI: opening hidden layers/results, concert date filtering (179→6), wildlife Amphibia species list, returning from map and zoom were checked. Wildlife zoom handler measured 0.2 ms in the observed sample.
- Module graph, date/lifecycle/range tests, chain cache mutation/eviction tests, progressive loading tests and radar scrub cancellation tests pass.

Run node scripts/performance-audit.mjs, node scripts/benchmark-chain-cache.mjs, and node scripts/radar-scrub-test.mjs for reproducible targeted checks. Add ?qa=performance on localhost for UI timings; diagnostics do not run on production.

External feed latency and device/GPU differences remain. Do not treat these measurements as an end-to-end speed guarantee or weaken data freshness to improve a benchmark.

# Full six-agent pass — November 16

Coverage: startup/asset graph and CSS/font delivery; map clustering, marker placement, vector geometry and terrain; weather/radar/sky; source loading, archive assembly and live refresh scheduling; Wildlife/Birding, parks/rain and date controls; whole-app menus, filtering, search, navigation and lifecycle. No source research, data thinning, reduced refresh accuracy or map-quality reduction was used to claim a speedup.

Implemented beyond the earlier pass:
- Runtime refresh cadence now uses retrieval completion, never provider verification timestamps. Unchanged source dates no longer cause a 15-second reload loop. The scheduling test reproduces 240 attempts/hour before versus 4 at the intended 15-minute cadence; failed sources retry at a bounded interval without changing source dates.
- Retain vector geometries and event handlers on zoom; update styles rather than rebuild 99,437 geology coordinates. Aircraft heading lengths still update; floodplain geometry remains intact.
- Weather-card placement solves at rest, with cheap leader updates during gestures, and reuses unchanged layouts. Identical hourly radar cards do not repaint. Sky updates coalesce; caches are bounded, and a rejected old radar request cannot evict newer cached data.
- Closed map keys skip polygon/AQI calculations; repeated tile errors only update status once. Results reuse opening-hour calculations within a render. Search stops at the eight visible suggestions. Identical pending place checks share a request.
- Incident filtering decorates dates once per record; archive hydration/merge reuses one selection. Concert and geology reads share pending fetches. Cancelled progressive loads settle promptly; verified cached records survive transient failures without renewed verification dates.
- Wildlife shares identical requests with independent consumer cancellation and a bounded cache. Superseded Birding/species work cancels. Date-slider, park and weather formatting reuse formatters. Rain tables/charts build on disclosure opening.
- CSS consolidated in exact original order: 23 stylesheet requests to 2. Full original variable font reencoded losslessly as WOFF2 (194,336 to 88,672 raw bytes). Three Forecast-only modules defer until Forecast opens. Final eager graph is 65 unique URLs, ~516 KB raw versus 68 URLs / ~556 KB before.
- Mobile drawer narrowed 280 to 224 CSS pixels; text, checkbox and button sizes preserved.

Representative local CPU measurements (not whole-app/mobile hardware claims):
- 10,372 actual incident records: filter/sort 187.65 to 24.72 ms; exact identities/order.
- 842 actual events ×20 expiry passes: 77.85 to 1.15 ms.
- 120 simulated weather-layout movement updates: 227.54 to 2.83 ms, including final placement.
- 719 actual park summaries: 48.44 to 2.12 ms, identical text.
- 28 actual cycling routes joined to 12 synthetic detailed AQ polygons: 10.25 to 2.47 ms; holes, overlaps, missing values, corrections and expiry retained.
- Dense 60-badge stress: ~42 to 34 ms; ordinary smaller cases noisy. This remains a stress-case limit, not a universal frame budget guarantee.
- Browser preview rock-layer zoom handler: 0.4 ms in the observed sample, with the overlay retained.

Validation: module graph, bundle freshness, refresh policy, source-cache/correction/cancellation, dates/event lifecycle, incidents, Wildlife/Birding, slider/rain lazy rendering, weather layout/insights/radar/sky, routes and geometry checks. Phone UI verified the 224px drawer, Forecast lazy extras, Wildlife group switching, rock-layer zoom/map key. Deployment checks and normal-reload delivery are recorded in the task completion.

Deliberately retained: MapLibre default vector renderer, source rate limits, exact geometries, live feed frequencies, required attribution, all events and historical records. An astronomy coordinate-cache experiment was slower and reverted. Dated lists still construct their rows synchronously; external source latency and real low-end handset GPU/thermal limits cannot be eliminated or certified by desktop preview. No promise of zero lag or perfection.
