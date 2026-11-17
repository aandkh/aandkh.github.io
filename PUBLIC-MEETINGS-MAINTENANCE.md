# Public meeting feed recovery

`python scripts/refresh-public-meetings.py` reads the City of St. Louis official
[public meeting calendar](https://www.stlouis-mo.gov/events/all-public-meetings.cfm)
and its linked event iCal exports, plus the County's public
[CivicWeb calendar](https://stlouisco.civicweb.net/Portal/).
The County calendar's ordinary public data endpoint is
`/Services/MeetingsService.svc/meetings?from=YYYY-MM-DD&to=YYYY-MM-DD`.
No authentication, private service or invented recurring dates are used.

The existing restricted daily runner includes this refresh in its `venues` job.
Do not run a second full daily audit. The snapshot is
`search-sources/communityevents-meetings.json`; both jurisdictions load into
Community Events and the shared search catalog. The failed backend meeting feed
is no longer used to regenerate this snapshot.

Each run checks only the next 60 published days, uses bounded concurrency and
upstream HTTP validators when supplied, and reports to
`/tmp/andymap-public-meetings-report.json`. Individual failed City iCal exports,
an unavailable source, and missing formerly listed records retain their last
verified facts and timestamps. Explicit cancellation/no-meeting notices remove
records; mere disappearance is reported for review, not treated as cancellation.
Started events expire through the normal shared event policy. Source success
means the returned calendar was read, not that all possible public meetings exist
in that calendar. Unchanged facts do not trigger timestamp-only writes.

`public-meeting-locations.json` caches US Census address-geocoder results only
for published physical street addresses. These are labeled approximate address
interpolations. Venue aliases are deliberately narrow: County Council Chambers
is at 41 S. Central Ave, documented in the County's own
[police-board agenda](https://stlouiscountypolice.com/department-news/press-releases/police-board-of-commissioners-meeting-february-26-2025-agenda/).
Do not routinely regenerate these stable venue coordinates. Unknown venue
locations and online meetings remain usable dated list entries with official
links, without fabricated pins or directions to an online meeting.

Focused validation:

```sh
python scripts/test-public-meetings.py
node scripts/public-meetings-ui-test.mjs
node scripts/reference-layers-test.mjs
node scripts/search-source-retention-test.mjs
node --check app.js
```

November 17 recovery: 72 upcoming meetings (55 City, 17 County), including 30
mapped published addresses. Counts change naturally as meetings start. Some
County physical venues publish a name without an address; those remain in the
list pending a verified location, rather than borrowing an unrelated point.
