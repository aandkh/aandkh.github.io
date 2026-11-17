# API request coordination

`api-client.js` shares simultaneous equivalent public JSON GET requests. Query
parameter order is normalized for the request key; values, including precise
coordinates and filters, are not rounded or dropped. Each consumer receives an
independent readable `Response`. Cancelling one consumer leaves others running;
the final cancellation aborts the source request. The pending map holds at most
16 requests and removes each entry when its response body completes. There is
no completed-response cache, persistent storage or visitor identifier.

Explicit `cache: 'reload'`, `'no-cache'` and `'no-store'`, writes, custom headers
and non-JSON endpoint paths bypass sharing. Manual refreshes should pass one of
these explicit cache modes when they need a separate network request. The fixed
API prefix, HTTPS origin, omitted credentials, rejected redirects and omitted
referrer remain enforced.

`loadProgressiveLayer` publishes a usable live result when it arrives before
the saved snapshot finishes decoding or enriching. Its final result still merges
the complete saved snapshot. When the snapshot wins, there is no extra raw-live
redraw between that snapshot and the final merged result.

## Measurements and validation

On November 16, 2026, concurrent requests from the development workspace took
3.94 seconds for capabilities, 3.90 for station readings, 5.61 for the point
forecast, and 4.45 for 455 KB of restaurant data. All returned `no-store`.
These observations identify API latency, not a guarantee of browser timings.
The application must therefore display available local sources promptly and
avoid using capabilities or slow optional sources as startup gates.

`node --test scripts/api-request-test.mjs` verifies ten equivalent simultaneous
requests produce one fetch, individual body ownership, independent cancellation
before and during streaming, retry after failure, request limits, and refresh
bypasses. `node scripts/test-progressive-layer.mjs` checks both source completion
orders and final merging. `node scripts/security-boundaries-test.mjs` retains
the existing URL and request security checks.

A local 315,794-byte JSON microbenchmark over 30 iterations measured 1.79 ms for
direct fetch/body parsing and 2.19 ms through the shared client. The small local
body-handling cost replaces redundant requests that each waited several seconds.
