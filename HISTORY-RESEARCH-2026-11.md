# History expansion — November 16, 2026

202 new records, preserving the original 12 stable identifiers: 214 total. Six independent era research passes followed by cross-review. This file documents reviewed evidence and precision decisions; it is not a scheduled maintenance job.


---

## Research pass: pre1800

# Pre-1800 History expansion — evidence review, November 16, 2026

27 new records in `/tmp/history-pre1800.json`; no shared repository file was edited for this research task. Scope is St. Louis, Florissant, St. Charles/Femme Osage, Cahokia/Collinsville, Alton and Grafton. Existing 1780 Battle of St. Louis is not duplicated. The set is selected history, not an exhaustive chronology.

## Evidence and locations

Every feature carries a historical source URL and a separate coordinate reference, plus a location explanation. Historical Marker Database coordinates are converted from the marker's published decimal minutes to decimal degrees. The mapped places are public markers or interpreted sites, not invented exact archaeological locations. Several genuinely distinct events share the same interpreted site; these should remain clusterable rather than have their coordinates artificially offset.

The sole point derived from reviewed existing geometry is the first St. Ferdinand church, at [-90.3309, 38.7971] inside `quieter-parks.json` polygon `osm:way/364156794`. Both the parish and City of Florissant identify Spanish Land Grant Park as the former church/cemetery site. The point is intentionally not a burial or foundation location.

| Records | Historical evidence | Location evidence |
| --- | --- | --- |
| Early Cahokia villages; urban depopulation | Illinois DNR Cahokia page and state-site City of the Sun interpretation | HMDB 151122 |
| Cahokia urban peak | UNESCO property 198 | HMDB 151122 |
| Monks Mound construction | Cahokia Mounds official mound page; state-site Monks Mound interpretation | HMDB 62175 |
| Woodhenge | Official Cahokia Explore page; state-site Woodhenge interpretation | HMDB 62174 |
| Central palisade | Official Cahokia Explore page | HMDB 74887 |
| 1735 Cahokia Illini settlement/chapel | Walthall and Benchley, *The River L'Abbe Mission*, Illinois Historic Preservation Agency (1987), University of Illinois digitization, pp. 3–10 and 79 | HMDB 62175, public Monks Mound approach marker |
| Piasa paintings in 1673 | Illinois DNR *Big Rivers*, section The Piasa Bird | HMDB 89339, modern Piasa Park marker |
| Marquette/Jolliet return via Illinois River | Illinois DNR Pere Marquette State Park history | HMDB 225085, commemorative cross |
| Cahokia mission 1699 | Illinois Historic Preservation timeline; HABS Holy Family record | HMDB 140557, later church marker |
| Cahokia French residence c.1740; courthouse purchase 1793 | Illinois DNR Cahokia Courthouse; NPS Old Cahokia Courthouse | HMDB 142087 |
| Hamelin household c.1760–1780 | Illinois State Historical Society's 2013 marker reporting ITARP excavation | HMDB 132349 |
| St. Louis founding February 1764 | NPS Early Years, backed by city preservation plan | HMDB 124957, Laclede riverfront monument |
| 1764 church block; 1776 replacement church | Old Cathedral institution's illustrated history | HMDB 210400, NPS Church Domain marker |
| Carondelet founding 1767 | City neighborhood history | HMDB 139705, society marker overlooking the early settlement |
| Pontiac killed April 20, 1769 | Detroit Historical Society, corroborated by Dictionary of Canadian Biography (University of Toronto/Université Laval) and Illinois timeline | HMDB 236182, commemorative marker only |
| St. Charles trading post 1769 | Missouri State Archives timeline | HMDB 124810, Blanchette/home-block marker |
| Spanish administration 1770 | City history and Missouri State Archives timeline | HMDB 124956, NPS colonial government-area reference |
| Cahokia occupied summer 1778 | NPS Clark Campaign; Fort Bowman marker supplementary | HMDB 142088 |
| Council with Indigenous leaders, late summer 1778 | NPS Cahokia: Peace or War with the Indians | HMDB 140559, public Cahokia Wedge reference |
| Dunegant appointment 1786 | City of Florissant home/parade-ground history | HMDB 145290, city commemorative plaque |
| Holy Family construction 1786–1799 | Library of Congress HABS ILL,82-CAHO,1 | HMDB 140557 |
| First St. Ferdinand church 1789 | St. Ferdinand Parish history; City of Florissant land-grant site history; SHSMO S0432 | Existing reviewed OSM park geometry |
| St. Charles Borromeo dedication November 7, 1791 | SHSMO archival collection S0138 | HMDB 163855 |
| Boone family move 1799 | St. Charles County Parks history | HMDB 169514, The Final Move interpretive sign |

## Decisions and uncertainties retained

- **Woodhenge:** The official site's Explore page says 900–1100 CE; its on-site interpretation transcribed at HMDB says 1100–1200. The feature displays a broad circa 900–1200 period and explicitly records this source disagreement in `dateEvidence`. It does not claim a precise building year. The official site's event-location entry returned a location far from the documented Woodhenge; that coordinate was rejected in favor of the actual marker coordinate.
- **Cahokia Courthouse:** A marker says courthouse use began in 1790, but both current Illinois DNR and NPS identify purchase/conversion in 1793. The feature is specifically the **1793 purchase**, with those current official sources. The c.1740 domestic construction is a separate earlier development. The reconstructed status is explicit.
- **Florissant:** The city states the village existed before Dunegant's 1786 commission. The record therefore describes the commission, not an invented definitive founding date. The land grant is dated 1788 by the city; church construction is dated 1789 by the parish and SHSMO. The entry describes church construction, with the current park as its reference.
- **Pontiac:** The date is supported by the museum and scholarly biography. The marker's claim of an exact corner is not adopted; the feature says in or near Cahokia and labels the pin commemorative. No uncertain burial site, retaliatory massacre legend or speculative motive is asserted.
- **Piasa:** The historical event is Marquette's documented observation. No myth is presented as an actual attack, and no claim is made that the modern mural reproduces the original exactly.
- **Boone:** The 1799 family move is distinct from the earlier land grant and the later Nathan Boone house. The pin explicitly marks an interpretation site, not the original land grant or a house claimed to have been built in 1799.
- **Season/month/circa dates:** The displayed labels preserve the actual precision. Internal sort keys for year/season/month records are not claimed exact event dates. Archaeological dates are approximate ranges.
- **Colonial narratives:** Original summaries avoid historical source language that treats Indigenous peoples as absent, treats all nations as one group or celebrates displacement. The 1735 record reflects documented land conflict and continued Indigenous presence at Cahokia.

## Deliberate omissions

- Fort de Chartres, Kaskaskia and Ste. Genevieve fall outside the assigned southern bound (38.1° N); none is mapped here.
- Sugarloaf Mound was researched through the Osage Nation's own cultural material. That source leaves its Woodland-versus-Mississippian origin uncertain. No invented 4-digit building year was assigned merely to force it into this event schema. It would suit a separately undated heritage-site entry if the data model gains that support.
- Private/unlocated archaeological satellite sites, exact burial locations, a separate Mound 72 burial pin and conjectural settlement coordinates were not added.
- Chouteau's Pond was considered, but exact local mapping and the changing historical footprint were not resolved to the same standard in this batch.
- No new routine refresh/research task is appropriate for this stable material.


---

## Research pass: 1800-1859

# Regional history expansion: 1800–1859

32 newly researched records; no edits to shared repository files and no publication. Prepared November 16, 2026.

## Evidence and precision

Historical claims use NPS, state/local government, archives, universities, museums or site custodians. Every record contains a historical source URL, a separate coordinate source, coordinate evidence, a visible date label, and a location-accuracy note. No images or source descriptions were reproduced. Descriptions are original paraphrases. No upcoming-event start/end fields are used.

HMDB is used for numerical coordinates of documented markers, not as blanket proof of all marker claims. Decimal minutes were converted to decimal degrees. Other coordinates come from named OpenStreetMap public sites returned by Nominatim, or published shrine coordinates with an independently verified official address. OSM attribution already required by the app must remain. No geocoder address coordinates were mistaken for historical building footprints.

All 32 records validate against the current `validHistoricalEvent` schema; all IDs are unique and none duplicate the original 12. Dates and coordinates fall within the requested era and regional bounds.

## Corrections and limitations resolved during research

- **Lindenwood:** use **1832**, not the widespread 1827 date still visible on its Sibley Hall marker. The university's archival review corrected the founding year in 2023. The record explicitly explains the older marker discrepancy. https://www.lindenwood.edu/about/founding-year/
- **Chatillon-DeMenil:** the museum's current history dates the original four-room farmhouse to **1849**; some secondary references say 1848/seven rooms. Followed the site's own 1849 account and distinguished the 1863 mansion enlargement. https://www.demenil.org/mansionhistory
- **Mary Meachum:** source marker is reported missing. The pin identifies the documented crossing/rest-area vicinity, and its note says the sign may not remain. It does not promise a marker on site. https://www.hmdb.org/m.asp?m=140413
- **Camp Dubois:** the original camp is not reliably locatable after river-channel changes. The pin is at the Hartford state historic site's commemorative reference, not the separate Wood River replica or an invented original camp. https://www.nps.gov/places/lewis-clark-state-historic-site-camp-dubois.htm
- **Thornhill:** sources disagree between a construction range and circa 1819. The event concerns the documented family move in **1819**, not an asserted exact building date. Enslaved labor is acknowledged. https://mostateparks.com/sites/mostateparks/files/Thornhill.pdf
- **Calvary Cemetery omitted:** current archdiocesan sources say 1854, while city/reference histories say 1857. Did not add an unresolved founding-date claim just to increase count.
- **Kirkwood:** municipal history supplies 1853 planned-town/rail history; the marker supplies location only. The visible 1893 depot is not represented as an 1853 building.
- **Bellefontaine/cholera:** no disputed death total or city population percentage asserted. The epidemic pin is explicitly a cemetery reference associated with the response, not the outbreak's origin.
- **Three Flags and steamboat arrival:** public old-town/riverfront reference points are explicitly approximate. No invented governor's-house address, berth or flagpole coordinates.
- **SLU:** the original house near Third and Market is gone. The public square reference is labeled approximate; source evidence identifies the old Arch-grounds location.
- **Lovejoy:** pin marks the later memorial, not the killing warehouse.
- **St. Mary of Victories:** separated the 1843 founding/cornerstone from the September 1844 dedication; did not conflate them.
- Several city/MBG pages intermittently timed out or returned 502 when opened. Their indexed source text was reviewed, and the MBG archival timeline opened successfully. No source-date renewal beyond this specific record research is scheduled.

## Regional coverage

city: 19; county: 4; metro-east: 3; st-charles: 6. All are intended for one regional view.

## Record evidence index

