# November 18 temporary palette

`today-palette.js` enables a GTA VI-inspired pink/violet/turquoise menu palette
only from November 18, 2026 midnight to November 19 midnight in America/Chicago
(CST, UTC−06). The exact expiry is `2026-11-19T06:00:00Z`.

The override is presentation-only. Existing dark and light session palettes remain
untouched underneath. A timer removes the root flag at midnight; visibility and
pageshow checks also handle suspended tabs. Subsequent visits after expiration do
not activate it. No storage, analytics, logos, map data colors, or access settings
are changed. The existing family selector continues to follow Dark/Light/Streets.

To remove early, remove the two `today-palette` tags from index.html. After expiry
the files may be removed along with those tags; no rollback deployment is required.
Tests: `node scripts/today-palette-test.mjs` and
`node scripts/session-palettes-test.mjs`.
