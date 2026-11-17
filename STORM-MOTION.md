# Reported storm motion

`storm-motion.js` draws the motion explicitly published by NOAA/NWS for a warned
storm. It reuses the live alert controller's features and makes **no network
requests**. It does not infer motion from surface wind, cloud cover, rain chance,
or the apparent movement of radar imagery.

## Official source semantics

Verified against NOAA/NWS documentation on 2026-11-17:

- [NWS CAP documentation — eventMotionDescription](https://vlab.noaa.gov/web/nws-common-alerting-protocol/cap-documentation)
  gives the report timestamp with UTC offset, the direction the storm is coming
  **from**, speed in knots, and signed WGS84 latitude/longitude pairs. Multiple
  pairs describe a reported storm line. NOAA's example with `062DEG` moves toward
  the southwest, not northeast.
- [NWSI 10-1701, Text Product Formats and Codes](https://www.weather.gov/media/directives/010_pdfs/pd01017001curr.pdf)
  documents `TIME...MOT...LOC`: UTC time, direction **from**, knots, and coordinate
  pairs coded in hundredths of degrees. Its unsigned longitude convention depends
  on the issuing office. The text fallback therefore accepts only continental-US
  western-longitude coordinates; explicit signed CAP coordinates take priority.
- [NWS tracking-line service notice](https://www.weather.gov/media/notification/pdfs/scn07-23trckg_wrng.pdf)
  supplies an example where a storm traveling northeast has `248DEG` source
  direction. This corroborates the required 180-degree inversion.
- [NWS API documentation](https://www.weather.gov/documentation/services-web-api)
  documents active alerts and identifies its public data as free to use.

The official GIS inventories checked exposed warnings, radar imagery, local storm
reports and tropical-cyclone tracks. A dependable lightweight public feed of all
current thunderstorm-cell motions was not established in this review. Accordingly,
this layer covers **warnings/statements with explicit published motion**, not every
rain area or storm visible on radar. Zero arrows means no usable current motion
records, not a declaration that no storms exist.

## API and integration

```js
import {createStormMotion} from './storm-motion.js';
const motion = createStormMotion(map, {onSelect: record => openAlert(record.alertId)});
// weatherAlerts.onStatus receives the latest current raw NWS GeoJSON features:
motion.update(state.features);
motion.setVisible(liveRadarContextIsVisible);
// On disposal:
motion.destroy();
```

`normalizeStormMotion(alert, {now})` returns one motion or `null`. `stormMotions`
accepts an array or a FeatureCollection. Each accepts a raw feature or a normalized
alert record retaining the original as `.feature`.

A motion preserves the original feature and contains `alertId`, stable VTEC-based
`id` when available, `event`, `sourceUrl`, `issuedAt`, `reportedAt`, `expiresAt`,
`fromDegrees`, `toDegrees`, `direction`, `speedKnots`, `speedMph`, `stationary`,
`positionType`, all `points` in `[latitude, longitude]` order, and the marker's
`lat`/`lng`. `stormMotionLabel` produces the source-timed accessible text.

Controller methods are `update(alerts, {now})`, `setVisible(boolean)`, `expire(now)`,
`getState()` and `destroy()`. Construction does not fetch data or display anything.
The controller starts hidden. `getState()` returns `{visible, count, motions}`.
An optional `leaflet` instance and clock/timer functions support deterministic
integration tests.

Only display these arrows in a current/recent observed-radar context. Hide them
when displaying future radar or historical frames; they are not future-motion
forecasts or a reconstruction of a past frame. A current arrow's exact report time
remains in its tooltip and accessible title even when the radar frame is recent.

## Presentation and lifetime

- The arrow points **toward** `(fromDegrees + 180) % 360`. Knots convert to mph
  using 1.150779448. A zero-knot report is displayed as stationary, without a
  directional arrow even if the source retains a direction.
- Arrow length is a fixed display size, not a travel-distance scale or projected
  track. It stays at the published report position as time passes. For a line,
  the complete reported line is retained and the arrow attaches to an actual
  middle reported point; no centroid or extrapolated location is substituted.
- The marker has no permanently visible text badge. Report and issue timestamps,
  travel direction/speed and warning type are in its tooltip/title; an optional
  click opens the parent alert. The `storm-motion` pane is 480, below traffic
  badges, ordinary marker badges and the selected gold pin at 675.
- Visibility ends at the earliest of alert expiry, alert end, and 30 minutes after
  the motion report. Thirty minutes is this display's conservative maximum age,
  not an NWS validity guarantee. Expiry is scheduled once for the nearest record;
  no animation loop or frequent polling is introduced. Hidden layers have no
  expiry timer and revalidate on reopening.
- Test/exercise/cancelled/expired messages and invalid/future motion times are
  rejected. The latest issued VTEC event supersedes older copies, including a
  cancellation. Identical position/time/motion reports are deduplicated. The text
  parser rejects ambiguous multi-segment products instead of choosing a segment.
- UTC-only text times resolve against the issuance date, including midnight
  rollover. Reports more than two hours before issuance or more than two minutes
  after issuance/current time are rejected. Motion positions are limited to at
  most 40 source points per report as a defensive input bound.

## Verification

```sh
node scripts/storm-motion-test.mjs
```

Tests cover CAP and text direction inversion, knots conversion, line points,
stationary reports, UTC midnight, timestamps, expiry/cancellation/update handling,
invalid input, the absence of wind-based inference, exact anchors, timer disposal,
and quiet marker rendering. The fixtures exercise official documented formats with
controlled dates; they are not presented as current storm observations.
