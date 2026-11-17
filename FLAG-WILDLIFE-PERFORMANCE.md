# Flag and wildlife performance

The flag still checks every category, starts at 100 feet, hides empty sections and
uses the same seasonally weighted, privacy-filtered local wildlife candidates.

## Changes

- `spot-source-cache.js` shares static-file reads between successive flags with
  independent cancellation, a three-transfer limit, 24 cached files and a 10-minute
  lifetime. A 100 ms cancellation grace lets a replacement flag reuse an ongoing
  download; abandoned queued work does not fetch and old points cannot repaint.
- `spot-data.js` rejects faraway geometry by cached bounds before walking every
  segment. A 100 m guard covers short regional arcs; long segments and polar
  geometry use the complete distance calculation. Source coordinates and final
  proximity calculations are unchanged.
- Sun/Moon facts publish immediately while optional sky providers load.
  Seasonal wildlife uses its own source queue rather than waiting behind weather
  and other live sources. A flag with no local species cancels its unnecessary
  seasonal consumer and returns empty immediately.
- Park statistics are fetched only if a park actually matches the flag. Matching
  names appear before optional statistics, and only those parks are enriched.
- `wildlife-api.js` contains the source/query/cache code without photo or inspector
  UI dependencies. Request starts stay at least 1.05 seconds apart; at most two
  provider responses overlap. Slow responses no longer hold the next permissible
  start. Cached reads and shared-consumer cancellation remain bounded and tested.
- Wildlife observations, species counts and histogram requests are scheduled
  together. Failure of the main observation query cancels unused metadata work.
  Received response text sizes the cache without serializing the parsed tree a
  second time. Birding and flag seasonality import the small data module directly.

## Measured checks

Run `node scripts/spot-speed-bench.mjs` to compare the pre-change 8a66f631 source
with current code using 15 lookups per committed source and identical feature IDs
and millimeter-rounded distances. This container measured:

| Source | Before | After | Ratio |
| --- | ---: | ---: | ---: |
| Cycling routes |26.9ms|2.0ms|13.4×|
| Joyrides |9.9ms|1.3ms|7.7×|
| Parks |156.6ms|24.4ms|6.4×|

`node scripts/wildlife-speed-bench.mjs` uses four controlled 2-second provider
responses. It measured 8,018 ms before and 5,170 ms after (1.55×), with exactly the same
four requests, at most two in flight and unchanged 1.05 s minimum start spacing.
This is a controlled latency benchmark, not a prediction of visitor network speed.

Behavior checks: `scripts/spot-speed-test.mjs`, source fixtures, spot data and
seasonal tests, existing wildlife request/photo/share tests, birding analytics,
and spot integration. The performance tests cover transfer reuse on moved flags,
independent aborts, bounded queues, retryable failures, early computed facts,
park-statistics omission only when no park matches, early empty wildlife, and
long great-circle geometry that must not be culled by endpoint bounds.