- **Camp River Dubois: preparing the Lewis and Clark expedition** — December 1803 – May 14, 1804. [National Park Service](https://www.nps.gov/places/lewis-clark-state-historic-site-camp-dubois.htm); [location reference](https://www.hmdb.org/m.asp?m=141833). Commemorative reference at the Lewis and Clark State Historic Site in Hartford; the original riverside camp location is uncertain.
- **Three Flags: Upper Louisiana passes to the United States** — March 9–10, 1804. [National Park Service](https://www.nps.gov/articles/u-s-takes-possession-of-louisiana.htm); [location reference](https://www.hmdb.org/m.asp?m=210400). Approximate old-town public reference beside the Old Cathedral. The pin does not identify the lost governor’s residence or the exact flagpole.
- **Lewis and Clark depart St. Charles** — May 21, 1804. [National Park Service](https://www.nps.gov/articles/departing-st-charles-may-21-1804.htm); [location reference](https://www.hmdb.org/m.asp?m=169163). National Park Service departure marker beside the St. Charles riverfront; commemorative reference, not an exact boat-launch footprint.
- **Lewis and Clark return to St. Louis** — September 23, 1806. [National Park Service](https://www.nps.gov/articles/return-home-day-for-lewis-and-clark-september-23-1806.htm); [location reference](https://www.hmdb.org/m.asp?m=124962). The Captains’ Return commemorative sculpture on the riverfront; the precise 1806 landing point is not claimed.
- **Thomas Sappington House: an early County brick home** — 1808. [Historic Sappington Houses](https://www.historicsappingtonhouses.org/thomas); [location reference](https://www.hmdb.org/m.asp?m=169304). Marker at the surviving Thomas Sappington House on its original site.
- **Zumwalt’s Fort shelters frontier families** — War of 1812 era, 1812–1815. [City of O’Fallon](https://www.ofallon.mo.us/history-of-zumwalts-fort-and-its-reconstruction); [location reference](https://www.hmdb.org/m.asp?m=169555). Marker beside the reconstructed fort in Fort Zumwalt Park; present logs are a reconstruction, not the original wartime building.
- **Portage des Sioux treaty councils** — July–September 1815. [National Archives](https://www.archives.gov/research/native-americans/treaties/catalog-links); [location reference](https://www.hmdb.org/m.asp?m=140635). Commemorative treaty marker along the public riverfront walkway; not a surveyed treaty-council boundary.
- **The Zebulon M. Pike brings steam navigation to St. Louis** — 1817. [National Park Service](https://www.nps.gov/jeff/planyourvisit/the-early-years.htm); [location reference](https://www.hmdb.org/m.asp?m=124962). Approximate central riverfront reference near the modern riverwalk. The vessel’s exact 1817 berth is not known from the cited source.
- **Duchesne opens a school for girls in St. Charles** — 1818. [Old St. Ferdinand Shrine; City of St. Charles commemorative marker](https://www.oldstferdinandshrine.org/history); [location reference](https://www.hmdb.org/m.asp?m=140764). City-commissioned Duchesne memorial at the Academy of the Sacred Heart campus; commemorative location associated with the early school.
- **Saint Louis Academy opens near the riverfront** — November 16, 1818. [Archdiocese of St. Louis; Saint Louis University](https://archstl200.org/learn/); [location reference](https://www.openstreetmap.org/way/28656516). Approximate public reference near the historic Third-and-Market area, now within the Arch grounds. The original rented house no longer survives.
- **Frederick Bates makes Thornhill his family home** — 1819. [Missouri State Parks, National Register nomination](https://mostateparks.com/sites/mostateparks/files/Thornhill.pdf); [location reference](https://www.hmdb.org/m.asp?m=178571). Marker at the surviving Thornhill estate in Faust Park. The event dates the documented family move; the house’s exact construction year is uncertain.
- **A convent and girls’ school open in Florissant** — 1819. [Old St. Ferdinand Shrine](https://www.oldstferdinandshrine.org/history); [location reference](https://en.wikipedia.org/wiki/Old_St._Ferdinand_Shrine). Approximate reference at the surviving Old St. Ferdinand Shrine complex; not a claimed exact classroom position.
- **Daniel Boone dies at Nathan Boone’s home** — September 26, 1820. [St. Charles County Parks](https://www.sccmo.org/1705/History); [location reference](https://www.hmdb.org/m.asp?m=169502). Marker at the surviving Nathan Boone house, now interpreted as the Historic Daniel Boone Home.
- **Mary Sibley begins the Lindenwood school** — 1832. [Lindenwood University](https://www.lindenwood.edu/about/founding-year/); [location reference](https://www.hmdb.org/m.asp?m=255799). Commemorative reference at Sibley Hall on the Lindenwood campus, not the first classroom. The older marker’s 1827 date is superseded by the university’s archival correction.
- **The Old Cathedral is completed** — 1834. [City of St. Louis Cultural Resources](https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/preservation-plan/Part-II-The-Walking-City-Religious-Buildings.cfm); [location reference](https://www.hmdb.org/m.asp?m=210400). National Park Service interpretive marker directly in front of the surviving Old Cathedral.
- **Lafayette Park land is reserved for the public** — 1836. [City of St. Louis Parks](https://www.stlouis-mo.gov/government/departments/parks/parks/city-parks-history.cfm); [location reference](https://www.openstreetmap.org/way/43394291). Reference point inside Lafayette Park; the event concerns the park tract rather than a single monument.
- **Francis McIntosh is lynched by a St. Louis mob** — April 28, 1836. [National Park Service](https://www.nps.gov/articles/000/free-people-of-color-in-st-louis.htm); [location reference](https://www.openstreetmap.org/way/1312631627). Approximate public area at Kiener Plaza, identified by NPS; no exact tree or crime-scene address is asserted.
- **Abolitionist editor Elijah Lovejoy is killed in Alton** — November 7, 1837. [Illinois Department of Natural Resources](https://dnrhistoric.illinois.gov/experience/sites/site.lovejoy-memorial.html); [location reference](https://www.hmdb.org/m.asp?m=133298). Lovejoy Memorial in Alton City Cemetery, dedicated in 1897. This is a commemoration, not the warehouse where he was killed.
- **St. Mary of Victories is founded for German Catholics** — 1843. [St. Mary of Victories Church](https://www.smov.info/pages/early-history.html); [location reference](https://www.openstreetmap.org/way/201372541). Reference point at the surviving church in Chouteau’s Landing.
- **St. Vincent de Paul Church takes shape in Frenchtown** — February 1843. [St. Vincent de Paul Parish](https://www.stvstl.org/history); [location reference](https://www.openstreetmap.org/way/563083279). Reference point at the surviving St. Vincent de Paul church property.
- **Tower Grove House is built for Henry Shaw** — 1849. [Missouri Botanical Garden Archives](https://www.mobot.org/mobot/archives/timeline.asp); [location reference](https://www.openstreetmap.org/way/149736799). Reference point at the surviving Tower Grove House inside the Missouri Botanical Garden.
- **The 1849 cholera epidemic overwhelms St. Louis** — 1849. [Bellefontaine Cemetery and Arboretum; National Park Service](https://www.bellefontainecemetery.org/history); [location reference](https://www.openstreetmap.org/way/151204204). Cemetery reference associated with the citywide epidemic and burial response; not an outbreak origin, hospital site or disease boundary.
- **Henri Chatillon builds the farmhouse beneath a later mansion** — 1849. [Chatillon-DeMenil Mansion museum](https://www.demenil.org/mansionhistory); [location reference](https://www.openstreetmap.org/way/526334313). Reference at the surviving Chatillon-DeMenil house. The event concerns the earlier farmhouse portion, not the later mansion expansion.
- **The Great Fire devastates the St. Louis waterfront** — May 17, 1849. [City of St. Louis Cultural Resources](https://dynamic.stlouis-mo.gov/history/eventdetail.cfm?Master_ID=356); [location reference](https://www.hmdb.org/m.asp?m=210400). Approximate public reference at the Old Cathedral beside the documented burned riverfront district. The cathedral survived; this is not the ignition point or a mapped burn perimeter.
- **Bellefontaine Cemetery is dedicated** — May 15, 1850. [Bellefontaine Cemetery and Arboretum](https://www.bellefontainecemetery.org/history); [location reference](https://www.openstreetmap.org/way/151204204). Reference point within the cemetery grounds; the exact dedication-ceremony position is not established.
- **Lucas Place gains the house now known as Campbell House** — 1851. [Campbell House Museum](https://campbellhousemuseum.org/learn/the-house/history/); [location reference](https://www.openstreetmap.org/way/201981600). Reference point at the surviving Campbell House, 1508 Locust Street.
- **Kirkwood develops as a planned railroad suburb** — 1853. [City of Kirkwood](https://www.kirkwoodmo.org/our-city/about-the-city-of-kirkwood); [location reference](https://www.hmdb.org/m.asp?m=140848). Marker at the historic railroad station site. The visible depot is the later 1893 building, not an 1853 structure.
- **Mercantile Library Hall becomes a civic and cultural stage** — 1854. [City of St. Louis Cultural Resources](https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/preservation-plan/Part-I-Cultural-Life.cfm); [location reference](https://www.openstreetmap.org/way/918743429). Approximate original hall address at Broadway and Locust. The 1854 hall was replaced; this pin does not identify the library’s current UMSL home.
- **Mary Meachum helps freedom seekers cross the Mississippi** — May 21, 1855. [National Park Service](https://www.nps.gov/articles/000/resisting-slavery.htm); [location reference](https://www.hmdb.org/m.asp?m=140413). Documented crossing memorial/rest-area vicinity on the North Riverfront Trail. The cited marker is reported missing; the pin does not promise that sign remains on site.
- **Washington University opens Academic Hall downtown** — September 8, 1856. [Washington University in St. Louis](https://source.washu.edu/2002/01/downtown-marker-to-identify-university-original-campus/); [location reference](https://www.hmdb.org/m.asp?m=139716). University historical marker near the original downtown campus. This is not the later Danforth Campus.
- **Lincoln and Douglas hold their final debate in Alton** — October 15, 1858. [National Park Service](https://www.nps.gov/liho/learn/historyculture/debate7.htm); [location reference](https://www.openstreetmap.org/way/544691378). Public square commemorating the debate near the former city hall; reference area rather than an exact speaker-platform location.
- **Missouri Botanical Garden opens to the public** — 1859. [Missouri Botanical Garden Archives](https://www.mobot.org/mobot/archives/timeline.asp); [location reference](https://www.openstreetmap.org/way/126455888). Reference point within the Missouri Botanical Garden grounds, not a single opening-ceremony location.


---

## Research pass: 1860-1899

# 1860–1899 regional historical research — November 16, 2026

Delivered 34 new distinct records. Scope: City, County, St. Charles, Pacific/Franklin and Alton/Granite City in Metro East. Existing Camp Jackson (1861), Eads Bridge (1874) and tornado (1896) records are retained by the parent integration, not duplicated here. No shared repository files were edited for this research.

## Evidence method

Historical facts are original short paraphrases of the linked institution or government source. City departments, NPS, state archives, public libraries, Amtrak, Missouri Botanical Garden and the Symphony provide the principal evidence. Historical Marker Database supplies public-marker coordinates and transcriptions of identified official/local historical markers. No photographs or long source text are reproduced. Facts from the Granite City university encyclopedia were checked against the city's own financial statement and centennial marker; the record cites those sources instead of reusing the encyclopedia's licensed prose.

Numeric locations use (1) prior reviewed public-site points in historical-events.json; (2) points verified inside already-reviewed OSM park polygons in quieter-parks.json; (3) cited marker coordinates; or (4) sourced addresses/intersections passed through Esri World Geocoding. All 17 address queries returned score 100, with matching street/place names and expected regional bounds. Full request and response evidence remains in /tmp/history-1860-geocoding.json. Address points are rounded to six decimals and explicitly described as approximate rather than surveyed footprints. Existing OSM attribution remains necessary.

Month/season-only entries have a year-only historicalDate with the precise supplied month/season in historicalDateLabel and dateAccuracy. The first of the month in dateSort is only an internal ordering key. No upcoming-event start/end fields are populated. All 34 records pass the current validHistoricalEvent validator.

## Important precision and source cautions

- Benton Barracks records use a Fairground Park reference point. They do not assign a surviving barracks building or specific hospital bed.
- White Haven departures are explicitly “by early 1864,” attributed to Julia Dent Grant's later recollection. This is not a fabricated single emancipation ceremony.
- Pacific was improved from a generic town reference to the documented, city-funded Battle of Pacific marker. Its account supports October 1, 1864; neither a battery footprint nor casualties are guessed. This avoids the city timeline's overly broad outcome description.
- Eads' Carondelet construction is sourced to NPS, which distinguishes four Carondelet boats from three Mound City boats. The marker transcription contains a stray “1851” and an overbroad “first bridge” claim; neither is used. The displayed date is October 1861, not an invented day.
- St. Charles bridge records use the clearly labeled city memorial at Oak Grove Cemetery, NOT a pin masquerading as the river crossing. The city's “first bridge across the Missouri” claim is omitted because it conflicts with earlier Missouri River bridges. Completion in May 1871 and the 1870 construction disaster remain supported.
- Forest Park's canonical URL with parkID=1 and parkName=Forest+Park was opened and confirmed to display Forest Park and June 24, 1876. The misleading search URL with Sherman+Park was replaced.
- City Hall's old missouri.org hostname failed direct fetch. Both historical and coordinate source URLs were changed to the confirmed live canonical stlouis-mo.gov/government/about/history/history-of-city-hall.cfm page.
- Library rooms at Ninth/Locust are represented by the public intersection; the historic building now contains residences. No private room is exposed as a visitor destination.
- Darby Building source names Fifth and Olive; Fifth corresponds to present Broadway. The point is the public Broadway/Olive intersection, not an invented historic doorway.
- Library's 1865 formation, 1874 public reading access, 1893 free-service vote and 1897 dedicated Children's Room are separate documented changes, not four copies of the same opening.
- The library/Symphony/emancipation/suffrage pins correctly use the old Mercantile hall's 510 Locust address, not its modern UMSL location.
- 1877 general strike's city source provides broad event history. The contemporary 1877 Gould directory confirms Schuler's Hall at Broadway/Biddle; the Post-Dispatch historical account confirms its role as strike headquarters. A mistaken Thirteenth/Biddle candidate was rejected.
- Clayton's exact December 4, 1877 date is supported by the City of Clayton indexed source. The page blocks direct automated fetch (403); that limitation is retained rather than claiming a fresh full-page fetch. Its courthouse area is independently documented by the St. Louis Black Heritage Network, crediting John A. Wright/Missouri Historical Society Press. Pin is not the voting location.
- Planters House event source from Kansas City Public Library's Civil War project is indexed but blocks direct automated fetch (403). The historic hotel block is independently documented by the Library of Congress digitized railway/business guide; the public intersection is explicitly approximate.
- No 1896 tornado duplication, reconstructed battle polygon, exact injury/death estimate, current access claim, or unsupported factory footprint was added.

## Omissions

No new record was added for poorly localized regional battles, the original downtown rail tunnel, the 1883 Carondelet library branch without a precise source location, or National Stock Yards until its historical footprint can be validated. Lincoln Institute's founding was omitted because Jefferson City is outside bounds. This collection is curated rather than exhaustive; industrial and Metro East history could support further targeted expansion, but no count-padding was used.

## Record evidence index

Each record contains sourceUrl, coordinateSourceUrl, coordinateEvidence and locationAccuracy. Additional sources are recorded where needed.

| ID | Supplied date | Place / reference | Main evidence |
|---|---|---|---|
| history-planters-meeting-1861 | June 11, 1861 | Former Planters House hotel area | [Civil War on the Western Border / Kansas City Public Library](https://civilwaronthewesternborder.org/timeline/planters-house-hotel-meeting) |
| history-carondelet-ironclads-1861 | October 1861 | Eads ironclads historical marker | [National Park Service](https://home.nps.gov/vick/learn/historyculture/city-class-ironclads.htm) |
| history-alton-prison-1862 | February 9, 1862 | Alton Military Prison memorial | [American Battlefield Trust](https://www.battlefields.org/visit/heritage-sites/alton-military-prison-site) |
| history-benton-usct-1863 | 1863–1864 | Fairground Park | [National Park Service](https://www.nps.gov/articles/000/the-civil-war-and-emancipation-in-st-louis.htm) |
| history-white-haven-freedom-1864 | By early 1864 | White Haven | [National Park Service](https://www.nps.gov/articles/000/the-civil-war-and-emancipation-in-st-louis.htm) |
| history-spottswood-rice-1864 | Fall 1864 | Fairground Park | [National Park Service](https://www.nps.gov/articles/000/the-civil-war-and-emancipation-in-st-louis.htm) |
| history-pacific-price-1864 | October 1, 1864 | Battle of Pacific marker, Blackburn Park | [Missouri’s Civil War Heritage Foundation / City of Pacific marker](https://www.hmdb.org/m.asp?m=169299) |
| history-public-library-1865 | 1865 | Former Darby Building area | [St. Louis Public Library](https://central.slpl.org/before_central.html) |
| history-missouri-emancipation-1865 | January 11, 1865 | Former Mercantile Library Hall site | [Missouri Secretary of State / State Archives](https://s1.sos.mo.gov/archives/resources/africanamerican/guide/image005c.asp) |
| history-woman-suffrage-1867 | May 1867 | Former Mercantile Library Hall site | [City of St. Louis Cultural Resources Office](https://dynamic.stlouis-mo.gov/history/eventdetail.cfm?Master_ID=480) |
| history-wabash-workers-1870 | 1870 | Oak Grove Cemetery bridge-workers memorial | [City of St. Charles memorial, transcribed by HMdb](https://www.hmdb.org/m.asp?m=163851) |
| history-grand-water-tower-1871 | 1871 | Grand Avenue Water Tower | [City of St. Louis Cultural Resources Office](https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/city-landmarks/Grand-Avenue-Water-Tower.cfm) |
| history-st-charles-railbridge-1871 | May 1871 | Oak Grove Cemetery bridge-workers memorial | [City of St. Charles](https://stcharlescitymo.gov/434/Timeline) |
| history-tower-grove-opens-1872 | September 28, 1872 | Tower Grove Park | [Library of Congress / Historic American Buildings Survey](https://tile.loc.gov/storage-services/master/pnp/habshaer/mo/mo0200/mo0298/data/mo0298data.pdf) |
| history-virginia-minor-1872 | October 15, 1872 | Old Courthouse | [Missouri Historical Society](https://mohistory.org/exhibits/beyond-the-ballot) |
| history-susan-blow-kindergarten-1873 | September 1873 | Des Peres School | [State Historical Society of Missouri](https://historicmissourians.shsmo.org/susan-blow/) |
| history-library-public-reading-1874 | 1874 | Former Polytechnic Building area | [St. Louis Public Library](https://www.slpl.org/our-history/) |
| history-ofallon-park-1875 | 1875 | O’Fallon Park | [City of St. Louis](https://www.stlouis-mo.gov/live-work/community/neighborhoods/o-fallon/ofallon-overview.cfm) |
| history-city-county-separation-1876 | 1876 | Old Courthouse | [St. Louis County Library](https://www.slcl.org/research-learn/genealogy/st-louis-genealogy/1876-st-louis-city-county-split-and-its-effect-research) |
| history-forest-park-1876 | June 24, 1876 | Forest Park | [City of St. Louis Parks Division](https://www.stlouis-mo.gov/government/departments/parks/parks/browse-parks/view-park.cfm?parkID=1&parkName=Forest+Park) |
| history-carondelet-park-1876 | July 4, 1876 | Carondelet Park | [City of St. Louis Cultural Resources Office](https://dynamic.stlouis-mo.gov/history/structdetail.cfm?Master_ID=1354) |
| history-general-strike-1877 | July 1877 | Former Schuler’s Hall area | [City of St. Louis; contemporary directory; St. Louis Post-Dispatch](https://dynamic.stlouis-mo.gov/history/eventdetail.cfm?Master_ID=293) |
| history-clayton-county-seat-1877 | December 4, 1877 | Historic St. Louis County courthouse area | [City of Clayton](https://www.claytonmo.gov/government/history) |
| history-symphony-origins-1880 | 1880 | Former Mercantile Library Hall site | [St. Louis Symphony Orchestra](https://slso.org/about-us/our-history/) |
| history-linnean-house-1882 | 1882 | Missouri Botanical Garden | [Missouri Botanical Garden](https://www.missouribotanicalgarden.org/gardens-gardening/our-garden/gardens-conservatories/conservatories/linnean-house) |
| history-old-post-office-1884 | 1884 | Old Post Office | [City of St. Louis Cultural Resources Office](https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/city-landmarks/Old-Post-Office.cfm) |
| history-pacific-fire-1891 | 1891 | St. Louis Street at First Street, Pacific | [City of Pacific](https://www.pacificmo.gov/199/History) |
| history-wainwright-1891 | 1891 | Wainwright Building | [City of St. Louis Cultural Resources Office](https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/city-landmarks/wainwright-builiding.cfm) |
| history-free-public-library-1893 | 1893 | Former Board of Education library building | [St. Louis Public Library](https://central.slpl.org/before_central.html) |
| history-kirkwood-station-1893 | 1893 | Kirkwood railroad station | [Amtrak / Great American Stations](https://www.greatamericanstations.org/stations/kirkwood-mo-kwd/) |
| history-union-station-1894 | September 1, 1894 | St. Louis Union Station | [City of St. Louis Cultural Resources Office](https://dynamic.stlouis-mo.gov/history/eventdetail.cfm?Master_ID=244) |
| history-granite-city-1896 | March 9, 1896 | Granite City centennial marker, Wilson Park | [City of Granite City financial statement and city-history marker](https://cms2.revize.com/revize/granitecityIllionis/Documents/Departments/Financial/City%20of%20Granite%20City%20FS%2025.pdf?t=202510282126520) |
| history-library-childrens-room-1897 | 1897 | Former Board of Education library building | [St. Louis Public Library](https://central.slpl.org/before_central.html) |
| history-city-hall-occupied-1898 | April 11, 1898 | St. Louis City Hall | [City of St. Louis](https://www.stlouis-mo.gov/government/about/history/history-of-city-hall.cfm) |

Coverage counts: city: 25, madison-il: 2, county: 3, franklin: 2, st-charles: 2.


---

## Research pass: 1900-1939

# History evidence — 1900–1939

36 proposed new records; reviewed November 16, 2026. No existing fair-opening or Olympics record duplicated. No source images copied. Summaries are original concise paraphrases.

## Coordinate method

OpenStreetMap/Nominatim matches were requested sequentially with at least 1.1 seconds between requests and cached in `/tmp/history1900_coords.json`. Matches were reviewed for name, address, geometry type and regional bounds. This cache is reusable; do not repeat the queries. OSM attribution/ODbL obligations remain in effect. No Esri geocoder coordinates were retained. Pins are representative points unless a marker or public landmark is explicitly identified. No point is claimed to be a surveyed scene, original footprint or complete event boundary.

Sportsman’s Park uses the cited Historical Marker Database coordinates converted from decimal minutes. Poro College uses a transparently approximate OSM address interpolation on St. Ferdinand, supported by the city’s documented historic address. Golden Lane uses a public Locust Street segment on the documented route. Art Hill uses the mapped summit; Lambert uses the present airport area, never a claim about the original field/factory boundary.

## Evidence notes

### history-joplin-residence-1901
State Parks explicitly says Joplin moved to this flat in spring 1901. Sources vary about the residence end year; this entry records only the verified move-in year, not an uncertain residence span.
Historical source: https://mostateparks.com/page/scott-joplin-house-state-historic-site/general-information-scott-joplin-house
Coordinate reference: https://www.openstreetmap.org/way/616033312

### history-flight-cage-1904
Zoo operator documents the 1904 commission and later city purchase. The year marks construction/exhibition, not an invented purchase day.
Historical source: https://stlzoo.org/zones/historic-hill/1904-flight-cage-and-cypress-swamp
Coordinate reference: https://www.openstreetmap.org/relation/20254181

### history-palace-fine-arts-1904
Distinct architectural and museum-development record, not a duplicate of the existing fair-opening record.
Historical source: https://www.slam.org/teachers-students/educator-resources/art-along-the-rivers/art-on-display/1904-st-louis-worlds-fair/
Coordinate reference: https://www.openstreetmap.org/node/265978495

### history-washu-hilltop-1905
University retrospective explicitly identifies January 30, 1905 and University Hall, now Brookings. Do not confuse this with the later commencement dedication.
Historical source: https://source.washu.edu/2006/09/a-hilltop-history-early-landscape-architects-charmed-by-vantage-point-liken-it-to-greece-acropolis/
Coordinate reference: https://www.openstreetmap.org/way/44076778

### history-central-library-1912
Date, event and institutional/site relationship are documented by City of St. Louis / St. Louis Public Library.
Historical source: https://www.stlouis-mo.gov/archives/newsgram/Centene-Charitable-Foundation-Donates-five-hundred-thousand-dollars-to-Central-Library-Project.cfm
Coordinate reference: https://www.openstreetmap.org/relation/18049260

### history-jefferson-memorial-1913
Date, event and institutional/site relationship are documented by City of St. Louis Cultural Resources Office.
Historical source: https://dynamic.stlouis-mo.gov/history/structdetail.cfm?Master_ID=2153
Coordinate reference: https://www.openstreetmap.org/relation/20071806

### history-railway-exchange-1913
Construction began in 1912; the city records opening in 1913. Building rather than guessed tenant room is mapped.
Historical source: https://dynamic.stlouis-mo.gov/history/structdetail.cfm?Master_ID=1590
Coordinate reference: https://www.openstreetmap.org/way/42366544

### history-cathedral-first-mass-1914
Official cathedral history places cornerstone on October 18, 1908 and first Mass six years to the day later. This is not the later formal consecration.
Historical source: https://cathedralstl.org/about
Coordinate reference: https://www.openstreetmap.org/way/477985197

### history-barnes-hospital-1914
Date, event and institutional/site relationship are documented by Barnes-Jewish Hospital.
Historical source: https://www.barnesjewish.org/About-Us/History
Coordinate reference: https://www.openstreetmap.org/way/450129606

### history-racial-segregation-ordinance-1916
State Archives explicitly dates the vote February 29, 1916. City Hall is transparently a civic reference, not a claim about where votes were cast.
Historical source: https://www.sos.mo.gov/mdh/curriculum/africanamerican/timeline/timeline4
Coordinate reference: https://www.openstreetmap.org/relation/11088391

### history-golden-lane-1916
Exhibit identifies June 14 and the twelve-block Locust Street route. OSM street segment lies between Tucker and Jefferson, the endpoints confirmed by the Pomeroy marker research.
Historical source: https://mhctc.missouri.edu/exhibitions/missouri-women-suffrage-to-statecraft/
Coordinate reference: https://www.openstreetmap.org/way/1357548533

### history-loretto-webster-1916
Archives transcribe the September 8, 1916 newspaper announcement of September 13 opening and separately describe the first library in Webster Hall.
Historical source: https://websterulibraryarchives.wordpress.com/category/webster-history/
Coordinate reference: https://www.openstreetmap.org/way/398188669

### history-east-st-louis-massacre-1917
LOC dates the July 2 massacre. State Archives situate preceding clashes June 30–July 2 and refugees crossing to St. Louis. City chronology names the Eads crossing; its erroneous body date July 12 is not used. No disputed casualty total is repeated.
Historical source: https://www.loc.gov/exhibits/civil-rights-act/segregation-era.html
Coordinate reference: https://www.openstreetmap.org/way/575157629

### history-poro-college-1918
SHSMO states 1918 and cites a November 29, 1918 St. Louis Argus grand-opening report. Other summaries give 1917 or the developed complex in 1920; year precision is retained. Coordinate is an OSM street-based interpolation of documented historical address 4300 St. Ferdinand, not a newly invented address.
Historical source: https://historicmissourians.shsmo.org/annie-turnbo-malone/
Coordinate reference: https://www.openstreetmap.org/way/6408371

### history-muny-first-season-1919
Date, event and institutional/site relationship are documented by The Muny.
Historical source: https://muny.org/about/history/muny-history-in-full-color/
Coordinate reference: https://www.openstreetmap.org/way/40700258

### history-lambert-field-1920
Airport operator’s institutional history; year precision retained.
Historical source: https://www.flystl.com/about/history/
Coordinate reference: https://www.openstreetmap.org/way/209245943

### history-lambert-air-races-1923
Operator source; separate from the 1920 founding.
Historical source: https://www.flystl.com/about/history/
Coordinate reference: https://www.openstreetmap.org/way/209245943

### history-st-louis-theatre-1925
Date, event and institutional/site relationship are documented by St. Louis Symphony Orchestra.
Historical source: https://slso.org/about-us/powell-hall-history/
Coordinate reference: https://www.openstreetmap.org/way/202425813

### history-world-series-st-louis-1926
SABR research cites contemporary newspapers and game records. The event is the local Game 3, not the series-winning Game 7 played in New York.
Historical source: https://sabr.org/gamesproj/game/october-5-1926-cardinals-jesse-haines-tosses-shutout-and-homers-in-first-world-series-game-in-st-louis/
Coordinate reference: https://www.hmdb.org/m.asp?m=307134

### history-meramec-state-park-1927
Official land-acquisition table gives 1927. Narrative describes purchases as early as 1926; record uses official system-acquisition year rather than claiming a first land transaction.
Historical source: https://mostateparks.com/page/state-park-land-acquisition-summary
Coordinate reference: https://www.openstreetmap.org/relation/7793422

### history-lindbergh-art-hill-1927
Park partner’s timeline explicitly dates the Art Hill reception June 19, 1927. OSM Art Hill summit point is a representative landmark, not a precise platform position.
Historical source: https://www.forestparkforever.org/park-timeline
Coordinate reference: https://www.openstreetmap.org/node/4763089195

### history-tornado-fountain-park-1927
NWS establishes September 29 and Webster Groves-to-city path; library documents Fountain Park damage. Avoid conflicting origin claims in local summaries.
Historical source: https://www.weather.gov/lsx/stlouis_tor
Coordinate reference: https://www.openstreetmap.org/way/156851855

### history-united-hebrew-temple-1927
MHS institutional history explicitly says construction 1924–1926 and opening 1927. Search-indexed first-party page was readable; direct fetch returned 403.
Historical source: https://mohistory.org/library/library-research-center-history/
Coordinate reference: https://www.openstreetmap.org/way/617281833

### history-lambert-municipal-1928
Official airport history; acquisition not conflated with founding.
Historical source: https://www.flystl.com/about/history/
Coordinate reference: https://www.openstreetmap.org/way/209245943

### history-curtiss-robertson-1928
Airport history dates local airframe manufacturing from 1928.
Historical source: https://www.flystl.com/about/history/
Coordinate reference: https://www.openstreetmap.org/way/209245943

### history-fox-theatre-1929
Date, event and institutional/site relationship are documented by City of St. Louis Cultural Resources Office.
Historical source: https://dynamic.stlouis-mo.gov/history/structdetail.cfm?Master_ID=1352
Coordinate reference: https://www.openstreetmap.org/way/202419428

### history-chain-rocks-bridge-1929
Date, event and institutional/site relationship are documented by National Park Service.
Historical source: https://home.nps.gov/places/chain-of-rocks-bridge.htm
Coordinate reference: https://www.openstreetmap.org/way/1149179828

### history-civil-courts-1930
OSM’s current Clyde S. Cahill Courts Building matches the historic Civil Courts location and footprint; not confused with the federal courthouse.
Historical source: https://dynamic.stlouis-mo.gov/history/structdetail.cfm?Master_ID=2090
Coordinate reference: https://www.openstreetmap.org/way/565578443

### history-meramec-route66-bridge-1932
Date, event and institutional/site relationship are documented by National Park Service.
Historical source: https://www.nps.gov/places/meramec-river-us-66-bridge.htm
Coordinate reference: https://www.openstreetmap.org/relation/15828003

### history-ccc-meramec-1933
State Parks says CCC work began in 1933; not a claim that every surviving structure dates to that year.
Historical source: https://mostateparks.com/page/meramec-state-park/general-information-meramec
Coordinate reference: https://www.openstreetmap.org/relation/7793422

### history-municipal-auditorium-1934
Archives exhibit cites the dedication brochure and April 14 opening. Theatre operator distinguishes completion dates for later portions; no claim every hall was complete that day.
Historical source: https://digitalexhibits.library.washu.edu/s/music-segregation/page/Urban_League_Auditorium
Coordinate reference: https://www.openstreetmap.org/way/108705184

### history-national-folk-festival-1934
WashU documents exact dates, performers and contemporary seating announcement. Festival institution confirms first festival in St. Louis in 1934.
Historical source: https://digitalexhibits.library.washu.edu/s/music-segregation/page/Urban_League_Auditorium
Coordinate reference: https://www.openstreetmap.org/way/108705184

### history-jewel-box-1936
Forest Park Forever timeline explicitly gives opening/dedication November 14, 1936; city operator confirms 1936 construction.
Historical source: https://www.forestparkforever.org/park-timeline
Coordinate reference: https://www.openstreetmap.org/way/28533273

### history-homer-phillips-1937
Becker dates opening to February 1937. OSM historic campus in the Ville matches the city landmark address near Whittier; retained as campus-level precision.
Historical source: https://beckerexhibits.wustl.edu/legacy-exhibits/mowihsp/win/Timeline/HGPhillipsHosp1937.htm
Coordinate reference: https://www.openstreetmap.org/way/574992672

### history-soldiers-memorial-1938
City page says opening Memorial Day 1938, then fixed on May 30; earlier 1936 site dedication is not confused with opening.
Historical source: https://www.stlouis-mo.gov/parks/parks/browse-parks/amenity.cfm?id=86
Coordinate reference: https://www.openstreetmap.org/way/108704943

### history-black-tuesday-smoke-1939
DNR explicitly dates November 28, 1939 and identifies a photograph in which City Hall disappeared behind smoke.
Historical source: https://dnr.mo.gov/air/hows-air/missouri-skies-now-then
Coordinate reference: https://www.openstreetmap.org/relation/11088391

## Review cautions

Month-precision historicalDate values are YYYY-MM (three records). Parent added month validation; all 36 records pass validHistoricalEvent. dateSort supplies the first day only for ordering, not as a displayed historical day.

Broader records such as segregation and smoke use clearly labeled civic reference points. The East St. Louis massacre pin marks the Eads refugee crossing, not a fabricated murder scene. Current public-health, safety or building-access conditions are not implied.

MHS Library history was available in first-party indexed content but direct fetch returned 403. It explicitly records the 1927 opening. No unverified claims about current opening hours, active institutions, tours or access are added.

All records are stable historical research. No daily refresh job or audit schedule is created.


---

## Research pass: 1940-1979

# 1940–1979 research evidence and placement notes

Reviewed November 16, 2026. 34 original-paraphrase records, no photographs copied, no casualty counts or exact event times inferred. This is static historical reference research for an explicit expansion request; no new recurring job.

## Precision decisions

- Dates use only sourced precision. Jefferson Bank retains 1963–1964 because the City page’s August opening day differs from other historical accounts; the exact day is not essential to the record. Its coordinate is corrected to the former Washington/Jefferson bank area, not later branches. Final address interpolation is 2600 Washington Avenue; all such pins are approximate.
- Pruitt-Igoe opening and demolition are separate meaningful phases. City legacy pages disagree with other sources about building counts and completion of demolition, so those numbers and an asserted final-clearance date are omitted. The demolition record concerns only the initial 1972 phase. A legacy City fetch timed out, but indexed content was readable; the Black heritage trail’s licensed institutional history and SHSMO action-program collection corroborate the phase.
- Climatron’s institutional archive separates dedication (October 1) and public opening (the following day), while a current page compresses those dates. The record deliberately uses October 1960.
- Weldon’s 1957–1966 processing period follows Missouri DNR, corroborated by federal historical material. Some federal cleanup tables start operations in 1958; the record describes the operating era including initial testing and does not invent an opening ceremony.
- Shelley marks the local home associated with the national case, explicitly not the Supreme Court decision venue. It is a private residence. The medical Nobel records likewise map the research campus, not Stockholm award ceremonies.
- Lambert glider-crash timing follows the City narrative plus the Missouri Archives certificate of death, rather than the inconsistent machine-readable death field on the City’s legacy page.
- The current airport reference point is approximate for the old terminal and 1943 crash. Mercury/Gemini use physical commemorative markers near the historic McDonnell campus; the 1966 crash uses the See/Bassett memorial, not an invented impact point.
- Mill Creek clearance uses a verified modern reference near the eastern end of the documented neighborhood boundaries. Fairground Park, zoo, university, Japanese Garden and Times Beach records explicitly use wider campus/park/town reference points.
- NHL/MLB summaries deliberately remain very short. No game imagery, logos or commentary reproduced.
- Research candidates not included: Chuck Berry/Cosmopolitan Club (join-date and exact address conflicts need more review); a 1959 tornado pin (no precise documented affected location resolved in this batch). No candidate was retained solely to inflate the count.

## Coordinate method

HMDB marker coordinates were converted from decimal minutes to decimal degrees; marker pages are linked per record. Named OSM places and addresses were retrieved with Nominatim and inspected for the correct locality. OSM result JSON is in `/tmp/history-1940-coordinates.json`, `/tmp/history-1940-coordinates-extra.json`, and `/tmp/history-jefferson-corrected.json`. The Japanese Garden and Times Beach references use point-on-surface geometry from existing reviewed `quieter-parks.json` polygons, with boundary IDs retained. Existing OpenStreetMap attribution applies. No road/park/venue dataset was refreshed.

## Record evidence index

Each entry below links the event evidence and the placement reference. Detailed location limitations remain in each JSON record rather than being hidden in this note.

- `history-weldon-ordnance-1941`: [event source](https://www.energy.gov/lm/about-weldon-spring-site-interpretive-center); [location reference](https://www.hmdb.org/m.asp?m=182626).
- `history-mallinckrodt-uranium-1942`: [event source](https://www.mvs.usace.army.mil/Missions/FUSRAP/SLDS/); [location reference](https://www.openstreetmap.org/way/423921024).
- `history-lambert-glider-crash-1943`: [event source](https://dynamic.stlouis-mo.gov/history/peopledetail.cfm?Master_ID=984); [location reference](https://www.openstreetmap.org/way/209245943).
  Supplement: https://www.sos.mo.gov/images/archives/deathcerts/1943/1943_00025967.PDF
  Supplement: https://www.ww2gp.org/CG-4A/stlouiscrash.php
- `history-slu-integration-1944`: [event source](https://www.slu.edu/news/2020/february/slu-legends-lore-heithaus-homily.php); [location reference](https://www.openstreetmap.org/relation/13181825).
- `history-erlanger-gasser-nobel-1944`: [event source](https://beckerexhibits.wustl.edu/s/neurosciences/page/erlanger); [location reference](https://www.openstreetmap.org/relation/19801414).
- `history-world-series-st-louis-1944`: [event source](https://www.mlb.com/cardinals/video/topic/cardinals-vault); [location reference](https://www.hmdb.org/m.asp?m=307134).
- `history-cori-nobel-1947`: [event source](https://biochem.wustl.edu/archives/carl-and-gerty-cori); [location reference](https://www.openstreetmap.org/relation/19801414).
- `history-shelley-covenant-1948`: [event source](https://www.nps.gov/places/missouri-the-shelley-house-l.htm); [location reference](https://www.hmdb.org/m.asp?m=151666).
- `history-helen-nash-faculty-1949`: [event source](https://desegregationhistory.med.wustl.edu/endless-timeline/); [location reference](https://www.openstreetmap.org/relation/8493363).
- `history-fairground-pool-violence-1949`: [event source](https://commonreader.wustl.edu/the-long-reconstruction-of-fairground-park/); [location reference](https://www.openstreetmap.org/way/28996459).
- `history-washu-undergraduate-desegregation-1952`: [event source](https://libguides.wustl.edu/wustl-faq/deseg); [location reference](https://www.openstreetmap.org/relation/18459816).
- `history-pruitt-igoe-opens-1954`: [event source](https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/preservation-plan/Part-I-People-and-Government.cfm); [location reference](https://www.openstreetmap.org/relation/15877530).
- `history-lambert-terminal-1956`: [event source](https://www.flystl.com/about/history/); [location reference](https://www.openstreetmap.org/way/209245943).
- `history-weldon-uranium-1957`: [event source](https://dnr.mo.gov/waste-recycling/sites-regulated-facilities/federal/weldon-spring-site); [location reference](https://www.hmdb.org/m.asp?m=133241).
- `history-mercury-contract-1959`: [event source](https://www.nasa.gov/history/65-years-ago-nasa-formally-establishes-the-space-task-group/); [location reference](https://www.hmdb.org/m.asp?m=146059).
- `history-mill-creek-clearance-1959`: [event source](https://www.primecenter.org/prime-blog/urban-renewal-in-education); [location reference](https://www.openstreetmap.org/way/1268400174).
- `history-climatron-1960`: [event source](https://www.mobot.org/mobot/archives/section.asp?section=52); [location reference](https://www.openstreetmap.org/way/149736800).
- `history-gemini-contract-1961`: [event source](https://www.nasa.gov/history/60-years-ago-gemini-1-flies-a-successful-uncrewed-test-flight/); [location reference](https://www.hmdb.org/m.asp?m=146080).
- `history-jefferson-bank-protests-1963`: [event source](https://www.stlouis-mo.gov/government/departments/mayor/news/on-the-map-jefferson-bank-and-trust.cfm); [location reference](https://www.openstreetmap.org/way/1304167671).
- `history-planetarium-opens-1963`: [event source](https://www.slsc.org/james-s-mcdonnell-planetarium-to-receive-largest-technology-upgrade-in-more-than-25-years/); [location reference](https://www.hmdb.org/m.asp?m=141177).
- `history-zooline-railroad-1963`: [event source](https://stlzoo.org/zones/historic-hill/zooline-railroad); [location reference](https://www.openstreetmap.org/relation/20254181).
- `history-umsl-created-1963`: [event source](https://www.umsl.edu/proud/history.html); [location reference](https://www.openstreetmap.org/way/151230737).
- `history-siue-campus-1965`: [event source](https://digitallis.isg.siue.edu/exhibits/show/siue-opening/siue-opening-intro); [location reference](https://www.openstreetmap.org/way/264302739).
- `history-gemini-crew-crash-1966`: [event source](https://www.nasa.gov/history/remembering-elliot-see-and-charles-bassett/); [location reference](https://www.hmdb.org/m.asp?m=146080).
- `history-busch-memorial-1966`: [event source](https://www.mlb.com/cardinals/history/ballparks); [location reference](https://www.hmdb.org/m.asp?m=133369).
- `history-repertory-theatre-first-production-1966`: [event source](https://repstl.org/rep-history/); [location reference](https://www.openstreetmap.org/way/375010915).
- `history-blues-first-game-1967`: [event source](https://www.nhl.com/blues/team/history/great-moments); [location reference](https://www.openstreetmap.org/way/586658690).
  Supplement: https://www.iihf.com/en/news/13430/a-happy-original-blue
  Supplement: https://cdm17210.contentdm.oclc.org/digital/collection/postcards/id/576/rec/22
  Supplement: https://doi.org/10.21690/foge/2021.64.5f
- `history-mississippi-river-festival-1969`: [event source](https://www.historyillinois.org/historical-markers/mississippi-river-festival,-the); [location reference](https://www.hmdb.org/m.asp?m=144301).
- `history-pruitt-igoe-demolition-1972`: [event source](https://dynamic.stlouis-mo.gov/history/eventdetail.cfm?Master_ID=385); [location reference](https://www.openstreetmap.org/relation/15877530).
  Supplement: https://www.stlblackheritage.com/stlbhn-trail-locations/pruitt-igoe-housing-project
  Supplement: https://collections.shsmo.org/manuscripts/saint-louis/s0409
- `history-times-beach-oil-1972`: [event source](https://semspub.epa.gov/work/07/30296196.pdf); [location reference](https://www.openstreetmap.org/relation/15828003).
- `history-laumeier-opens-1976`: [event source](https://laumeiersculpturepark.org/our-story); [location reference](https://www.hmdb.org/m.asp?m=219081).
- `history-opera-theatre-first-season-1976`: [event source](https://opera-stl.org/about-us/mission-history/); [location reference](https://www.openstreetmap.org/way/375010915).
- `history-seiwa-en-dedicated-1977`: [event source](https://www.mobot.org/mobot/archives/section.asp?section=68); [location reference](https://www.openstreetmap.org/way/126455888).
- `history-union-station-last-trains-1978`: [event source](https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/preservation-plan/Part-I-Transportation.cfm); [location reference](https://www.openstreetmap.org/node/1422456546).

## Coverage

{'st-charles': 2, 'city': 19, 'county': 11, 'madison-il': 2}

{'industry': 3, 'disaster': 3, 'civil-rights': 6, 'science': 6, 'sports': 3, 'government': 3, 'engineering': 3, 'education': 2, 'culture': 5}


---

## Research pass: 1980-present

# Modern St. Louis history research: 1980–present

Prepared November 16, 2026. Deliverable: 39 selected completed historical events, from 1982 through 2025; not a complete chronology or an upcoming-event feed. All event dates and locations were checked against the linked evidence. No repository or published site files were changed by this agent.

## Evidence and precision

- Historical claims use official institutions, government agencies, the Vatican, and primary sports records. Mapcarta/OSM and photographed historical markers supply some public-site coordinate references; these are separate from primary event evidence.
- Public venues, gauges, parks and municipal buildings are reference points. Where a pin represents a large campus, regional flood, tornado or movement rather than an exact event spot, the feature explicitly says so. No residential crime-scene pins were introduced.
- Month/year precision is retained in historicalDate and historicalDateLabel. The first day used in dateSort is a sorting convention only. Historical records contain no upcoming start/end expiry fields.
- The 1982 championship pin is its public commemorative marker, not a claim that today’s Busch III hosted the game. The 1999 Mass pin is the actual stadium building. The 2014 demonstrations use the public Ferguson Police Department area, not the shooting site.
- Existing reviewed coordinates were reused for several established venues and OSM park geometries; USGS, USACE and NWS provide gauging/observation coordinates. Lambert retains the rounded coordinates published by NWS rather than fabricated greater accuracy.
- Text is original, brief paraphrase. No source photographs or logos were copied. Existing OpenStreetMap attribution remains necessary for OSM-derived positions.

## Retrieval issues and deliberate exclusions

- DOJ COPS catalog/PDF pages returned 403 to direct opening but their official indexed contents were available through search. The Ferguson record is additionally corroborated by contemporary firsthand Human Rights Watch documentation. This retrieval failure is not evidence that the historical material is unavailable to all visitors.
- The EPA NEPIS text version failed text decoding; the Citygarden event uses the working EPA PDF instead.
- The MLB media-guide PDF exceeded browser extraction size. The 1982 record uses MLB’s short official game page, with a brief description and separately sourced marker coordinates.
- Direct OSM/Overpass access was unavailable during coordinate review; published OSM coordinate pages and existing reviewed repository geometry were used, with identity checks against official event sources.
- Did not guess a precise historic Washington University genomics laboratory location, an original Danforth founding-meeting location, or a specific October 1997 City Museum day. Danforth uses a labeled present-campus reference; City Museum uses month precision.
- The 2025 tornado follows the updated NWS review. A Forest Park partner timeline contains an inconsistent tornado rating, so it was used only to confirm park damage, not rating or track metrics.
- No claims of complete historical coverage, future events, current opening hours, private-home locations, or unsourced attendance/fatality estimates were added.

## Record evidence

### history-fox-restoration-1982

- Event: Fabulous Fox reopens after restoration
- Date: September 7, 1982 (day precision)
- Primary source: https://www.fabulousfox.com/theatre-info
- Coordinate source: https://mapcarta.com/32001676
- Coordinate evidence: Published map coordinates identify Fox Theatre. Historical identity and event date are independently supported by the event source.
- Location limit: Public Fox Theatre reference point; not an entrance or interior-room coordinate.

### history-cardinals-world-series-1982

- Event: Cardinals win the 1982 World Series
- Date: October 20, 1982 (day precision)
- Primary source: https://www.mlb.com/video/1982-ws-gm-7-mil-stl-c3708019
- Coordinate source: https://www.hmdb.org/m.asp?m=133407
- Coordinate evidence: HMdb records the photographed October 20, 1982 World Champions marker at 38°37.319′ N, 90°11.499′ W. Converted to decimal degrees; used as a clearly labeled commemorative reference.
- Location limit: Public commemorative marker on South Broadway near Spruce Street; the marker is not the old Busch Stadium II playing field.
- Supporting source: https://www.baseball-reference.com/boxes/SLN/SLN198210200.shtml

### history-times-beach-evacuation-1982

- Event: Times Beach flood and evacuation
- Date: December 1982 (month precision)
- Primary source: https://www.epa.gov/mo/town-flood-and-superfund-looking-back-times-beach-disaster-nearly-40-years-later
- Coordinate source: https://www.openstreetmap.org/relation/15828003
- Coordinate evidence: Existing reviewed quieter-parks.json representative point lies inside Route 66 State Park polygon. EPA identifies the former Times Beach site as the park.
- Location limit: Reference point inside present Route 66 State Park/former Times Beach; not an individual former home or contamination boundary.

### history-union-station-reuse-1985

- Event: Union Station reopens through adaptive reuse
- Date: 1985 (year precision)
- Primary source: https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/Union-Station-Historic-District.cfm
- Coordinate source: https://mapcarta.com/W108705187
- Coordinate evidence: Published map coordinates identify Union Station complex. Historical identity and event date are independently supported by the event source.
- Location limit: Public Union Station complex reference point; not an entrance or interior-room coordinate.

### history-melvin-price-operation-1989

- Event: Melvin Price Locks and Dam begins operating
- Date: October 10, 1989 (day precision)
- Primary source: https://www.mvs.usace.army.mil/Missions/Navigation/Locks-and-Dams/Melvin-Price/
- Coordinate source: https://rivergages.mvr.usace.army.mil/WaterControl/stationinfo2.cfm?dt=S&fid=ALNI2&sid=CE2256B4
- Coordinate evidence: USACE publishes gauge coordinate at downstream end of intermediate lock wall, river mile 200.5.
- Location limit: Locks-and-dam reference at the documented gauge; not a visitor entrance.

### history-science-center-oakland-1991

- Event: Science Center opens its Oakland Avenue expansion
- Date: November 2, 1991 (day precision)
- Primary source: https://www.slsc.org/about-the-saint-louis-science-center/
- Coordinate source: https://www.slsc.org/visit/
- Coordinate evidence: Existing reviewed movie-screenings.json OMNIMAX venue coordinate at the official 5050 Oakland Avenue campus.
- Location limit: Public Oakland Avenue Science Center building reference; not an auditorium seat.

### history-metrolink-opening-1993

- Event: MetroLink begins service
- Date: July 31, 1993 (day precision)
- Primary source: https://www.metrostlouis.org/nextstop/happy-30th-birthday-metrolink/
- Coordinate source: https://mapcarta.com/N1422456546
- Coordinate evidence: Published map coordinates identify Union Station MetroLink station. Historical identity and event date are independently supported by the event source.
- Location limit: Public Union Station MetroLink station reference point; not an entrance or interior-room coordinate.

### history-great-flood-crest-1993

- Event: Great Flood reaches its St. Louis crest
- Date: August 1, 1993 (day precision)
- Primary source: https://www.weather.gov/lsx/1993_flood
- Coordinate source: https://waterqualitydata.us/provider/NWIS/USGS-MO/USGS-07010000/
- Coordinate evidence: USGS monitoring-location metadata publishes 38.629,-90.1797778 (NAD83).
- Location limit: St. Louis Mississippi River gauge reference; not the full 1993 flood extent.

### history-kiel-center-opening-1994

- Event: Kiel Center opens, later Enterprise Center
- Date: October 8, 1994 (day precision)
- Primary source: https://www.enterprisecenter.com/about-us
- Coordinate source: https://www.enterprisecenter.com/about-us
- Coordinate evidence: Existing reviewed sports-events.json Enterprise Center venue coordinates; official page confirms 1401 Clark Avenue.
- Location limit: Public arena reference point; not a specific seat or stage.

### history-holocaust-museum-1995

- Event: St. Louis Holocaust Museum opens
- Date: 1995 (year precision)
- Primary source: https://stlholocaustmuseum.org/about-us/
- Coordinate source: https://stlholocaustmuseum.org/visit/info/
- Coordinate evidence: Museum directions link supplies map center 38.6849177,-90.4070029. Rounded to a campus-area reference, not used as an exact building coordinate. Official address is 36 Millstone Campus Drive.
- Location limit: Museum campus area reference, approximately located; the original 1995 facility and expanded building are represented by this campus pin.

### history-city-museum-opening-1997

- Event: City Museum opens
- Date: October 1997 (month precision)
- Primary source: https://citymuseum.org/all-aboard-city-express-train/
- Coordinate source: https://mapcarta.com/W202269269
- Coordinate evidence: Published map coordinates identify City Museum. Historical identity and event date are independently supported by the event source.
- Location limit: Public City Museum reference point; not an entrance or interior-room coordinate.
- Supporting source: https://www.visitmo.com/things-to-do/city-museum

### history-danforth-center-founded-1998

- Event: Danforth Plant Science Center is founded
- Date: 1998 (year precision)
- Primary source: https://www.danforthcenter.org/about-us/mission/
- Coordinate source: https://mapcarta.com/W878939650
- Coordinate evidence: Published map coordinates identify Danforth Plant Science Center. Historical identity and event date are independently supported by the event source.
- Location limit: Present campus reference for the institution founded in 1998; not a claim that this building opened that year.

### history-butterfly-house-opening-1998

- Event: Butterfly House opens in Faust Park
- Date: September 18, 1998 (day precision)
- Primary source: https://www.missouribotanicalgarden.org/plan-your-visit/family-of-attractions/butterfly-house/about-the-butterfly-house
- Coordinate source: https://mapcarta.com/W1391906599
- Coordinate evidence: Published map coordinates identify Butterfly House. Historical identity and event date are independently supported by the event source.
- Location limit: Public Butterfly House reference point; not an entrance or interior-room coordinate.

### history-papal-mass-dome-1999

- Event: John Paul II celebrates Mass at the Dome
- Date: January 27, 1999 (day precision)
- Primary source: https://www.vatican.va/content/john-paul-ii/en/homilies/1999/documents/hf_jp-ii_hom_19990127_stlouis.html
- Coordinate source: https://mapcarta.com/W24963449
- Coordinate evidence: OSM way 24963449 identifies the Dome at 701 Convention Plaza, with Trans World Dome as its former name. The Vatican record independently identifies the event venue and date.
- Location limit: Public stadium-building reference, now the Dome at America’s Center; not a precise altar or seating position.
- Supporting source: https://explorestlouis.com/press-release/a-brief-history-of-americas-center/

### history-route66-park-opening-1999

- Event: Former Times Beach becomes Route 66 State Park
- Date: September 1999 (month precision)
- Primary source: https://cumulis.epa.gov/supercpad/SiteProfiles/index.cfm?fuseaction=second.cleanup&id=0701237
- Coordinate source: https://www.openstreetmap.org/relation/15828003
- Coordinate evidence: Existing reviewed quieter-parks.json representative point lies inside Route 66 State Park polygon. EPA identifies the former Times Beach site as the park.
- Location limit: Reference point inside present Route 66 State Park/former Times Beach; not an individual former home or contamination boundary.

### history-pulitzer-opening-2001

- Event: Pulitzer Arts Foundation opens
- Date: October 2001 (month precision)
- Primary source: https://pulitzerarts.org/mission-and-history/
- Coordinate source: https://mapcarta.com/W379499176
- Coordinate evidence: Published map coordinates identify Pulitzer Arts Foundation. Historical identity and event date are independently supported by the event source.
- Location limit: Public Pulitzer Arts Foundation reference point; not an entrance or interior-room coordinate.

### history-shiloh-scott-metrolink-2003

- Event: MetroLink reaches Shiloh-Scott
- Date: May 2003 (month precision)
- Primary source: https://www.bistatedev.org/wp-content/uploads/2019/02/FY-2018-Comprehensive-Annual-Financial-Report.pdf
- Coordinate source: https://mapcarta.com/N317075170
- Coordinate evidence: Published map coordinates identify Shiloh-Scott MetroLink station. Historical identity and event date are independently supported by the event source.
- Location limit: Public Shiloh-Scott MetroLink station reference point; not an entrance or interior-room coordinate.

### history-cam-building-opening-2003

- Event: Contemporary Art Museum opens its new building
- Date: September 19, 2003 (day precision)
- Primary source: https://camstl.org/event/20gala/
- Coordinate source: https://mapcarta.com/W379499179
- Coordinate evidence: Published map coordinates identify Contemporary Art Museum. Historical identity and event date are independently supported by the event source.
- Location limit: Public Contemporary Art Museum reference point; not an entrance or interior-room coordinate.

### history-busch-stadium-opening-2006

- Event: New Busch Stadium opens
- Date: April 10, 2006 (day precision)
- Primary source: https://www.mlb.com/cardinals/ballpark
- Coordinate source: https://www.mlb.com/cardinals/ballpark
- Coordinate evidence: Existing reviewed sports-events.json Busch Stadium venue coordinates; official ballpark page identifies the current stadium.
- Location limit: Public Busch Stadium III reference point; not a specific seat.

### history-crosscounty-metrolink-2006

- Event: Cross County MetroLink extension opens
- Date: August 26, 2006 (day precision)
- Primary source: https://www.bistatedev.org/wp-content/uploads/2019/02/FY-2018-Comprehensive-Annual-Financial-Report.pdf
- Coordinate source: https://mapcarta.com/N565861185
- Coordinate evidence: Published map coordinates identify Shrewsbury-Lansdowne MetroLink station. Historical identity and event date are independently supported by the event source.
- Location limit: Terminal-station reference for an extension spanning City and County; not the full line geometry.

### history-cardinals-world-series-2006

- Event: Cardinals win 2006 World Series at Busch
- Date: October 27, 2006 (day precision)
- Primary source: https://www.mlb.com/cardinals/video/wainwright-closes-out-series-c7143419
- Coordinate source: https://www.mlb.com/cardinals/ballpark
- Coordinate evidence: Existing reviewed sports-events.json Busch Stadium venue coordinates; official ballpark page identifies the current stadium.
- Location limit: Public Busch Stadium III reference point; not a specific seat.

### history-citygarden-opening-2009

- Event: Citygarden opens downtown
- Date: July 1, 2009 (day precision)
- Primary source: https://www.epa.gov/sites/default/files/2014-02/documents/gac_littlerock_low.pdf
- Coordinate source: https://mapcarta.com/W109105644
- Coordinate evidence: Published map coordinates identify Citygarden. Historical identity and event date are independently supported by the event source.
- Location limit: Public Citygarden reference point; not an entrance or interior-room coordinate.
- Supporting source: https://citygardenstl.org/design-details/

### history-good-friday-tornado-2011

- Event: Good Friday tornado damages Lambert airport
- Date: April 22, 2011 (day precision)
- Primary source: https://www.weather.gov/lsx/04_22_2011
- Coordinate source: https://forecast.weather.gov/MapClick.php?lat=38.6357&lon=-90.2446
- Coordinate evidence: NWS publishes KSTL station latitude 38.75 N and longitude 90.37 W. Kept at the published precision.
- Location limit: Approximate Lambert airport reference at the published weather-observation position; not an exact damage point or the full tornado track.

### history-chess-hall-stl-opening-2011

- Event: World Chess Hall of Fame opens in St. Louis
- Date: September 9, 2011 (day precision)
- Primary source: https://worldchesshof.org/about/our-history/
- Coordinate source: https://mapcarta.com/N9209122821
- Coordinate evidence: Published map coordinates identify World Chess Hall of Fame. Historical identity and event date are independently supported by the event source.
- Location limit: Public World Chess Hall of Fame reference point; not an entrance or interior-room coordinate.

### history-kiel-opera-reopening-2011

- Event: Kiel Opera House reopens as Peabody Opera House
- Date: October 1, 2011 (day precision)
- Primary source: https://www.stifeltheatre.com/history
- Coordinate source: https://www.stifeltheatre.com/history
- Coordinate evidence: Existing concert-calendar.json Stifel Theatre venue coordinate, matched to 1400 Market Street.
- Location limit: Public Stifel Theatre building reference; not a stage coordinate.

### history-cardinals-world-series-2011

- Event: Cardinals clinch the 2011 World Series at Busch
- Date: October 28, 2011 (day precision)
- Primary source: https://www.govinfo.gov/content/pkg/CRECB-2011-pt12/pdf/CRECB-2011-pt12.pdf
- Coordinate source: https://www.mlb.com/cardinals/ballpark
- Coordinate evidence: Existing reviewed sports-events.json Busch Stadium venue coordinates; official ballpark page identifies the current stadium.
- Location limit: Public Busch Stadium III reference point; not a specific seat.

### history-weldon-spring-tornado-2013

- Event: EF3 tornado crosses St. Charles and north St. Louis
- Date: May 31, 2013 (day precision)
- Primary source: https://www.weather.gov/lsx/05_31_2013
- Coordinate source: https://www.weather.gov/lsx/05_31_2013
- Coordinate evidence: NWS survey gives tornado start at latitude 38.6867 longitude-90.7498, four miles southwest of Weldon Spring.
- Location limit: NWS surveyed approximate tornado-start point; not a visitor site, exact property claim or full storm track.

### history-musial-bridge-opening-2014

- Event: Stan Musial Veterans Memorial Bridge opens
- Date: February 9, 2014 (day precision)
- Primary source: https://www.modot.org/node/41213
- Coordinate source: https://mapcarta.com/W575158249
- Coordinate evidence: Published map coordinates identify Stan Musial Veterans Memorial Bridge. Historical identity and event date are independently supported by the event source.
- Location limit: Bridge-span reference; not a pedestrian access point or full bridge outline.

### history-ferguson-demonstrations-2014

- Event: Ferguson demonstrations follow Michael Brown’s death
- Date: August 2014 (month precision)
- Primary source: https://portal.cops.usdoj.gov/resourcecenter/Home.aspx?item=cops-p317
- Coordinate source: https://mapcarta.com/31716432
- Coordinate evidence: The DOJ after-action assessment documents gatherings on South Florissant Road across from Ferguson Police Department. OSM way 314356774 locates that public department. Month precision describes the August phase, not an asserted end to the wider movement.
- Location limit: Public police-department area reference for documented nearby demonstrations; not the shooting location, a private home, or the footprint of all protests.
- Supporting source: https://portal.cops.usdoj.gov/resourcecenter/content.ashx/cops-p317-pub.pdf
- Supporting source: https://www.hrw.org/news/2014/09/09/letter-missouri-governor-jay-nixon-about-law-enforcement-response-ferguson-protests

### history-ferguson-doj-findings-2015

- Event: Justice Department publishes Ferguson findings
- Date: March 4, 2015 (day precision)
- Primary source: https://www.justice.gov/crt/case/united-states-v-city-ferguson
- Coordinate source: https://mapcarta.com/31716432
- Coordinate evidence: Published map coordinates identify Ferguson Police Department. Historical identity and event date are independently supported by the event source.
- Location limit: Public police-department reference for a citywide civil-rights case; not a private incident site or the court hearing location.

### history-meramec-winter-flood-2015

- Event: Winter flooding overwhelms the lower Meramec region
- Date: December 2015–January 2016 (month precision)
- Primary source: https://www.weather.gov/media/lsx/recent_event/2015_DecemberFlooding.pdf
- Coordinate source: https://waterqualitydata.us/provider/NWIS/USGS-MO/USGS-07019130/
- Coordinate evidence: USGS Valley Park gauge metadata publishes 38.5466111,-90.4850278 (NAD83).
- Location limit: Valley Park river-gauge reference for a regional flood; not the inundation boundary.

### history-ferguson-consent-decree-2016

- Event: Ferguson policing consent decree enters effect
- Date: April 19, 2016 (day precision)
- Primary source: https://www.justice.gov/crt/case-document/united-states-v-city-ferguson-consent-decree
- Coordinate source: https://mapcarta.com/31716432
- Coordinate evidence: Published map coordinates identify Ferguson Police Department. Historical identity and event date are independently supported by the event source.
- Location limit: Public police-department reference for a citywide civil-rights case; not a private incident site or the court hearing location.

### history-arch-museum-reopening-2018

- Event: New Gateway Arch museum and grounds open
- Date: July 3, 2018 (day precision)
- Primary source: https://www.archpark.org/foundation/legacy/
- Coordinate source: https://www.nps.gov/planyourvisit/event-details.htm?id=FEE6FAAB-D0F2-037A-FB556667087E0282
- Coordinate evidence: Existing reviewed NPS Arch grounds coordinate reused.
- Location limit: Gateway Arch grounds reference; the event also involved the surrounding park.

### history-blues-cup-rally-2019

- Event: Blues championship parade reaches the Arch
- Date: June 15, 2019 (day precision)
- Primary source: https://www.nhl.com/blues/team/history/great-moments
- Coordinate source: https://www.nps.gov/planyourvisit/event-details.htm?id=FEE6FAAB-D0F2-037A-FB556667087E0282
- Coordinate evidence: Existing reviewed NPS Arch grounds coordinate reused.
- Location limit: Gateway Arch grounds reference; the event also involved the surrounding park.

### history-stl-flash-flood-2022

- Event: Historic flash flooding sets Lambert rainfall record
- Date: July 26, 2022 (day precision)
- Primary source: https://www.weather.gov/lsx/July262022Flooding
- Coordinate source: https://forecast.weather.gov/MapClick.php?lat=38.6357&lon=-90.2446
- Coordinate evidence: NWS publishes KSTL station latitude 38.75 N and longitude 90.37 W. Kept at the published precision.
- Location limit: Approximate Lambert weather-observation reference for the rainfall record; not the location or boundary of every flooded community.

### history-holocaust-museum-expansion-2022

- Event: Expanded Holocaust Museum reopens
- Date: November 2, 2022 (day precision)
- Primary source: https://stlholocaustmuseum.org/about-us/
- Coordinate source: https://stlholocaustmuseum.org/visit/info/
- Coordinate evidence: Museum directions link supplies map center 38.6849177,-90.4070029. Rounded to a campus-area reference, not used as an exact building coordinate. Official address is 36 Millstone Campus Drive.
- Location limit: Museum campus area reference, approximately located; the original 1995 facility and expanded building are represented by this campus pin.

### history-city-sc-home-debut-2023

- Event: CITY SC plays its first home MLS match
- Date: March 4, 2023 (day precision)
- Primary source: https://www.stlcitysc.com/news/meet-me-in-st-louis
- Coordinate source: https://www.stlcitysc.com/news/meet-me-in-st-louis
- Coordinate evidence: Existing reviewed sports-events.json Energizer Park/CITYPARK coordinate. Official club account identifies the inaugural match at CITYPARK.
- Location limit: Public stadium reference; CITYPARK was renamed Energizer Park later.

### history-stl-tornado-2025

- Event: May 2025 tornado damages Forest Park and St. Louis
- Date: May 16, 2025 (day precision)
- Primary source: https://www.weather.gov/lsx/STLTornado
- Coordinate source: https://www.openstreetmap.org/relation/18497650
- Coordinate evidence: Existing reviewed quieter-parks.json representative point lies inside Forest Park. Forest Park Forever documents tornado damage across the park.
- Location limit: Forest Park reference area for documented tornado damage; not the tornado origin, precise damage spot or entire storm track.
- Supporting source: https://www.forestparkforever.org/tornado-recovery
- Supporting source: https://www.weather.gov/lsx/05_16_2025

### history-powell-taylor-opening-2025

- Event: Renovated Powell Hall and Taylor Music Center dedicated
- Date: September 19, 2025 (day precision)
- Primary source: https://slso.org/250919-press-ribbon-cutting/
- Coordinate source: https://mapcarta.com/32001682
- Coordinate evidence: Published map coordinates identify Powell Hall. Historical identity and event date are independently supported by the event source.
- Location limit: Public Powell Hall reference point; not an entrance or interior-room coordinate.


---

## Independent cross-review

# Independent History atlas cross-review — 2026-11-16

Read-only review of the six agent submissions and current integration. No repository or dataset edits made by this reviewer.

## Snapshot and validation

| File | New records | Rejected by current `validHistoricalEvent` |
|---|---:|---:|
| history-pre1800.json | 27 | 0 |
| history-1800-1859.json | 32 | 0 |
| history-1860-1899.json | 34 | 0 |
| history-1900-1939.json | 36 | 0 |
| history-1940-1979.json | 34 | 0 |
| history-1980-present.json | 36 | 0 |

199 additions; 211 including the original 12. No duplicate IDs across submissions or the original dataset. All submitted geometry is within the supported region. All records pass the current date/URL/category/location-note validator. This is structural validation, not a claim that every historical statement was independently reread.

## Concrete issues reported to root

1. **Supplementary evidence is currently omitted from the detail UI.** `appendHistoricalEvidence` consumes `historicalSources`, while submissions also use `additionalSourceUrl`, `additionalSourceUrls`, and `supportingSourceUrls`. Normalize these at merge or consume all supported fields with URL deduplication. This matters: McIntosh's exact April 28 date is documented by the additional State Archives source, whereas its main NPS source supplies only April. The 2025 tornado's park-specific evidence is also in supplementary links.
2. **Seven category incompatibilities found during integration were resolved in later snapshots.** Three Flags originally used `civic`; the 1940–1979 submission used `civic`/`transport` for six records. All now pass the supported category list. Keep validation against the final merged dataset to catch later changes.
3. **Shared full-map snapshots lose extended history details.** `cleanStop` strips historical dates, categories, location notes and evidence fields; `applyState` opens `s.focus` without recovering a matching historical feature. The compact history place-link path *does* fetch and restore the full record, so normal per-place sharing is covered. A saved/full-map snapshot focused on History could open a less informative card. Optional targeted fix: resolve history focus by stable ID from the local historical dataset after load, guarded against changed focus. This predates much of this atlas expansion and should not block clean compact place links.

## Independent high-risk source checks

### 1800–1859

- **Camp River Dubois (1803–1804): pass.** NPS explicitly says the actual camp cannot be precisely pinpointed after river changes; the record correctly uses the interpreted site and explains its non-exact location. <https://www.nps.gov/places/lewis-clark-state-historic-site-camp-dubois.htm>
- **Lindenwood (1832): pass.** The university's corrected founding-year account supports 1832 rather than the frequently repeated 1827. The commemorative/campus pin is not presented as the exact first classroom. <https://www.lindenwood.edu/about/founding-year/>
- **Francis McIntosh (April 28, 1836): pass with supplementary evidence.** NPS supports the Kiener Plaza area and lack of prosecution. The Missouri State Archives timeline supplies April 28. <https://www.nps.gov/articles/000/free-people-of-color-in-st-louis.htm> and <https://s1.sos.mo.gov/mdh/curriculum/africanamerican/timeline/timeline2>
- **Mary Meachum crossing (May 21, 1855): pass.** NPS supports date, nine freedom seekers and failed crossing with some escaping. Record avoids assigning an invented exact river-crossing line. <https://www.nps.gov/articles/000/resisting-slavery.htm>

### 1860–1899

- **Carondelet ironclads (October 1861): pass.** NPS distinguishes the four boats built at Carondelet from three built at Mound City; its boat entries support the October launches. <https://home.nps.gov/vick/learn/historyculture/city-class-ironclads.htm>
- **Spottswood Rice (fall 1864): pass.** NPS supports the hospital letters, threatened expedition and eventual family reunion. The park pin is expressly representative, not an identified hospital ward. <https://www.nps.gov/articles/000/the-civil-war-and-emancipation-in-st-louis.htm>
- **Battle of Pacific (October 1, 1864): pass.** The public interpretive marker identifies Cabell's entry, railroad destruction and ensuing confrontation; coordinates refer to the marker, not a fabricated battlefield outline. <https://www.hmdb.org/m.asp?m=169299>
- **Missouri emancipation (January 11, 1865): pass for date and convention.** Missouri Archives supports adoption in St. Louis on that date. The City's landmark page supplies the historical 510 Locust address rather than the modern UMSL library. <https://s1.sos.mo.gov/archives/resources/africanamerican/guide/image005c.asp> and <https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/city-landmarks/mercantile-library-collection.cfm>
- **1870 bridge-worker disaster / 1871 St. Charles bridge:** no duplicate or misplaced-water-pin defect found. Both use the documented Oak Grove Cemetery memorial and explicitly identify it as a commemorative point. Construction tragedy and subsequent completion are distinct events.

### 1900–1939

- **1916 residential segregation ordinance: pass.** State Archives supports February 29 and the subsequent 1917 constitutional ruling. City Hall is accurately described as a civic reference point, not a polling place or affected home. <https://www.sos.mo.gov/mdh/curriculum/africanamerican/timeline/timeline4>
- **East St. Louis massacre: date and regional flight supported.** LOC supports the July 2 violence; State Archives supports flight across the river. Eads is explicitly an escape-route reference, not a precise attack site. The agent's additional City evidence URL timed out during this independent check, so its Eads-specific text was not independently reverified here. Do not infer that timeout disproves the account. <https://www.loc.gov/exhibits/civil-rights-act/segregation-era.html>
- **Black Tuesday (November 28, 1939): pass.** Missouri DNR supports the date and shows the obscured City Hall in its photographs. The reference pin does not pretend to delimit the smoke. <https://dnr.mo.gov/air/hows-air/missouri-skies-now-then>
- World’s Fair Flight Cage and Palace of Fine Arts records are separate lasting developments, not duplicate copies of the existing general fair-opening event. Existing Olympics is not duplicated.

### 1940–1979

- **SLU integration (summer 1944): pass.** SLU supplies the April admission decision and first five students in summer 1944. Year precision is appropriately retained rather than inventing a first-class day. <https://www.slu.edu/news/2020/february/slu-legends-lore-heithaus-homily.php>
- **Fairground Park attacks (June 21, 1949): pass.** Washington University's research supports attacks on Black swimmers, wider mob violence and June 22 closure. <https://commonreader.wustl.edu/the-long-reconstruction-of-fairground-park/>
- **Gemini contract (December 7, 1961): pass.** NASA explicitly gives approval and McDonnell contract on that day. Commemorative point is not presented as the contract-signing room. <https://www.nasa.gov/history/60-years-ago-gemini-1-flies-a-successful-uncrewed-test-flight/>
- **Rep first production (July 1, 1966): pass.** The theatre's own history supports both title and exact opening day. <https://repstl.org/rep-history/>
- Times Beach oil contamination and 1982 evacuation are distinct phases, as are Pruitt-Igoe opening and demolition. No duplicate Arch-completion record added.

### 1980–present

- **Kiel Center (October 8, 1994): pass.** Arena's own account explicitly gives that opening date. <https://www.enterprisecenter.com/about-us>
- **Weldon Spring tornado (May 31, 2013): pass, including coordinate.** NWS supplies 38.6867, -90.7498 as surveyed start, EF3 and 32.5-mile path; the record says approximate start and does not imply a public visitor site. <https://www.weather.gov/lsx/05_31_2013>
- **Powell/Taylor dedication (September 19, 2025): pass.** SLSO's dated release says ribbon cut that day and specifies the 64,000-square-foot expansion. <https://slso.org/250919-press-ribbon-cutting/>
- Fox opening/restoration, Union Station opening/reuse, and Powell's original opening/modern expansion are meaningful separate events. Blues entry is the local victory rally, not an inaccurate local pin for the deciding Boston game.

## Integration observations

- New category/era/year/order state is now carried by `currentState`, `applyState` and `cleanNatureState`.
- Range matching uses overlap, preserving period records that span the selected years. Dates displayed come from explicit precision labels, not an artificially precise sort key.
- Cached metadata and commit-on-release year slider avoid rebuilding results for every drag pixel.
- Result pagination limits initial DOM volume; regional history scope avoids accidentally losing records merely because the map is panned.
- Source links are HTTPS-validated and DOM text is assigned safely.
- `historical-events.js` import and JSON fetch now use the atlas asset version.
- No other concrete integration failure found in this read-through. This is code inspection, not a substitute for the root's mobile interaction/normal-reload checks.

## Limits

This independently checked selected high-risk dates, locations and claims across every era; it did not re-open all 199 source pages. The pre-1800 research/evidence file is my earlier contribution, not an independent second-person audit of those records. Root should retain the origin agents' evidence notes and uncertain-location labels. No individual historical site footprint, casualty total or archaeological location was invented during this review.


### Final integration resolution

The cross-review sampled a 211-record checkpoint. Three further modern records (1982 World Series, 1999 papal Mass, 2014 Ferguson demonstrations) bring the final collection to 214. Every supplementary URL is normalized into historicalSources and rendered with duplicate links removed. Full-map/saved historical focus is now rehydrated by stable ID, guarded against a changed selection. The final catalog passes the same structural and short-link tests.
