# November 18 release-day theme

Andymap shows the vivid Vice sunset theme during November 18, 2026 in St. Louis. At midnight CST on November 19 (06:00 UTC), the map switches to the light or dark session palette already selected for that visit. Open tabs switch on the timer or when they return from sleep. Later visits start with the regular randomized palette before the first paint.

Each of the 41 session palettes supplies three coordinated colors in `session-palettes.js`. The shared rules in `today-palette.css` use those colors for the header, menus, search and primary controls. The rules adjust tint strength for dark and light maps. The glow is static. Forced-colors mode uses the browser’s control rendering.

Run `node scripts/today-palette-test.mjs` to check the transition, and `node scripts/session-palettes-test.mjs` to check every palette and the text and focus contrast across its gradients.
