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
