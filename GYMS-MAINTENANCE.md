# Gym directory

`gyms.json` is a small static GeoJSON snapshot loaded on demand by `gyms.js`. It must remain one combined metro directory, never separate city/county tabs. Current coverage is partial: 87 gyms/studios (36 neighborhood listings, 14 regional/community clubs, 37 national-chain locations).

Source query retrieved 2026-11-15 via POST to https://overpass-api.de/api/interpreter:

```
[out:json][timeout:30];
nwr["leisure"="fitness_centre"]["name"](38.4,-90.8,38.9,-90.05);
out center tags;
```

Keep ODbL attribution and each OSM feature's stable `osm:node/...` or `osm:way/...` ID, source URL and exact coordinates. A way center is a mapped feature center, not a surveyed entrance. Exclude schools, private facilities, disused/closed objects, children's gymnastics, dance-only schools and trampoline parks. Mapped fitness studios (yoga/Pilates included) remain useful listings. Do not claim complete coverage or independent ownership just because a national brand was not recognized.

## Explicit local additions and evidence

- **Memento Fitness Club**, 449 Meramec Blvd, Eureka, MO 63025. Stable ID `gym:memento-eureka`. User supplied the address and map coordinates **38.50799, -90.6333**. Preserve this addition even when absent from OSM. Official club site https://mfc.managememberships.com/ was verified through the developer link in https://apps.apple.com/us/app/memento-fitness-club/id6816661040; the City of Eureka also lists the club at https://www.eureka.mo.us/512/Vendors. Do not invent operating hours or an exact opening date. The app offers membership management and class booking.
- Fit City Gym: https://fitcitystl.com/the-best-gym-in-st-louis/ confirms 1601 S Jefferson, local ownership and listed hours. OSM coordinates retained.
- Eagle Gym: https://eaglegym.co/contact/ confirms 2551 Woodson Rd; https://eaglegym.co/ confirms member 24-hour access; https://eaglegym.co/terms-conditions/ states single-location business. OSM coordinates retained.

## Daily maintenance

Refresh the snapshot and review closures, name changes, new openings, addresses, official links and gym classifications. Keep Memento and both city/county coverage. Never replace good reviewed additions with an empty or failed upstream response. `gymGroup` is `local`, `regional` or `national`; local means neighborhood gyms/studios, not verified legal ownership or a quality rating. National franchises follow regional clubs; local CrossFit affiliates may be neighborhood gyms with affiliation, not assumed company-owned branches. Correct known brands using current official location directories.

Check source-backed hours and set `hoursCheckedAt` / `hoursExpiresAt` honestly. Unknown or expired hours remain listed at the bottom within each group. A 24/7 member-access gym does not imply a staffed front desk or free public entry. Do not manufacture memberships, prices, reviews or hours. Website and navigation links are available in place details. `gyms` intentionally allows national chains even though other destination layers may exclude them by owner policy.

Validate `node /tmp/test-gyms.mjs` if present, or equivalent checks: catalog/search discovery; local→regional→national order; Memento exact address/coordinates; actual map pins; gym details; national chain details not blocked by the unrelated chain exclusion; short link and saved-map round trips. Inspect ordinary browser reload after asset-version updates. Gym data is lazy-loaded, shared between simultaneous requests, and held in memory for five minutes; map movement must not rerun external Overpass queries.
