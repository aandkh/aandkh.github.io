# Historical events

`historical-events.json` is a deliberately bounded set of 12 reviewed regional records. It is not a complete historical-events database. The History layer may show these pins separately from the existing NASA historical satellite imagery mode.

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

Historical dates use `historicalDate`, `historicalEndDate`, `historicalDateLabel`, `dateAccuracy` and `dateSort`. Never populate upcoming-event `start`/`end` from these dates: historical entries must not be expired or included in today's upcoming events. Year-only dates remain year-only in the visible label; January 1 in internal sorting is not a claimed event date. Date labels are preformatted, so no UTC-to-Chicago day shifts occur.

## Scope and refresh

City, County and nearby St. Charles records appear together. Jurisdiction metadata supports coverage review only, not a regional switch. This is stable reference information: do not add a daily/weekly/monthly research or rebuild job. Revisit only for a concrete correction, credible source revision or broken reference. Do not refresh `sourceCheckedAt` merely by loading the JSON.

After changing this module/data, run `node scripts/historical-events-test.mjs`. The module validates geographic bounds, source URLs, date presence and required location notes; supports category/search/century and oldest/newest sorting; caches the static JSON request. Normal UI uses source links and concise location notes, not large explanatory menus.
