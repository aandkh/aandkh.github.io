# Haunted Places

Added 2026-11-17 as one Explore collection: 24 documented local ghost-story locations across St. Louis City, St. Louis County and Alton. The data establishes the physical places and the existence of reported experiences or recurring folklore. It does not establish paranormal causes. Famous venues and strong community traditions share the same layer and display treatment.

## Files and display

- `haunted-places.geojson`: original summaries, stable IDs, venue/reference-point coordinates, visit links, access notes and source lists.
- `scripts/haunted-places-data-test.mjs`: focused offline integrity checks. Run when changing this dataset, not on a daily maintenance timer.
- Feature `description` combines the site's physical history and attributed local story; `hauntSources` supplies individual linked citations. `accessNote` and `locationAccuracy` must remain available in details.
- A point identifies the documented venue, public trailhead, interpretive marker or explicitly approximate address. It does not identify the exact position of a purported experience.
- No separate “famous” and “community” categories, unsupported haunt ratings, ghost counts, visitor probabilities, or copied photographs are used.

## Selection and research

The selection combines official venue histories, venue acknowledgment of its own local legend, tourism-office records, local reporting, and substantive recurring community accounts. An operator offering a Halloween event by itself was insufficient; the story had to concern the actual place. In several cases local reporting includes skeptical accounts or conflicting versions. Those limitations are retained rather than choosing the most sensational version.

Strong community corroboration helped support Rock Hollow Trail, the Grandel, the Webster theaters, UMSL Provincial House and Payne-Gentry House. The collection also covers established Lemp-area, theater, museum, hotel and Alton traditions. The pinned areas are places someone can identify on a public map; private residential houses are excluded.

Coordinate provenance is preserved per record. Existing OSM venue points were reused where available; the site already retains OpenStreetMap attribution. Regional tourism and university directions supply other markers. Census street interpolation is explicitly approximate for the Bottle Works and Piasa Masonic Temple. The Hotel Stratford record is an approximate building reference. Rock Hollow uses the public northern trailhead. McPike uses the tourism office's entrance marker, not an invented point inside the mansion. No new geocoding service or live third-party script is introduced.

## Deliberate exclusions and corrections

- **All cemeteries, graveyards and burial-ground attractions are excluded**, including Bellefontaine, Calvary, Jefferson Barracks cemetery, Sappington Cemetery and cemetery “Gates of Hell.” The Alton entry is the surviving **prison wall/site**, not the separate prison cemetery.
- No Exorcist house, Dependahl farmhouse, Gehm House, Laughing Lake House or other private residential-address attraction.
- No demolished Chesterfield Manor or Koch Hospital marker; no uncertain old Jacoby Arts Center location presented as its current venue.
- No weak isolated Cliff Cave, Sun Decker's or Old Rock House anecdote, and no place added merely because it hosts seasonal staged storytelling.
- Milton School's disputed “Mary” murder story is not repeated as history. Cupples, Dripping Springs and other inherited legends are explicitly stories, not invented historical deaths. Dripping Springs is not represented as verified Indigenous history.
- Piasa Masonic Temple has exterior-only access; a historic tour mention does not imply that a vacant building is currently open. Hotel Stratford is not represented as an operating hotel. University, theater and mixed-use spaces retain restricted-access notes.
- No stale prices, promised tour dates or hard-coded operating hours. Follow the linked venue/operator for current availability.

## Maintenance

This is stable reference material. Do not add it to the restricted daily changing-data runner, rebuild it daily, or create a separate automatic static audit. Update only for a specific correction, credible closure/relocation/access change, broken source or relevant evidence found during authorized work. A successful page fetch alone does not justify renewing a record's verification date. Preserve stable IDs and surviving citations when correcting a record.

## Source inventory

Each entry's complete supporting links and coordinate source are in its `hauntSources` and `coordinateSourceUrl`. The links below provide a compact entry point into the record's research; there is no famous/community split.

