# Local discovery upkeep

The three layers share one City + County experience; jurisdictions in the data are for coverage checks, not user-facing region filters. This is a source-backed directory, not a claim to include every business or every food-truck booking.

## Current inventory, reviewed November 15, 2026

| Layer | Added maintained coverage | Source and meaning |
| --- | --- | --- |
| Food Trucks | 34 upcoming mapped stops from 14 operators; 70 operator schedule cards | St. Louis Food Truck Association calendar and membership directory. A pin is a published scheduled stop, not live GPS. Operator cards have no invented pin. |
| Local Food and Drinks | 23 venues: 14 in the City, 9 in the County | Operator websites and documented local ownership. Small local restaurant groups are identified honestly; national franchises are excluded. |
| New businesses | 12 recent openings: 6 in the City, 6 in the County | Dated reports after opening, linked operator pages and separately sourced coordinates. No permit or promised opening date is sufficient. |

Counts of scheduled stops naturally fall as events end. Local venue entries include existing retained Crown Candy, Civil Life, 2nd Shift, Sidney Street and Mai Lee facts plus substantial additions. The local groups Nudo House, Circle 7, Corner 17, Lona’s and Take Root are not described as single-location businesses.

## Daily refresh

Use the repository’s 6 a.m. America/Chicago maintenance run:

```sh
python scripts/refresh-foodtrucks.py
python scripts/local-discovery-maintenance.py --refresh-unchanged
python scripts/foodtrucks_test.py
node scripts/local-discovery.test.mjs
```

Both Python scripts use only the standard library and an honest Andymap User-Agent. They require outbound HTTPS. No browser driver, paid API or package installation is needed. Food-truck requests are two HTML pages, not one request per operator. The app fetches each small JSON file once, deduplicates concurrent requests and caches it for five minutes.

The source checker writes `/tmp/andymap-local-source-report.json` by default. It renews only an exact previously reviewed readable-text fingerprint with the required venue identity tokens. It does **not** equate HTTP 200 with unchanged hours, ownership or opening facts. Changed text, missing identity tokens, unavailable pages and social-only sources require a short page review. After actually reviewing an entry’s source and correcting its facts if necessary, record that review with:

```sh
python scripts/local-discovery-maintenance.py --approve-reviewed localfood-peno
```

Multiple `--approve-reviewed` IDs can be supplied. This command still requires a readable source and matching identity tokens; it never promotes a future opening or updates opening dates. Hours retain their separate 48-hour expiry and must be reviewed explicitly before their expiry is advanced. Source checks do not extend `ownershipReviewedAt`; review the linked ownership evidence as part of the monthly ownership check or immediately when it changes.

For entries without a machine-readable official page, visit the official social page and the dated opening article directly. Verify the current name/address, any closure notice and the actual opening report, then update the record’s reviewed fields. Do not silently renew these through an unrelated page.

## Sources and editorial decisions

- [STLFTA calendar](https://stlfta.com/) supplies its own timestamp, coordinates, operator and event address. [Member directory](https://stlfta.com/members) supplies operator names and schedule links. Explicit private bookings, photoshoot appointments, bad coordinates, past stops and known national franchises are excluded. Workplace/school stops are retained with a restricted-access warning, rather than mislabeled public festivals. End times are parsed in America/Chicago; data expires by the event end or after 48 hours.
- [St. Louis Magazine opening reports](https://www.stlmag.com/dining/st-louis-restaurant-openings-closings-coming-soon/) identify dated openings and distinguish rebrands, reopenings and additional locations. It is an editorial report, **not** presented as an operator announcement. The November report was published November 5, 2026 and subsequently updated. It is useful for daily discovery of candidates; each addition needs its own verified operator, date and location.
- [Wash Ave Food Hall](https://washavefh.com/) confirms **1122 Washington**, resolving a conflicting 1220 address in one article line. The food hall is one venue, not eight duplicate business pins. Its operator page describes the individual food concepts.
- [PiFi](https://www.pifistl.com/) confirms 4916 Shaw and current service. [An interview with the owners](https://www.stlmag.com/dining/pifi-pizza-the-hill/) supports local ownership. Because reports differ on the precise opening day, the card says October 2026. The older OSM venue name is not used as evidence of the new operator.
- Café O’Play’s October 21 **public opening** is separate from its earlier ribbon-cutting. Bao & Blade is labeled a **rebrand**. Damn Fine Anytime is labeled an **additional local concept**.
- Census-geocoded addresses use the [official geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html). These are approximate address-range positions, not entrance surveys. Every such record preserves the query source URL and accuracy label. Other venue coordinates retain their specific OpenStreetMap source and ODbL attribution.

New-business records age out after 183 days and require a past, parseable opening date. A business card is not a claim that it is open at this minute. Unknown hours remain unknown. Current venues are never added to New businesses merely because they were newly discovered by Andymap.

## Integration

`local-discovery.js` exports:

- `enrichDiscovery(id, result)`: merges snapshot-first with backend data; on fetch failure returns the backend result.
- `discoverySnapshot(id)`: fast local snapshot for progressive loading and shared-place resolution.
- `mergeDiscovery(id, result, addition, now)`: pure merge/deduplication used by tests.
- `discoverySummary(id, result)`: a short count summary.

Supported IDs are `foodtrucks`, `localfood`, `businesses`. Food-truck scheduled stops and operator directory entries remain distinct. Undated food-truck results should be headed **Operator schedules**, open directly to the normal detail card and link to the operator’s current schedule. No-location entries must not acquire a guessed marker. All 70 entries should remain available through result pagination.

New records use `local:` source IDs, not `curated:`, to avoid triggering an unrelated backend curated-place lookup. Snapshot merging removes duplicate venue name/location pairs. Food stops deduplicate by operator, minute and approximate location. Bad date input cannot crash the merge. Six-month and future-opening guards apply to backend data too.

The backend’s single-truck feed is supplemental; the maintained association feed provides the new breadth. Do not claim all area operators participate in STLFTA or every scheduled workplace stop is publicly accessible. Verify each venue’s own website when a visitor needs exact service or accessibility details.
