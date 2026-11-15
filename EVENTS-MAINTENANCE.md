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
