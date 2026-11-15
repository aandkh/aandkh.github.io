# Crimes & Crashes maintenance

The map always combines St. Louis City and St. Louis County. Agency IDs below select input sources; never expose a City/County switch. Data are reported incidents, not a complete census, neighborhood safety score, or finding of guilt.

## Daily at 6 a.m. America/Chicago

Run these commands **sequentially**; both write the same archive:

```sh
python scripts/incident-refresh.py --days 45
python scripts/incident-city-refresh.py --days 30
python scripts/incident-tests.py
node scripts/incident-tests.mjs
```

The first command refreshes official County/participating-municipal crime and County Police injury/fatal crash data. The second refreshes the official City public map. They preserve older months and reviewed releases, report source failures, and return nonzero on a failed source. A failed refresh retains the last verified data and records the failure; it must not be described as a successful check. No browser request, credential, account, or third-party API key is needed. Do not run the commands concurrently.

After the machine refresh, visit the primary release pages below, read new and updated reports, and update `incident-reviewed.json` with source-backed occurrence dates, approximate locations, and explicit reported outcomes. Update its `reviewedAt` only after visiting the sources. Then run `python scripts/incident-refresh.py --repack` to merge those reviews and rebuild the month index without redownloading feeds. The automated jobs are source downloads; reading releases is a separate part of the requested daily AI maintenance.

Once a week, refresh the full still-available source window (`--days 179` for City, `--days 180` for County) to catch late approvals and corrections. The City provider retains 180 days. The local archive has no seven-day expiration. Do not discard old months when a source ages out a record.

## Source registry and coverage

| Source | Public source / endpoint | Update and limitation |
|---|---|---|
| City official public crime map | [SLMPD documentation](https://slmpd.org/mapping/) → [official shared map](https://www.crimemapping.com/Share/66dfeeb3d9874dc78fdf8be1ad7f0c4c) | Updated daily; 180-day source retention. SLMPD excludes domestic violence, sex crimes, juvenile-related incidents and some unapproved reports. Homicides may be delayed. No outcome counts. |
| City public map/report retrieval | `https://www.crimemapping.com/map/MapUpdated`, `/map/LoadReportJson` | The same public read requests used by that map. Agency 726; whole-City extent. Seven-day windows, two concurrent requests at most; splits date windows if the public 500-record limit is reached. Never accepts truncation, count mismatch, absent date or missing geometry as complete data. This is a public interface, not a promised stable API; source failures require review. |
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