- **Lemp Mansion** — [Lemp Mansion — The Lemp Experience](https://www.lempmansion.com/lempexperience.htm); [St. Louis Magazine — Ghost tours around St. Louis](https://www.stlmag.com/culture/ghost-tours/).

- **Lemp Brewery Bottle Works** — [St. Louis Paranormal Research Society — Lemp Brewery tours](https://www.stlghosttours.com/); [r/StLouis — Ghost tour discussion](https://www.reddit.com/r/StLouis/comments/1wue8yb/ghost_tour/).

- **Fabulous Fox Theatre** — [Fabulous Fox Theatre — Tours](https://www.fabulousfox.com/visit/tours); [HEC Media — Haunted Happenings Around STL](https://www.hecmedia.org/posts/haunted-happenings-around-stl).

- **Powell Hall** — [St. Louis Symphony Orchestra — Powell Hall history](https://slso.org/about-us/powell-hall-history/); [HEC Media — Haunted Happenings Around STL](https://www.hecmedia.org/posts/haunted-happenings-around-stl); [Washington University student guide — Arts in St. Louis](https://sites.wustl.edu/diso202021/items/type/life-in-the-lou/arts-life-in-the-lou/).

- **Stifel Theatre** — [Stifel Theatre — History](https://www.stifeltheatre.com/about-us/history); [St. Louis Magazine — Ghost tours around St. Louis](https://www.stlmag.com/culture/ghost-tours/); [St. Louis Ghosts — Spirits of the Stifel Theatre](https://stlghosts.com/the-spirits-of-the-stifel-theatre/).

- **Campbell House Museum** — [Campbell House Museum — Visitor information](https://campbellhousemuseum.org/); [St. Louis Magazine — Campbell House weekend manager](https://www.stlmag.com/history/campbell-house-museum-weekend-manager/); [St. Louis Magazine — Campbell House mysteries](https://www.stlmag.com/culture/The-Campbell-House-Mysteries-The-Case-of-the-Hidden-Half-Dollars/).

- **Chase Park Plaza** — [Historic Hotels of America — 2026 haunted hotels](https://www.historichotels.org/us/press-room/press-releases/the-2026-top-25-historic-hotels-of-america-most-haunted-hotels-list-is-announced); [First Alert 4 — Is the Chase Park Plaza haunted?](https://www.firstalert4.com/2025/10/31/is-chase-park-plaza-haunted/); [City of St. Louis — Chase Park Plaza history](https://dynamic.stlouis-mo.gov/history/structdetail.cfm?Master_ID=1360).

- **Samuel Cupples House** — [City of St. Louis — Samuel Cupples House landmark](https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/city-landmarks/Cupples-House.cfm); [ASHS 2009 St. Louis meeting — Ghost tour itinerary](https://ashs.confex.com/ashs/2009/webprogramarchives/Session1234.html); [Saint Louis University — Cupples House](https://www.slu.edu/cupples-house/index.php).

- **McPike Mansion** — [Great Rivers & Routes — McPike Mansion](https://www.riversandroutes.com/directory/the-mcpike-mansion/); [St. Louis Magazine — Whose ghosts supposedly haunt McPike Mansion?](https://www.stlmag.com/history/st-louis-sage/whose-ghosts-supposedly-haunt-mcpike-mansion-in-alton/).

- **Mineral Springs Hotel** — [Great Rivers & Routes — Mineral Springs Hotel](https://www.riversandroutes.com/directory/mineral-springs-hotel/); [Enjoy Illinois — Haunting season in Illinois](https://www.enjoyillinois.com/plan-your-trip/road-trip-itineraries/haunting-season-in-illinois/).

- **Milton School House** — [Great Rivers & Routes — Milton School House](https://www.riversandroutes.com/directory/milton-school-house/); [The Telegraph — Milton School House’s haunted reputation](https://www.thetelegraph.com/news/article/Milton-School-House-purportedly-haunted-going-16543347.php).

- **First Unitarian Church** — [Great Rivers & Routes — First Unitarian Church](https://www.riversandroutes.com/directory/first-unitarian-church/); [Great Rivers & Routes — Why Alton Is America’s Most Haunted Small Town](https://www.riversandroutes.com/blog/why-alton-is-americas-most-haunted-small-town/); [Lewis and Clark National Historic Trail — Alton Haunting Tours](https://www.lewisandclark.travel/listing/alton-haunting-tours/).

- **Simeon Ryder Building** — [Great Rivers & Routes — Ryder Building](https://www.riversandroutes.com/directory/ryder-building/); [Alton Odyssey Tours — Haunted Craft Beer Walk](https://www.altonodysseytours.com/service/haunted-craft-beer-walk-the-perfect-pairing); [Historical Marker Database — Ryder Building](https://www.hmdb.org/m.asp?m=133290).

- **Piasa Masonic Temple** — [Great Rivers & Routes — Why Alton Is America’s Most Haunted Small Town](https://www.riversandroutes.com/blog/why-alton-is-americas-most-haunted-small-town/); [The Telegraph — Old Masonic Temple completed in 1915](https://www.thetelegraph.com/news/article/old-masonic-temple-building-completed-1915-19739977.php); [The Telegraph — Piasa Masonic Temple history](https://www.thetelegraph.com/news/article/piasa-masonic-temple-alton-illinois-history-20065960.php).

- **Alton Prison Ruins** — [Great Rivers & Routes — Alton Prison](https://www.riversandroutes.com/directory/alton-prison-group-friendly/); [American Battlefield Trust — Alton Military Prison Site](https://www.battlefields.org/visit/heritage-sites/alton-military-prison-site); [Madison County ILGenWeb — Historical paranormal newspaper accounts](https://www.madison.illinoisgenweb.org/paranormal.html).

- **Hotel Stratford** — [Alton Odyssey Tours — Haunted trolley tours](https://www.altonodysseytours.com/tour-categories/trolley-tours); [Great Rivers & Routes — Alton Odyssey Tours](https://www.riversandroutes.com/directory/alton-odyssey-tours/); [AltonWorks — Historic building mission](https://altonworks.us/our-mission/).

- **Alton YWCA** — [YWCA Southwestern Illinois — Visitor information](https://www.ywcaswil.org/); [The Telegraph — Group studies YWCA for paranormal activity](https://www.thetelegraph.com/news/article/Group-studies-YWCA-for-paranormal-activity-12603365.php); [St. Louis Paranormal Research Society — Alton YWCA](https://www.stlghost.com/haunted-alton-ywca).

- **Dripping Springs at Creve Coeur Lake** — [Historical Marker Database — Dripping Springs](https://www.hmdb.org/m.asp?m=150902); [Visit Maryland Heights — Creve Coeur Lake Park](https://visitmarylandheights.org/2013/06/21/creve-coeur-lake-park/); [HEC Media — Haunted Happenings Around STL](https://www.hecmedia.org/posts/haunted-happenings-around-stl).

- **Rock Hollow Trail (Zombie Road)** — [City of Wildwood — Rock Hollow Trail](https://www.cityofwildwood.com/2035/Rock-Hollow-Trail); [St. Louis Magazine — Is Zombie Road Really Haunted?](https://www.stlmag.com/history/st-louis-sage/is-zombie-road-really-haunted/); [r/StLouis — Ghosts/Folklore around STL?](https://www.reddit.com/r/StLouis/comments/1pmoqbo/ghostsfolklore_around_stl/); [r/StLouis — Zombie Road](https://www.reddit.com/r/StLouis/comments/xwd7fc/zombie_road/); [OpenStreetMap trailhead via Mapcarta](https://mapcarta.com/N14120944832).

- **The Grandel** — [Grand Center Arts District — The Grandel Haunted Tour](https://www.grandcenter.org/the-grandel-haunted-tour/); [r/StLouis — I know y’all have some ghost stories](https://www.reddit.com/r/StLouis/comments/d2dqdx); [The Grandel — MetroTix](https://www.metrotix.com/venues/detail/grandel); [Kids Out and About — Grandel Theatre](https://saintlouis.kidsoutandabout.com/venue/grandel-theatre).

- **Theatre Guild of Webster Groves** — [Theatre Guild — History](https://www.webstergrovestheatreguild.com/history/); [Ghost Research Society — Theater Guild Investigation](https://www.ghostresearch.org/Investigations/theaterguild.html); [Theatre Guild — Contact](https://www.webstergrovestheatreguild.com/contact/); [OpenStreetMap theater via Mapcarta](https://mapcarta.com/N12740592701); [St. Louis Magazine — Ghosts of the Guild](https://www.stlmag.com/events/ghosts-of-the-guild-halloween-party/).

- **Loretto-Hilton Center for the Performing Arts** — [The Rep — Macbeth educational guide, Ghosts section](https://www.repstl.org/assets/doc/M5-MACBETH-e2a38ccde3.pdf); [The Rep — History](https://repstl.org/rep-history/); [Webster University — Campus map](https://www.webster.edu/campus-map.php); [OpenStreetMap theater via Mapcarta](https://mapcarta.com/W375010915).

- **UMSL Provincial House** — [UMSL Daily — Haunted Honors](https://blogs.umsl.edu/news/2019/11/01/haunted-honors/); [The Current — The dark history of Provincial House, October 24, 2011](https://www.umsl.edu/services/library/university-archives/Student%20Newspaper/Current%2C%202011-2013/2011/October%2024%2C%202011.pdf); [UMSL — Honors College contact and directions](https://www.umsl.edu/honors/contact-us.html).

- **Payne-Gentry House** — [City of Bridgeton — Payne-Gentry House](https://www.bridgetonmo.com/facilities/facility/details/PayneGentry-House-20); [St. Louis Cake Monster — Payne-Gentry House](https://stlcakemonster.wordpress.com/2015/04/17/cake-monster-tries-to-get-haunted-payne-gentry-house-50/); [The Current — Haunted places review, October 14, 2002](https://www.umsl.edu/library/university-archives/Student%20Newspaper/Current%2C%202002-2004/2002/October%2014%2C%202002.pdf); [Riverfront Times — Haunted places](https://www.riverfronttimes.com/haunted-places-st-louis/); [Payne-Gentry House — coordinate record](https://en.wikipedia.org/wiki/Payne-Gentry_House).
