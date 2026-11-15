# Comedy and concert coverage

The November 15, 2026 audit found a source-coverage gap, not an artist-popularity filter. The comedy layer previously had no official-venue snapshot supplement. Music snapshots omitted the Fox and Hollywood Casino Amphitheater and stopped early on The Factory calendar. Also, failed community API requests discarded the local concert supplement.

`concert-calendar.js` now merges the independent sources for `concerts` and `arts`, keeps their layers selectable when the remote API is unavailable, preserves separate performances, and excludes expired snapshots. Remote requests time out after 8 seconds. Shared links can resolve either snapshot.

## Refresh during Andymap maintenance

- Run `python scripts/refresh-venue-events.py` with `beautifulsoup4` installed. This refreshes Helium and Westport Funny Bone. It replaces records only for successful sources and preserves other venue records. Review warnings and inspect source dates. It does not schedule itself.
- Review all pages of official calendars, including pagination, categories and later announced dates: The Factory, Fabulous Fox / its official MetroTix calendar, Stifel Theatre, Enterprise Center, Hollywood Casino Amphitheater, The Pageant, Delmar Hall, Duck Room, Off Broadway, Old Rock House and Red Flag.
- Store reviewed concerts in `concert-calendar.json`; comedy, theater and mixed stage performances in `comedy-calendar.json`. Preserve separate advertised showtimes. Date-only listings must stay date-only; never substitute doors times for start times or invent times from a date range.
- Carry source URLs and the actual source check timestamp on every record. Retain expired data only when needed for audit; the browser hides it. Remove cancelled events based on official sources.
- Do not exclude performers based on fame, popularity or personal preference. Exclude ticket add-ons (parking, meet-and-greets, season-ticket waitlists) from performance results.
- Broader coverage remains partial: audit St. Charles Funny Bone, The Sheldon, River City, Ameristar, Chaifetz, the Dome, Busch Stadium, local independent comedy rooms and festival calendars as well. A venue list is not a completeness guarantee.
- Run `node scripts/test-venue-events.mjs`, `node --check app.js`, and `git diff --check` before publishing.

Snapshot counts on November 15 after this audit: 209 comedy/theater performances and 152 concert performances, supplementing the remote calendars. Counts include repeat performances, not just unique performers. Factory and Fox mixed programming is explicitly categorized; Bill Murray's band is music, not stand-up.

---

# Local film and sports schedules

Run with Python 3.9+ (standard library, no packages or credentials):

```sh
python scripts/refresh-movies.py
python scripts/refresh-sports.py
node scripts/test-events.mjs
python scripts/test-event-parsers.py
```

Include these commands in the existing 6 a.m. America/Chicago refresh, followed by the normal site validation/publish workflow. Do not create a second schedule. Refreshes write local snapshots, not the live site.

## Films

`movie-screenings.json` is a generated GeoJSON snapshot; `movie-reviewed.json` stores reviewed primary-source facts for calendars whose automatic retrieval is unavailable. `movie-metadata.json` provides title/runtime/rating corrections for the existing university feeds. Runtime is never inferred from an event's reserved time window.

Sources:

- Chase Park Plaza: public Fever ticketing pages, eight date-specific days. Read the public page's embedded JSON only. Do not request private/internal service URLs present in the JSON keys. Date consistency is checked before importing sessions. Expired/sold-out sessions are excluded. These are local cinema venues; AMC, Marcus, B&B, Alamo, Regal and Cinemark are excluded.
- Saint Louis Science Center: official calendar's explicit occurrences and the attraction page's already-expanded upcoming screenings. Custom recurrence rules are deliberately not guessed, so this remains partial OMNIMAX coverage.
- Hi-Pointe and Arkadin: reviewed official calendars. The daily AI check should examine their current calendars, add/change/cancel real screenings, and update `sourceCheckedAt` only for facts actually rechecked. Direct HTTP errors do not justify bypassing a site's access controls.
- Webster/WashU dated screenings continue through the existing backend. The loader also works if that backend fails.

Every imported film needs a movie title, venue, exact published start time with offset, point geometry, official/ticket-provider URL, source name and actual check timestamp. Unknown runtime and rating are absent. Do not replace missing showtimes with undated cinema pins. Unannounced mystery-film programs are omitted. Preserve one event per film/venue/start; deduplicate repeated upstream identifiers and calendar representations.

