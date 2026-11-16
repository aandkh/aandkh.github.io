# Andymap security maintenance

Reviewed 2026-11-16 for the existing public GitHub Pages frontend and same-origin
`/emergency/` demo. This is a targeted code review and hardening pass, not a
penetration-test certification or a claim that all OWASP categories are solved.

## Protections implemented

- All reviewed feature/source URL sinks use a shared HTTP(S)-only validator.
  Executable schemes, credentials, control characters, nonstrings and URLs over
  4096 characters are rejected. Untrusted labels use text nodes; the Floodplains
  tooltip no longer passes data to Leaflet's HTML-string renderer.
- Main-page CSP blocks inline/eval scripts, off-origin scripts, embedded objects,
  base-URL overrides, and unapproved API connections. MapLibre blob workers and
  Leaflet's inline positioning styles remain allowed. Images allow HTTPS for
  published source photos and map tiles. HTML pages use a no-referrer policy.
- MoDOT's non-CORS JSONP feed runs in an opaque-origin iframe (`allow-scripts`,
  without `allow-same-origin`). It cannot access the map DOM or saved maps. The
  parent checks the sending frame, null origin, random token and bounded schema.
  The bridge only requests three fixed official layers, rejects incomplete/capped
  results, and cleans up on completion, timeout or abort. Its bootstrap has an
  exact SHA-256 CSP hash; rebuild with `node scripts/build-traffic-bridge.mjs`.
- MapLibre GL JS 5.6.1 has the narrowly scoped upstream security fix for
  GHSA-jrc7-96c5-q579 backported. The sanitizer snapshots attributes before removing
  them, so adjacent dangerous attributes are not skipped. The version has not
  been relabeled; upstream commit and original/patched SHA-256 are recorded in
  `vendor/maplibre-security-patch.json`. This does not claim a general dependency
  upgrade. Main MapLibre attribution is disabled in favor of our own text-based
  credits, but the library itself is now patched too.
- API client paths reject traversal, ambiguous encodings, separators, controls,
  fragments and oversized input. Requests omit credentials/referrers and reject
  redirects instead of following an unexpected origin.
- Incident CSV exports neutralize spreadsheet formulas, including prefixes hidden
  behind whitespace/control characters.
- Shared-link guards were tested with actual compact packets: prototype keys,
  duplicate keys, nesting/removal limits, malformed UTF-8, excessive transport
  size and compressed expansion bombs. Existing bounded decoding and allowlisted
  state already reject these. Valid compact/plain/legacy links remain supported.
- The emergency demo escapes saved names and avatar attributes, rejects inherited
  action handlers, avoids selector interpolation, and has its own restrictive CSP.
  Its PIN/passphrase gate remains a local simulated demo, not real authentication.

## Checks

```sh
node scripts/security-links-test.mjs
node scripts/security-share-test.mjs
node scripts/security-boundaries-test.mjs
node scripts/traffic-security-test.mjs
node scripts/build-traffic-bridge.mjs --check
node --experimental-vm-modules scripts/security-emergency-test.mjs
node --experimental-vm-modules scripts/check-modules.mjs
```

Relevant sharing, Wildlife, incidents/CSV, outages, parks, Joyrides, quieter
surroundings and weather-overlay tests were also run. Do not execute an entire
static-data refresh as part of these checks. Re-run security tests when modifying
these input or rendering boundaries.

## Hosting and backend limits

GitHub Pages does not consume a custom `_headers` file. Meta CSP cannot enforce
`frame-ancestors`, X-Frame-Options, HSTS or `X-Content-Type-Options`; do not add fake
meta equivalents or claim clickjacking protection. These need an HTTP-header-capable
hosting/proxy configuration. The public HTTP URL still returned HTTP 200 during
review; enable **Settings → Pages → Enforce HTTPS** through an authenticated owner
session. The connected GitHub tool has no Pages-settings mutation, and the browser
was not signed in, so this setting was not changed.

The Fly API is separate: `https://andymap-hanes-api.fly.dev`. Its public capabilities
response was checked and already includes origin-specific CORS, Vary: Origin,
CSP, nosniff and SAMEORIGIN. No backend source/deployment access was available here.
Server-side authorization, SQL/command injection, SSRF, rate limits, upstream
fetch restrictions, secret handling and logging are not verified by frontend
validation. They require an authenticated backend review/deployment. No private
key/token patterns were found in the bounded tracked-file scan; this is not proof
that every possible secret has been excluded.

## References

- https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- https://github.com/maplibre/maplibre-gl-js/security/advisories/GHSA-jrc7-96c5-q579
- https://github.com/maplibre/maplibre-gl-js/commit/1da69f3cd913a39fa948708e01478663bf48bc27
