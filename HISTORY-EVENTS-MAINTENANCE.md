# Historical events

`historical-events.json` is a curated collection of 4,091 reviewed regional records, including deep-time fossil/archaeological evidence and history through 2025. It is not a complete historical-events database. The History layer includes seven eras, 13 topics, a two-handle range, full regional browsing, source-backed details and dated cluster lists. Wildlife links directly to ancient-life records. Existing NASA historical satellite imagery remains a separate view within History. All original 214 identifiers remain unchanged; shared links still resolve. See `HISTORY-ARCHIVE-EXPANSION-2026-11.md` for current coverage, source families and review decisions; `HISTORY-RESEARCH-2026-11.md` documents the initial collection.

## Evidence and dates

Each record has a historical source and a coordinate/location reference. The review on November 16, 2026 checked event dates and descriptions against National Park Service, Missouri State Parks, Missouri Historical Society, Washington University, City of St. Louis, Missouri Civil War Museum and Lafayette Park Conservancy pages. Short summaries are original paraphrases; no source images are reproduced.

Numeric coordinates for commemorative markers come from the cited Historical Marker Database records (decimal minutes converted to degrees), not claims of precise battle locations. The Eads reference point is from ASCE; the courthouse and Arch grounds coordinates are from NPS event-location listings. Fort Belle Fontaine's reference point lies inside the existing reviewed OSM park boundary (`way/733761148`); Jefferson Barracks uses the previously reviewed OSM park reference point (`way/200053837`). Existing OpenStreetMap attribution remains required.

Every record displays a pin-location explanation. Particularly important:

- Fort Belle Fontaine's original riverside site is lost to river-channel changes. The pin marks the park, not the 1805 fort footprint.
- Camp Jackson's pin is a commemorative marker near Compton/Laclede, not a precise shooting site. The camp and subsequent violence extended over multiple locations.
- Fort San Carlos is represented by a nearby historical marker; no invented battlefield outline.
- The Dred and Harriet Scott pin concerns the St. Louis petitions/trials, not the Supreme Court decision made in Washington.
- The 1896 tornado pin marks a documented damaged location in Lafayette Park, not the tornado origin or full track.
- The 1904 Olympics record identifies the late-August/early-September concentration at Francis Field. It does not claim all 1904 Olympic competitions occurred on those dates or at that venue.

Dates may be `YYYY`, `YYYY-MM` or `YYYY-MM-DD`; source precision is preserved. The year slider includes records whose documented periods overlap the selected years. Historical dates use `historicalDate`, `historicalEndDate`, `historicalDateLabel`, `dateAccuracy` and `dateSort`. Never populate upcoming-event `start`/`end` from these dates: historical entries must not be expired or included in today's upcoming events. Year-only dates remain year-only in the visible label; January 1 in internal sorting is not a claimed event date. Date labels are preformatted, so no UTC-to-Chicago day shifts occur.

## Scope and refresh

City, County and nearby St. Charles records appear together. Jurisdiction metadata supports coverage review only, not a regional switch. This is stable reference information: do not add a daily/weekly/monthly research or rebuild job. Revisit only for a concrete correction, credible source revision or broken reference. Do not refresh `sourceCheckedAt` merely by loading the JSON.

After changing this module/data, run `node scripts/historical-events-test.mjs`. The module validates geographic bounds, source URLs, date presence and required location notes; supports topic/search/era/year-overlap and oldest/newest sorting; caches the static JSON request. Normal UI uses source links and concise location notes, not large explanatory menus.

## Performance and interface

The static catalog is fetched only when History is opened, and the request is shared/cached for the page session. Search metadata is compiled once per immutable record. Results initially render 80 rows with explicit load-more; map points use the existing clustering system. Timeline dragging updates the two handles and labels locally, committing map/list filtering on release. Canceled rail drags roll back. Keyboard changes retain focus; era/category/year/sort settings survive saved/shared map state. Mobile controls retain the compact panel and leave the map visible. No new background fetch or refresh timer is introduced.

## Prehistoric dates and multi-topic records

Deep-time records use numeric `historicalYear` / `historicalEndYear` and an honest `historicalDateLabel`; they need not contain ISO `historicalDate` or `dateSort`. Negative values are an approximate BCE projection for filtering, never a substitute for geological intervals, radiocarbon uncertainty or the original source age wording. Year zero is not accepted. Use the exported `historicalYears()` helper for dates and sorting; do not assume every record has an ISO date. `historicalPeriods` preserves noncontiguous documented spans. `eventCategories` permits one genuine record to appear under multiple subjects without creating duplicate rows.

`ancientWildlife: true` enables direct Wildlife browsing. Preserve collection IDs, accepted and originally identified taxon names, uncertainty qualifiers, published references and geographic precision. Fossil occurrence counts are evidence counts, not animal population/abundance estimates. Do not convert collection-reference points into precise fossil-hunting directions or claim access to private/protected sites.