The refresh report records each automatic source's success/failure, count and check/attempt time. A failure retains only unexpired prior records with their original verification timestamps. A successfully retrieved empty date removes superseded sessions for that date. Removed or cancelled reviewed events must be removed from `movie-reviewed.json` during manual review; never merely refresh its timestamps.

## Sports

`sports-events.json` combines official league/team schedules. `sports-reviewed.json` holds source-backed fallback facts and the confirmed CITY SC playoff game. It must not be timestamp-renewed without actual source verification.

- MLB StatsAPI, team 138, home venue 2889: Cardinals at Busch Stadium. Excludes away games and spring-training games in Florida. Preserves source game IDs and TBA status.
- NHL public club season schedule: Blues home games at Enterprise Center. The published official Blues season announcement is a reviewed fallback.
- SLU men/women and Lindenwood men/women: official Sidearm JSON-LD, filtered to the actual local home arena. Sidearm's local wall times are converted with `America/Chicago`, including DST. Midnight placeholders become date-only TBA entries.
- CITY SC: current official club announcement for confirmed November 23 home playoff match. The conditional December 2 game is omitted until it is confirmed. Daily AI review must check the next official schedule/announcement, game changes and new seasons. Do not invent 2027 matches.

Date-only games must display "Time TBA", never midnight or a guessed start. Do not infer game end times. Preserve same-day doubleheaders as distinct starts.

## Frontend integration

`loadMovieScreenings(() => fetchRemoteMovies())` and `loadSportsEvents(() => fetchRemoteSports())` request the static snapshot and backend in parallel and recover independently. Existing call sites can alternatively use `enrichMovies(result)` / `enrichSports(result)`. Both return GeoJSON with chronological features, `status` and honest partial-coverage `note`. Top-level `checkedAt` is the client merge/retrieval time used for refresh scheduling; `snapshotGeneratedAt` and each record’s `sourceCheckedAt` separately retain actual source freshness.

Use the shared event card/day grouping on both layers so date and next start time are visible immediately. Movie titles lead; runtime/rating belong in the compact facts line. A stadium/theater without a published dated event does not belong in the event results.

## Coverage and limitations

November 15, 2026 snapshot after the Galleria exclusion: 303 published screenings across four local/independent cinemas (before runtime expiry), plus backend university screenings; 168 future home games across seven teams. Counts naturally fall as events begin and change when venues publish new dates. Both St. Louis City and County remain in the same result set. Lindenwood additionally covers nearby St. Charles. These feeds do not claim every independent theater or every amateur sports event.

Daily AI review should check coverage gaps including MX Movies, independent one-off/festival screenings, outdoor cinemas in season, and new schedules for CITY SC/college/arena sports. Add a source only when real dated facts can be retrieved and verified; do not expose an unavailable source as a working feature.

## Discovery expiry and retired theaters

Timed events disappear from map markers, results, Today, clusters and autocomplete at `now >= start`, even when the source has a later end time or `expiresAt`. The shared `event-lifecycle.js` policy applies to concerts, festivals, sports, stage performances, community events, exhibitions, movies and scheduled food-truck stops. It does not change historical crime feeds or ordinary undated places.

A date-only event has no known start time. Keep it through the entire listed day in America/Chicago, then remove it at the following local midnight, including DST transition days. Label it “Start time not listed”; never invent midnight/noon as its start. Invalid dates are excluded from actionable event discovery. Legacy timestamps with no offset resolve only when the Chicago wall time is unambiguous; require source clarification for DST gaps or repeated wall times.

The frontend schedules the nearest event deadline and refreshes on clock changes and visibility return. Refresh active clusters and search suggestions too; cached cluster buttons must not reopen a just-started event as upcoming. Opened details and short-link lookups may show retained historical source records with an explicit already-started notice. They must not inject those records back into discovery. A source snapshot cannot promise historical retention after its next refresh removes that record.

**Permanent owner exclusion: Galleria 6 Cinemas.** Do not fetch its showtimes or restore them from old snapshots. The refresh target, old cached records/source entries and frontend normalization are all excluded. Other independent/local cinema coverage remains supported.

Run `node scripts/test-event-lifecycle.mjs` alongside the existing event tests. It checks exact start boundaries, future end-times, timezone/DST/date-only behavior, unknown and malformed dates, clock/visibility refresh, historical lookup separation and the Galleria exclusion.
