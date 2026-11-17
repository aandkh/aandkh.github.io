# Crimes & Crashes maintenance

The map always combines St. Louis City and St. Louis County. Agency IDs below select input sources; never expose a City/County switch. Data are reported incidents, not a complete census, neighborhood safety score, or finding of guilt.

## Daily at 6 a.m. America/Chicago

The existing restricted daily runner executes County, then City/Florissant, then
the changed-news watch, then the coverage check **sequentially**. Do not launch a
second archive refresh concurrently. Routine maintenance uses:

```sh
python scripts/refresh-andymap.py --only venues movies sports foodtrucks incidents rivers outages rain
```

The incident stages refresh official County/participating-municipal crime, County Police injury/fatal crashes, the City public map and Florissant's municipal map. Florissant is in St. Louis County; it is not included in the weekly County NIBRS feed, so omitting it silently loses its reports. The stages preserve older months and reviewed releases and report source failures. A failed refresh retains the last verified data and must not be described as a successful check. Run relevant tests when changing an adapter or archive behavior, not as a daily full-site regression suite.

After the machine refresh, visit the primary release pages below, read new and updated reports, and update `incident-reviewed.json` with source-backed occurrence dates, approximate locations, and explicit reported outcomes. Update its `reviewedAt` and per-source `sourceReviews` times only after visiting those sources. A City review does not establish that County and municipal sources were checked. Then run `python scripts/incident-refresh.py --repack` to merge those reviews and rebuild the month index without redownloading feeds. The automated jobs are source downloads; reading releases is a separate part of the requested daily AI maintenance.

### Changed-report supplement for weekly-feed gaps

