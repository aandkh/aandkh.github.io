# Birdwatching community additions — 2026-11-16

This is a requested static directory addition, not a new daily research job. Do not routinely re-read these threads or regenerate these records. Only change a record for a reported correction, surfaced closure/access advisory, broken source, or explicit new research request.

`birding-community.json` preserves the six existing official birding destinations and adds eight public destinations. `birding-community.js` merges cached local additions with the existing live response, preserving remote IDs/timestamps and preferring fresh remote properties. One session-level JSON fetch supports the local fallback and repeated map pans. All new records carry community evidence, official access links, coordinate provenance and a non-sighting location label. No reported bird is asserted to be currently present.

## Evidence reviewed

- r/StLouis, “Your fave birding spots”, April 9–10, 2025: https://www.reddit.com/r/StLouis/comments/1jvjp7x — recommendations for Cliff Cave, Forest Park and Powder Valley; a commenter describes previous late-spring Mississippi-kite sightings at Jefferson Barracks. Dates are comment dates where applicable. Search retrieval returned the dated discussion; direct Reddit opening was unavailable.
- r/STL_Birding, March 8, 2026: https://www.reddit.com/r/STL_Birding/comments/1rojw3k/pileated_woodpecker_at_emmenegger_park_3826/ — photographer reports a pileated woodpecker. The separate automated Merlin identification mentioned in that thread is deliberately not repeated.
- r/StLouis, May 11, 2026: https://www.reddit.com/r/StLouis/comments/1tacy47/mississippi_kite_in_francis_park/ — photograph titled Mississippi Kite in Francis Park. Historical report attribution only.
- St. Louis Audubon Society community hotspot guide: https://stlouisaudubon.org/slas-birding-hotspots/ — Tower Grove and Busch Greenway/Duckett Creek. Guide publication date is not invented; `date` is null. Its 2026 PDF is https://stlouisaudubon.org/wp-content/uploads/2026/05/SLAS-birding-hotspots-2026.pdf .

Official corroborating pages are recorded on each feature. Forest Park Forever and Tower Grove Park directly describe their birding habitats/programs; Great Rivers Greenway describes Cliff Cave and Busch Greenway; City of St. Louis identifies Francis Park; Missouri's official ShowMe250 directory identifies Jefferson Barracks. MDC search-indexed records corroborate Emmenegger and Powder Valley. Direct MDC Emmenegger and County Jefferson Barracks fetches returned 403, so no claim of checking current access is made. Source-check dates mean reviewing the cited evidence, not confirming current operating conditions.

## Coordinate provenance

Forest Park, Francis Park, Tower Grove and Jefferson Barracks use the existing OpenStreetMap polygon representative points from `quieter-parks.json`; original OSM object links are included. These are park reference points, not entrance directions, Gaddy Garden or Kennedy Forest coordinates. Those sub-sites are mentioned in sourced descriptions only.

Powder Valley uses MDC's published `POINT (-90.428883 38.556131)` at https://education.mdc.mo.gov/taxonomy/term/1300 . Duckett Creek uses Audubon's explicitly published parking coordinates 38.69460 N, 90.68446 W, corroborated by Great Rivers Greenway's public trailhead description. Cliff Cave uses the published visitor-location coordinates at the Lewis and Clark Trail Experience, corroborated by Great Rivers Greenway. Emmenegger uses the published Wikipedia park reference point, corroborated against MDC's park description and official event address; it is not represented as a precise sighting.

Horseshoe Lake was researched but not added in this patch: the official Illinois DNR closures page surfaced boat-access restrictions and no sufficiently verified entrance coordinate was obtained. Private feeders, ambiguous “No Name Lake” suggestions, and specific nesting locations were excluded.

## Integration and validation

Import `enrichBirding` and `appendBirdingEvidence`. Use `enrichBirding(null)` for the local progressive snapshot and `enrichBirding(remoteResult)` for remote enrichment. Append evidence in the birding detail view; it is two simple source links, with no separate group, disclaimers or expandable menus. Existing descriptions contain the attributed context.

Run `node scripts/birding-community-test.mjs`. Tests cover the 14 records, existing six IDs, coordinate bounds, preservation of remote verification dates, same-place name deduplication, and one-fetch cache. No static maintenance schedule is added.
