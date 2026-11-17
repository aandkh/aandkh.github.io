# Current radar metadata fallback

Current radar previously waited for the general map API before requesting
imagery. An episodic slow API response left the map without radar and its key
without a timestamp until the 20-second layer timeout. `radar-metadata.js`
races that API against the actual imagery provider's small metadata response,
returns the first valid result immediately and cancels the losing subscriber.

## Sources and timestamp rules

- Intensity: [NOAA `conus_bref_qcd` capabilities](https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?service=WMS&version=1.3.0&request=GetCapabilities).
- Surface precipitation type: [NOAA `conus_pcpn_typ` capabilities](https://opengeo.ncep.noaa.gov/geoserver/conus/conus_pcpn_typ/ows?service=WMS&version=1.3.0&request=GetCapabilities).
- Winter forecast: [IEM HRRR +120-minute precipitation type metadata](https://mesonet.agron.iastate.edu/data/gis/images/4326/hrrr/refp_0120.json).

The two WMS modes select their exact named layer and reuse the existing
`environment.js` `radarTime` helper. Their published timestamp must be dated
with a timezone, no more than 30 minutes old, and not more than two minutes
ahead of the client's clock. Neither download time nor a guessed two-minute
interval substitutes for the observed timestamp.

Winter uses the actual `model_init_utc` and `model_forecast_utc` supplied by
IEM, verifies the published lead is exactly 120 minutes and matches those
times, and rejects model runs older than six hours. Its note and `isForecast`
flag explicitly identify a model forecast. The same checks apply to the API
winner. A wrong-mode, unavailable or undated API result cannot win the race.

Live verification on 2026-11-17 from the site origin found all three sources
returning HTTP 200 with `Access-Control-Allow-Origin: *`. Intensity and type
metadata were about 8 KB and each returned in 4.24 seconds; winter metadata
was 114 bytes and returned in 3.65 seconds. The captured NOAA XML parsed to
distinct published intensity/type times correctly.

## Integration and limits

```js
const result=await loadRadarMetadata(mode,{
 signal:controller.signal,force,
 loadPrimary:({signal})=>remote('radar',8000,signal),
 onUpdate:commit
});
```

`onUpdate` is optional and is called once, with the same result returned by
the promise. The result has `{id:'radar', raster:true, features:[], mode,
observedAt, status:'live'}` plus source and explanatory metadata; winter also
has `modelInit` and `isForecast:true`.

Add `https://opengeo.ncep.noaa.gov` to CSP `connect-src`; the IEM origin is
already allowed. Requests omit credentials and referrers, reject redirects,
and explicitly revalidate provider HTTP caches.

- Eight-second overall deadline, including a primary callback that ignores cancellation.
- A successful per-mode result is reused for at most two minutes; freshness is checked again on every read.
- `weather-request.js` coalesces simultaneous provider requests and keeps cancellation independent for each consumer. This also covers reading the response body.
- At most one small provider metadata request and one API request per uncached mode; no image or tile downloads in this helper.
- Metadata response limit: 128,000 characters/advertised bytes. Provider errors and invalid timestamps reject without producing an empty or falsely current radar frame.
- Explicit refresh bypasses successful response caches. Source failures are not cached as successful data; normal app retry cadence still applies.

```sh
node scripts/radar-metadata-test.mjs
```

Tests cover slow-API recovery, either independent source failing, matching
layers and modes, stale/future/invalid timestamps, cache and explicit refresh,
independent cancellation, a bounded hung source, and exact winter model times.
