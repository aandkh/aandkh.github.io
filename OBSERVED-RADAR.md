# Past-hour radar

`observed-radar.js` supplies `createObservedRadar(map, {onStart, onClose, onForecast})`. It creates only a compact playback panel, not another floating launcher. The controller exposes `start()`, `stop()`, `getState()`, `restoreState(state)` and `active`. State stores an absolute ISO observation time. Restoring is paused; expired shared times are replaced by the nearest available observation with an explicit notice.

Start calls `onStart` immediately so the app can suspend current radar, clouds, lightning and motion before historical frames appear. Keep official current warnings available, distinctly labeled. Current station readings should remain explicitly current or be hidden; the loop does not fabricate historical station readings. `onForecast` adds a “Next 6 hours” switch, closes the past panel and delegates forecast activation to the app.

## Source and accuracy

Official source: [NOAA/NWS MRMS time-enabled base-reflectivity ImageServer](https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer). NOAA documents its moving history window and epoch-millisecond times. The implementation queries only the latest 40 CONUS records, requesting three fields and no geometry. It does not download service-wide capabilities. Actual acquisition timestamps and exact raster IDs determine frames; [ArcGIS lock-raster exports](https://developers.arcgis.com/rest/services-reference/enterprise/export-image/) prevent silently substituting another time.

The loop selects seven available observations nearest 10-minute targets across the latest hour, retaining real timestamps and never interpolating weather. At most eight frames are accepted. Future records, wrong regions and duplicates are discarded; history shorter than 45 minutes, a gap larger than 20 minutes, and a newest frame older than 30 minutes are unavailable. More than 15 minutes of source delay is labeled. Paused playback is checked again before showing another frame, so expired sessions cannot resume as if still recent. Radar reflectivity indicates echoes, not rainfall accumulation, lightning strikes, storm rotation or a forecast. A clear/transparent frame is valid; it is not used to infer that no weather hazards exist.

The image is a fixed square in Web Mercator centered on St. Louis (38.63, −90.4), extending 220 km in projected coordinates in each direction. Both export and Leaflet bounds use this exact projection. The panel calls this the St. Louis region; it does not pretend to cover the entire map when panned elsewhere.

## Performance and lifecycle

- No source request until explicitly opened; two-minute metadata reuse through the shared weather request cache.
- One 512×512 PNG per frame, independent of zoom and viewport movement; no tiled frame pyramids.
- At most two concurrent image downloads, one-frame lookahead and priority for the newest scrub request.
- At most eight frames; each image response is capped at 2 MiB. Eight decoded RGBA images occupy about 8 MiB, excluding browser overhead.
- Scrubbing is coalesced for 100 ms. The displayed timestamp changes only after its image loads. Playback stops at the newest observed frame and pauses while the page is hidden.
- Closing aborts requests, drops queued jobs, removes overlays and revokes object URLs. Late responses cannot reopen playback. Failed images can be retried.
- CSP requires `https://mapservices.weather.noaa.gov` in `connect-src` and `blob:` in `img-src`.

## Validation

Run `node --test scripts/observed-radar-test.mjs`. Tests cover real-time selection and freshness, exact time/ID and regional export bounds, shared requests and two-load concurrency, queue priority, disposal/retry, absolute shared times, controller display and switching, and closing during metadata loading.

Live check on 2026-11-17: the bounded CONUS catalog returned 16 rows in 1,758 bytes; exact-raster 512px exports decoded successfully. CORS returned `https://www.andrewhanes.com` for the site's Origin header. The regional image was transparent during this check; a full-CONUS diagnostic export contained echoes, confirming a functioning source rather than assuming every clear regional image means a failure. Measured single requests took about 2.8 seconds for catalog and 3.2 seconds for regional export from the development environment; these are source timings, not an end-user performance guarantee.

The map’s floating Play button opens forecast radar for the next six hours. Observed past-hour playback remains an explicit option in weather controls and the forecast panel; it does not override the default launcher.
