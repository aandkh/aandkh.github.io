# Permanent Vice sunset palette

Owner direction November 18: retain today's vivid Vice City-inspired appearance,
then make it permanent with 40% less vibrance starting tomorrow.

`today-palette.js` keeps vivid mode through November 18, 2026 America/Chicago.
At `2026-11-19T06:00:00Z` (midnight CST), it switches to permanent soft mode.
Open tabs switch with a timer; pageshow and visibility checks cover suspended tabs.
All future visits immediately receive soft mode. No further deployment is needed.

`scripts/build-vice-soft.py` generates the soft CSS from vivid CSS by multiplying
HSL saturation and glow opacity by 0.60, preserving hue and lightness (with 8-bit
rounding). It does not apply a filter to map content or recolor semantic data.
Dark/light modes remain separate. No logos, tracking, storage, access, layout,
pointer handling, or map behavior changes.

Normal session palettes are retained underneath for potential future changes.
To disable the Vice theme, remove the two today-palette tags from index.html.

Verification: `node scripts/today-palette-test.mjs` tests midnight transition,
long-term permanence, sleeping tabs, repeat initialization, and both palette
families' text/focus contrast. `node scripts/session-palettes-test.mjs` checks the
unchanged underlying palette system.