`scripts/incident-source-watch.py` checks First Alert 4's public
[County RSS](https://www.firstalert4.com/arc/outboundfeeds/rss/category/news/st-louis-county/?outputType=xml)
and [Crime RSS](https://www.firstalert4.com/arc/outboundfeeds/rss/category/news/crime/?outputType=xml).
The Crime desk catches reports not tagged to the County section and also includes
City reporting; the map remains one combined regional view. These are additional
reported cases, not a replacement for the police sources or proof of full coverage.

Read `/tmp/andymap-incident-source-report.json` after the runner. Exit code 2 means
new/changed reports need review, not that their download failed. The persistent
`incident-source-watch.json` stores URLs, publication dates, text fingerprints and
review decisions only. It does not store full articles, inferred scenes or
outcome counts. Conditional HTTP requests and fingerprints
avoid rereading unchanged stories; changed article text reopens review even if
the headline is unchanged. An article leaving the short RSS window never removes
its review record or an archived incident. Fetch/parse failures preserve prior
records. When a feed window no longer overlaps the previous snapshot, inspect
that source's section archive to bridge the gap; do not call the capped response
complete. No unchanged static source inventory needs a research pass.

For each candidate, read the actual article, compare its occurrence and reported
area with archived cases, and record verified additions or corrections in
`incident-reviewed.json`. A feed publication timestamp is never an incident time.
Keep case aliases when independently verified; do not merge unrelated events
merely because their points are close. After review, acknowledge the exact
current revision:

```sh
python scripts/incident-source-watch.py --resolve ARTICLE_URL --disposition mapped --note 'Verified occurrence and public location; added stable incident ID.'
```

Other dispositions are `already-mapped`, `outside-region`, `not-incident`,
`insufficient-location`, `excluded-sensitive`, and `historical-followup`; explain
the actual reason. Acknowledging a candidate is not a source download and must
not be done without reviewing it. Repack only when verified facts changed. Keep
weekly-feed lag visible even when the supplement supplies newer incidents.

Once a week, refresh the full still-available source window (`--days 179` for City, `--days 180` for County) to catch late approvals and corrections. The public mapping provider retains 180 days. The local archive has no seven-day expiration. Do not discard old months when a source ages out a record.

## Source registry and coverage

| Source | Public source / endpoint | Update and limitation |
|---|---|---|
| City official public crime map | [SLMPD documentation](https://slmpd.org/mapping/) → [official shared map](https://www.crimemapping.com/Share/66dfeeb3d9874dc78fdf8be1ad7f0c4c) | Updated daily; 180-day source retention. SLMPD excludes domestic violence, sex crimes, juvenile-related incidents and some unapproved reports. Homicides may be delayed. No outcome counts. |
| City public map/report retrieval | `https://www.crimemapping.com/map/MapUpdated`, `/map/LoadReportJson` | The same public read requests used by that map. Agency 726; whole-City extent. Seven-day windows, two concurrent requests at most; splits date windows if the public 500-record limit is reached. Never accepts truncation, count mismatch, absent date or missing geometry as complete data. This is a public interface, not a promised stable API; source failures require review. |
| Florissant municipal public map | [Florissant Police agency map](https://www.crimemapping.com/map/agency/639) | Agency 639; separate County municipality, absent from County NIBRS. Uses the same public report interface and bounded downloads. Agency-specific extent covers all of Florissant. Latest occurrence and upload lag are tracked independently. Never classify Florissant as St. Louis City. |
| County + participating municipalities | [County Police crime map](https://www.stlouiscountypolice.com/st-louis-county-crime-map/) → [official NIBRS service](https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/crimedata2023_XYTableToPoint2/FeatureServer/0) | Weekly. County Police patrol areas plus participating municipal departments, not every municipality. Each report can contain multiple offenses. Source counts are offense rows; Andymap groups agency + case number. |
| County injury/fatal crashes | [Official vehicle-accident service](https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/Vehicle_Accidents/FeatureServer/0) | Weekly. County Police investigations, not every local/Highway Patrol crash. Includes explicit killed/injured counts. Property-damage-only crashes are omitted from this serious-incident layer. |
| City recent releases | [Crime and investigations](https://slmpd.org/crime-and-investigations/), [force investigations](https://slmpd.org/critical-incidents-and-force-investigations/), [approved crash reports](https://slmpd.org/daily-accident-report/) | Review new and amended stories. A PDF approval date is not an occurrence date. Releases supplement structured data and can add verified injury/death outcomes. |
| County recent releases | [County Police press releases](https://www.stlouiscountypolice.com/department-news/press-releases/) | Selected newer cases can precede the weekly dataset. Check participating municipal departments when a reported incident falls outside County Police patrol responsibility. |
| Highway Patrol / road incidents | [MSHP crash reports, Troop C](https://www.mshp.dps.missouri.gov/HP68/search.jsp), [MoDOT traveler map](https://traveler.modot.org/map/) | Review City and St. Louis County incidents; do not choose victim/driver home county as incident location. MSHP reports exclude crashes investigated by local agencies. MoDOT traffic notices are handled separately by the Traffic layer. |
| Corroboration / discovery | KSDK, First Alert 4, FOX 2 and municipal police/fire releases | Use a dated, attributable report when the primary release is unavailable. Link the actual article, distinguish allegations, and preserve primary attribution. Headlines/search snippets alone are not enough to invent scene coordinates or outcomes. |

`recent-incidents.json.sources` stores each imported source's checked time, latest incident date, cadence, rows downloaded, unique mapped cases, omitted rows, and refresh status. The UI displays City and County source dates together. A fresh download with an old latest incident is still a reporting lag. No blank map area or missing source record means zero crime.

## Archive and review contracts

- `recent-incidents.json` is a minified fast snapshot of the default past week, plus the source registry/month index. Older periods fetch only the needed `incident-archive/YYYY-MM.json` shards. `archiveCount` counts all retained cases; the default period does not download the whole archive.
- `incident-reviewed.json` contains reviewed narrative releases. Keep existing IDs. Automatic City IDs use agency/case number; County IDs hash agency/case number; crash IDs use the official accident ID. Duplicate offense rows never become multiple incidents.
- A review's `alternateIds` links an individually verified structured case to an existing narrative ID. Verify occurrence day, reported block, time/context and event type. Do not merge unrelated incidents merely because they are nearby. Known aliases preserve existing shared links and enrich a single record with the narrative outcomes.
- Incident dates are occurrence dates, never publication dates. Preserve date-only precision when no time is known. Use America/Chicago offsets for documented local times; flag any ambiguous fall-back-hour source time. `incidentStamp()` formats date-only records without inventing midnight or shifting the calendar day.
- `deaths` and `injuries` are present only when explicitly reported, including explicit zero. Homicide classification alone does not establish a numeric death count. Unknown is omitted, never zero. Hospital/driver residence locations are not automatically scene locations.
- Public map coordinates remain approximate: round to three decimals (about 100 m) and show the reported block/intersection. Mask household numbers in titles and addresses; omit names, apartment numbers, victim metadata, and registry data. County sexual-offense rows are excluded. City source exclusions are preserved.
- An approximate neighborhood/block is allowed when a source documents it; label the actual precision. Reject invalid/off-region coordinates. Never attach an invented exact address. Do not infer unreported criminal allegations from location, demographic information or news sentiment.
- Keep factual summaries short and link the official source. Do not copy article bodies, photos, provider styling or proprietary map assets. Requests fetch only the public crime categories, never registry categories 17/18.
- If an outcome, sort or category is absent from the available data, do not create a nonfunctional control. Multiple selected types combine with OR. All active filters affect both pins and list. CSV exports include provenance and unknown-outcome labels; spreadsheet formula injection is escaped.

## Validation

`incident-tests.py` covers pagination/truncation, City map/report joins, Web Mercator conversion, rejected missing dates and invalid geometry, agency/case deduplication, explicit vs unknown outcomes, sensitive-category exclusion, DST offsets, stable aliases and permanent monthly archiving. `incident-tests.mjs` covers local dates, bad dates, date-only display, range/custom/type/outcome sorts, unknown-outcome analytics, safe CSV, lag metadata, and lazy archive requests. UI verification should include past week, 30 days, all archived, a custom day, multiple types, fatal and injury filters, and selecting a list record while keeping the map visible.

## Combined coverage checks and fatality summaries

`incident-coverage-check.py` runs after both downloads. It requires the City, County NIBRS, County injury-crash and Florissant sources, verifies both geographies still exist in the archive, and prints current-week / 30-day / total counts. Missing sources, fetch failures and overdue publication dates return nonzero. County weekly sources at six or more days of occurrence lag produce visible warnings, even when the HTTP fetch succeeds. Do not fill a thin week with older records pretending they occurred now. The UI preserves the past-week default, explicitly shows combined City + County counts and provides one action to browse 30 days together.

Daily review must include County municipal reports **outside County Police patrol jurisdiction**: at minimum the [First Alert 4 County desk](https://www.firstalert4.com/news/st-louis-county/), current dated municipal releases, and Highway Patrol crash reporting. Check Manchester, Florissant, Bellefontaine Neighbors, Bridgeton and other municipalities when reported events identify those locations. A driver’s home town is not the crash location. MSHP’s public search currently presents a CAPTCHA in this environment: do not bypass it. A clearly attributed local report can supplement it; record the actual article rather than claim a successful primary download. Municipal coverage is still incomplete and must never be presented as exhaustive.

Each reviewed fatality attribution uses `fatalityEvidence: [{category, deaths, sourceUrl, summary, checkedAt}]`, where category is `police` or `other-homicide`. The count must be an explicitly reported positive integer, and all category counts cannot exceed the case’s explicit `deaths`. Mere officer involvement, a homicide offense label, arrests, gunshots or a pursuit do not establish a victim count or category. Unknown attribution stays unclassified. Crashes, including police-pursuit crashes, are excluded from these two homicide summaries. Labels describe reported events, not legal culpability. Sources remain linked, and no victim names are stored.

The browser’s past-seven-days summary uses a **rolling 168-hour** interval, independent of the map’s date/type filters. It excludes future events and old timestamps. An occurrence with only a date on the boundary day cannot be located inside that interval reliably, so it is excluded from the two counts and disclosed separately. Unknown victim counts and unattributed known deaths are reported separately. Zero classified cases is displayed as “None confirmed in available reports”, never a claim that no one was killed.

`fatalityRecords` is a compact projection built from **all** permanent month shards on every publication, not merely the recent snapshot. It supplies annual statistics without downloading thousands of unrelated map points on mobile. It carries case IDs, dates, outcome fields and source attribution; it does not infer victims from homicide rows. Canonical case aliases deduplicate sources. Annual statistics are explicitly an incomplete tracked-report subset. `archiveCoverageFrom` records the oldest occurrence; this archive starts in August 2026. No complete year-to-date winner or comparison is claimed. Full-year completeness requires independent verification of both categories over January 1 through the same cutoff across City and County.


## November 16 source-lag repair

The County NIBRS and injury-crash service publishers themselves still stopped at
November 8 when checked November 16. ArcGIS `editingInfo.dataLastEditDate` was
November 9 for both, and a descending-date query confirmed November 8 as the
latest occurrence. A successful refresh does not remove this upstream delay.
The City public map supplies newer reports (November 16 during this check).
The combined UI distinguishes newest available reports from the older County
bulk-feed cutoff. Explicit Refresh feeds now bypasses the browser's five-minute
incident cache; filter changes continue to reuse the cache.

### Chesterfield daily police bulletins

Add the official [Chesterfield Crime Statistics and Reports](https://www.chesterfield.mo.us/crime-statistics-and-reports)
to the existing daily **changing incident** review. Its linked daily PDFs were
newer than the shared County bulk feed: the November 13 posting documents
November 12 occurrences. The posting date is NOT the incident date. Follow each
new or changed PDF, preserve the printed case number and beginning occurrence
clock, and check for corrections. Do not reread unchanged PDFs every morning.

The municipal page loads its PDF links dynamically. Browser access worked during
this repair; simple HTTP requests to the page/assets returned 403. This is an
AI-reviewed source, not a working unattended PDF download adapter. If access
fails, retain previous records and actual review dates and report the failure.
Do not assert a successful check from search snippets alone.

Use source ID `county-chesterfield-bulletins`, `jurisdiction: county`, agency
`CHESTERFIELD`, and the official PDF URL on each reviewed case. Exact agency +
printed case number creates the same stable County case hash, so a later County
bulk release merges with the reviewed case instead of creating a duplicate.
Keep summaries attributed, omit names/demographics and juvenile/sexual-offense
records. Use printed masked streets or named public intersections/areas with
verified approximate geometry; never geocode to a household address. No injury
or death count is inferred from an assault label. Update its `sourceReviews`
entry only after actually reading the new/changed official bulletins. The
coverage check warns if this source's newest occurrence becomes over seven days
old, prompting review of the publisher's latest bulletin rather than assuming
that no reports occurred.
