# Observed lightning map

`weather-lightning.js` uses NOAA nowCOAST's public **15-minute accumulated
lightning density** product, at approximately **8 × 8 km** resolution. The
cells are observations aggregated from Vaisala NLDN/GLD360, not individual
strike positions, forecasts or proof that an area without colored cells is
safe. Keep those distinctions in the weather legend.

## Official source and distribution

- [Ocean Prediction Center product description and public distribution terms](https://ocean.weather.gov/lightning/lightning_pdd.php), sections 5.4 and 5.6: the Level 5 derived product is appropriate for public distribution. This permission does not cover redistributing raw Vaisala detections.
- [nowCOAST WMS capabilities](https://nowcoast.noaa.gov/geoserver/observations/lightning_detection/ows?service=WMS&version=1.3.0&request=GetCapabilities): `ldn_lightning_strike_density`, `lightning_density` style. The service advertises no fees or access constraints and the layer description specifies 15-minute updates and 8 km cells.
- [Official density palette](https://nowcoast.noaa.gov/geoserver/observations/lightning_detection/ows?service=WMS&version=1.1.1&request=GetStyles&layers=ldn_lightning_strike_density): the ordered 17 positive density bands are mapped to amber opacity, preserving their relative order. Source-transparent pixels stay transparent. An unexpected opaque color rejects the image rather than silently fabricating a density category.

Credit: **NOAA/NWS nowCOAST; derived from Vaisala NLDN/GLD360**. The controller
exposes that credit and the official information link. Keep it in weather
sources and map credits.

## Integration

```js
import {createWeatherLightning} from './weather-lightning.js?v=20261117-performance';
const lightning=createWeatherLightning(map,{onStatus:state=>updateWeatherLegend(state)});
lightning.setVisible(weatherEnabled && !forecastPlaybackActive);
// Explicit overall weather refresh:
lightning.refresh({force:true});
// Remove listeners, image and timers on map destruction:
lightning.destroy();
```

Add `https://nowcoast.noaa.gov` to the page's CSP `connect-src`. Existing
`img-src blob:` allows the locally decoded overlay. WMS requests use CORS,
omit credentials, reject redirects and send no referrer. A live GetMap check
on 2026-11-17 returned `Access-Control-Allow-Origin: *` and valid PNG. The
regional empty frame was 1,075 bytes, fetched in 5.53 seconds during this
environment's upstream latency test; it generated no visible map overlay.
Because this is independent background work, that latency does not block
weather readings, place data, the map or other weather layers.

`getState()` and `onStatus` provide:

- `visible`: requested by the weather controls; `active`: an actual nonempty overlay is showing.
- `loading`, `status`: `off`, `loading`, `ready`, `empty`, `delayed`, `unavailable`, or `stale`.
- `time`: original observation frame in UTC, or null; `ageMinutes`, `hasActivity`, `detail`, `credit`.

An `empty` result means this product shows no density cells in its region,
not that no lightning can occur. `delayed` retains the original timestamp,
and should be labeled as the last observation with a failed update. Calling
`getState()` also expires an outdated overlay.

## Performance and freshness limits

- One fixed St. Louis regional **512 × 401** PNG per new published timestamp. No map movement/zoom listeners, tile grids, point markers, animation or history cache.
- Independent requests; no API capabilities dependency or shared weather loading gate. Hidden tabs do not fetch and cancel pending requests.
- Metadata revalidates at most every five minutes while enabled. Simultaneous refreshes share one request. Explicit refresh revalidates metadata, but never downloads the same frame twice.
- WMS `TIME` is an exact UTC timestamp found in this layer's capabilities; never `current`, a guessed time or the time the HTTP request completed. Frames older than 45 minutes are removed. Future timestamps beyond two minutes are rejected.
- An older capabilities response cannot move an already displayed observation backwards. Failed updates retain a fresh prior image only until its original 45-minute expiration, including while the tab is hidden.
- The regional image is decoded once, inspected once for activity and tinted once. Empty frames do not create an overlay. At most one displayed image and one incoming replacement are held. Replacements, canceled late decodes and destroy release their object URLs.
- Request deadline: 12 seconds. PNG limit: 2 MB and 512 pixels per dimension; metadata limit: 250,000 characters. Unexpected content, stale metadata and decoder errors fail independently of the map.

## Verification

```sh
node scripts/weather-lightning-test.mjs
```

Tests cover exact source timestamps, list/interval time dimensions, outdated
or future metadata, fixed-region request limits, ordered amber categories,
empty frames, duplicate refreshes, observation retention and expiry, hidden
tabs, cancellation during decode, independent newer requests, release of old
images, and failure responses that must not appear as lightning.
