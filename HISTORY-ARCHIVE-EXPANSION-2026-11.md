# History archive expansion — November 16, 2026

The reviewed catalog now contains **4,091 distinct records**, up from 214. These are historical milestones, historic-place periods, archival freedom cases, individual theater productions/seasons, local postseason games, documented weather episodes, archaeological evidence and fossil collection/taxon records. They are not all standalone civic events. Each record has source evidence and an explicitly described location reference. All original 214 IDs remain available for shared links.

There are **508 ancient-wildlife records** accessible directly from Wildlife. Fossil occurrences identify evidence at a collection/locality; they do not reconstruct a continuous habitat, abundance, current wildlife range or a guarantee that a place is publicly accessible. Approximate and conflicting locations remain labelled.

## Actual coverage

Topic matches may overlap when one record genuinely concerns multiple subjects. The catalog total counts each record once. No duplicate rows were created for secondary subjects.

| Topic | Records |
| --- | ---: |
| Indigenous history | 70 |
| Settlement & migration | 239 |
| Battles & conflict | 3 |
| Civil rights | 304 |
| Military history | 219 |
| Culture & people | 1,153 |
| Engineering & transport | 358 |
| Disasters | 336 |
| Government | 537 |
| Industry & labor | 219 |
| Education | 245 |
| Science & medicine | 777 |
| Sports | 341 |

| Era | Records overlapping era |
| --- | ---: |
| prehistory | 508 |
| before1800 | 46 |
| 1800-1859 | 425 |
| 1860-1899 | 286 |
| 1900-1939 | 752 |
| 1940-1979 | 1,267 |
| 1980-present | 1,043 |

The requested 214-per-option minimum is not claimed where the available reviewed evidence does not support it. In particular, Indigenous history, regional battles and the early CE/colonial era remain incomplete. Remote battles, invented dates, renamed duplicate buildings, individual specimens and repeated treaty clauses were not used to fill quotas.

## Source families and review decisions

- **Public archives and local histories:** 270 distinct freedom-suit histories, locally documented government and settlement milestones, municipal incorporation/name evidence, and individually checked treaty texts. Archival filing terms are not invented exact filing days. The Old Courthouse is a labelled archive/reference pin where the original courtroom cannot be located precisely. Treaty pins indicate a documented signing area, never an invented building or land-cession boundary.
- **Science and education:** official institutional histories and university-library archives. Campus/building dates distinguish construction, dedication and institutional moves. Sixty-eight Washington University building references were resolved to points inside official campus GIS footprints; unmatched/demolished locations retain honest campus-reference labels. The Firmin Desloge source-date conflict remains explicit.
- **Culture and sport:** St. Louis Public Library's Muny programs catalog, Repertory Theatre production archive, MLB and NHL historical game records. A production-season is one record, not one card for each performance. A duplicated Butterfly spelling and two double bills were merged. Postponed baseball games, away games and the 2020 Edmonton hockey bubble were excluded.
- **Engineering and industry:** 289 deduplicated named historic bridge crossings from the official 2025 National Bridge Inventory, additional individually sourced landmarks, and 97 industry milestones from 36 readable official National Register nominations. Three construction/opening phase pairs and three duplicate bridge crossings were merged. Seven truncated nomination downloads were excluded. Inventory construction years are not invented ceremonial opening dates or current-condition ratings.
- **Historic places:** Missouri SHPO site/district geometries and documented periods of significance, reconciled against the NPS National Register inventory. Four overlapping place records enrich existing milestones instead of adding duplicate cards. Boundary-increase entries were excluded. The reconciliation corrects demonstrated subject errors, including residential districts incorrectly flagged as communications. Disjoint historic periods retain their gaps. National Register listing dates were never substituted for construction dates. Restricted archaeological sites were excluded.
- **Severe weather:** NOAA regional Storm Events records grouped into documented episodes, plus individually sourced fire/aviation disasters. Multiple reports of one storm are not counted as unrelated disasters. County-reference pins and limited report-level casualty totals remain explicit.
- **Military:** official NPS local unit histories and the 2024 Scott AFB History Office chronology. Scott records describe distinct local milestones but share an explicitly broad installation reference. Remote combat, remote disaster response and unrelated ceremony/award lists were not relocated to St. Louis. Official-source contradictions are retained at honest precision.
- **Deep time:** published regional archaeological evidence and scientifically referenced Paleobiology Database collections. Original age ranges and taxonomic uncertainty remain visible. Known misgeocoded and insufficiently located records are excluded even when their numeric coordinates fall inside the query bounds. Modern collection geography, rather than reconstructed paleocoordinates, is used. PBDB's current API identifies its data as CC0; provider and publication references are retained for traceability.

Every source was not individually revisited through a separate web page: official structured catalogs, archives and documented APIs provide many records. Verification dates refer to the evidence actually read. Failed sources do not produce invented records. This is a one-time requested expansion, not a complete historical inventory or a new recurring research task.

## Interface and performance

Topic/era choices expose actual counts. Search, chronology, era filters and the two-handle range work across the larger catalog. Numeric prehistoric ranges preserve the source's human age label and never masquerade as exact calendar dates. Deep-time handles use a logarithmic position scale; modern eras use ordinary exact-year controls. The combined all-era view asks for an era before displaying a range, avoiding compressing modern history into a geological slider.

Wildlife has a direct **Fossils & ancient wildlife** entry, with a source-derived Life group selector and **Living wildlife** / **All history** return paths. Ancient-life state and signed year ranges survive saved/shared maps. The map stays usable beside the panel. Historical shared details resolve against the full catalog.

The catalog loads lazily once, with a shared request. Initial metadata preparation yields every 250 records for large catalogs. Immutable properties/geometry caches survive map feature clones. Search tokenization is reused. Result lists and map cluster details initially render 80 entries and append more on demand; opening a thousand-record cluster does not create a thousand cards immediately. Source data is static and adds no periodic fetch.

Relevant validation covers the complete catalog's identifiers, coordinates, sources, date precision, overlapping/disjoint ranges, category/era counts, chronological sorting, signed saved state, old and new shared links, cached loading and cancelled range gestures. Browser checks cover phone-width controls, latest-first ordering, direct cluster browsing and 80-to-160 paging. CPU timings are workspace checks, not claims about a particular phone's frame rate.

## Maintenance

This catalog remains outside the routine daily refresh. Revisit it for a concrete correction, credible upstream revision, broken reference or specifically requested expansion. Do not add a daily/weekly/monthly static source audit.

`scripts/import-history-register.py` is an explicit manual importer, not part of `refresh-andymap.py`. It requires downloaded regional SHPO site and district FeatureCollections, an actual check date, and the reviewed `history-register-reconciliation.json`. The source services are `https://gis.dnr.mo.gov/host/rest/services/cultural/national_register_sites/MapServer/0` and `https://gis.dnr.mo.gov/host/rest/services/cultural/national_register_districts/MapServer/1`; the reviewed envelope is longitude -91.2 to -89.4, latitude 38.1 to 39.2. The final catalog additionally merges four overlapping SHPO contexts into their original milestone IDs. A fresh import is a candidate requiring review, not automatic permission to replace the published collection.
