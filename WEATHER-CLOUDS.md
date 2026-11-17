# Current cloud mask beneath Weather precipitation

`weather-clouds.js` uses the **NOAA GOES-18 day/night cloud classification** served
by SSEC RealEarth as `G18-ACMF`. It is observed satellite imagery, not a cloud-cover
forecast and not a brightness threshold applied to an infrared ground image.
The supplied pixels are already white for cloudy/probably-cloudy classifications
and transparent for clear/probably-clear classifications. No image filter,
canvas recoloring, neural inference, or terrain whitening is performed.

## Source verification

- Metadata: `https://clouds.ssec.wisc.edu/api/latest?products=G18-ACMF`
- Exact-frame tile: `https://clouds.ssec.wisc.edu/api/image?products=G18-ACMF_YYYYMMDD_HHMMSS&x=X&y=Y&z=7`
- [Official product inventory](https://clouds.ssec.wisc.edu/products/)
- [Official API documentation](https://realearth.ssec.wisc.edu/doc/api.php)
- [Free-use terms](https://www.ssec.wisc.edu/realearth/terms-of-use/)
- [NOAA cloud-mask day/night description](https://vlab.noaa.gov/web/towr-s/goes-csm)

At 02:52 UTC on November 17, 2026, the latest available frame was 02:30 UTC
(22.6 minutes old), with preceding frames at 02:20, 02:10 and 02:00. Metadata and
PNG responses supplied `Access-Control-Allow-Origin: *`; no API key is required.
The St. Louis tile x31/y49/z7 was a 256×256 PNG of 357 bytes. It contained 12 white
cloud pixels and 65,524 fully transparent pixels. Comparing every pixel to the
four-class `G18-ACM` tile found zero mismatches: probably-cloudy red and confidently
cloudy white became mask-white; confidently-clear black and probably-clear cyan
became transparent. Other regions/frames naturally have different cloud cover.

The mandatory acknowledgement is **Source: SSEC RealEarth, UW-Madison**. Exported
`CLOUD_SOURCE` contains the credit, catalog, origin, product, and terms URL for
existing map credits. Arbitrary-bounds RealEarth imagery is watermarked; this
implementation uses the documented native XYZ tile API instead.

## Root application integration

1. Import `createWeatherClouds` and, where needed, `CLOUD_SOURCE`.
2. Create pane `cloud-overlay`, z-index **300**, `pointer-events:none`. Existing
   precipitation is in `weather-overlay` at 350, above the cloud mask.
3. Construct `createWeatherClouds(map,{onStatus})`. Each status supplies
   `status`, `observedAt`, `available`, `retained`, `refreshing`, and source data.
4. Call `setVisible(true/false)` with the Weather/radar layer's visibility. This
   controller owns its five-minute visible-page refresh; do not add a second
   interval or call it on every map movement. Manual refresh may use
   `refresh({force:true})`.
5. Add `https://clouds.ssec.wisc.edu` to CSP `connect-src`. Decoded images use
   existing `img-src blob:` permission. Do not broaden script permissions.
6. Show the real observed time in existing Weather attribution/status. An absent
   layer on failure is **unknown cloud cover**, never a claim of clear sky.
7. Hide this observed layer during future-radar playback, or explicitly retain
   its observed timestamp so it cannot masquerade as forecast cloud cover. Hide
   it along with other weather overlays in unrelated modes.

`getState()` inspects status; `destroy()` releases layers, URLs, listeners and
pending work. Map unload also destroys the controller.

## Bounded work and validity

Four immutable z7 tiles (x31/32, y48/49) cover the application's geographic limits
38.1–39.2°N, 91.2–89.4°W. The four decoded 256×256 images are georeferenced at their
exact Web Mercator tile bounds. They scale with the map through zoom18 without
requesting invented higher detail. Panning and zooming start **zero** new cloud
requests. No invisible off-region tiles or animation frames are prefetched.

A refresh reads one small latest-time document. If its time is unchanged, no PNG
is requested. For a new time, four bounded PNGs decode off-DOM while the previous
complete frame remains visible. Only after all four succeed is the set replaced
synchronously; frames never crossfade or double their 0.10 opacity. Failures
retain only an unexpired complete previous set. A maximum of four tiles are
visible and eight may temporarily be decoded while replacing a frame.

Original timestamps are never renewed by retrieval. Future/malformed timestamps
and frames at least 60 minutes old are rejected. An expiry timer removes old
imagery even if another source request is pending. Hiding the page or disabling
Weather stops refreshes and cancels pending requests; cancellation/revision
checks prevent late responses from recreating the overlay. A decoded, still-valid
frame can be reused when Weather is reenabled.

The source classifies cloud cover, including likely clouds; it is not a measured
percentage, precise cloud boundary, or complete guarantee of cloud absence.
GOES-18's oblique western viewing geometry can displace high cloud outlines.
The subtle map overlay should remain a broad indication of current cloud cover.

## Verification

`node --test scripts/weather-clouds-test.mjs` tests timestamp/date limits,
source URL bounds, four-tile budget, no navigation fetches, noninteraction,
opacity, exact timestamp retention, atomic all-tile replacement, failed tiles,
expiry while refreshing, background pause, off/on cancellation, and destruction.
No live counters or website data are changed by these tests.
