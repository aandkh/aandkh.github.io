# Crimes & Crashes maintenance

The incident archive is `recent-incidents.json`, checked daily at 6am America/Chicago by the existing Andymap automation. `recent-incidents.js` filters the archive; never delete a record merely because it is older than seven days. Initial archive assembled November 15, 2026, with selected earlier reports. It is not a full historic backfill.

- Merge stable IDs; deduplicate follow-up stories about the same occurrence. Preserve corrections, links and per-record sourceCheckedAt. A failed fetch is not a deletion.
- incidentAt is the occurrence time, not publication time. State approximate time or encounter-start time in the description. Use correct local offset, including DST.
- jurisdiction city means independent St. Louis City; county means St. Louis County. Postal address "St. Louis" and responding department do not determine jurisdiction.
- incidentKind supports shooting, crash, assault, robbery, burglary, theft and other documented categories. deaths/injuries must be numeric only when explicitly supported; unknown is omitted, never silently zero.
- Geocode reported blocks/intersections. If only a neighborhood, municipality or road segment is known, use a representative point for that named area and label locationAccuracy accordingly. Do not falsely imply exact scene coordinates or use a person's residence as a scene. Record geocoding evidence. Initial county blocks were located with US Census Public_AR_Current address geocoder; Wallington Walk matches Wallington Ct in Census.
- Keep concise attributed factual summaries and avoid unnecessary names or victim details. Preliminary reports are not findings of guilt.

Required separate source checks:
1. City: https://slmpd.org/crime-and-investigations/, https://slmpd.org/daily-accident-report/, https://slmpd.org/mapping/
2. County: https://stlouiscountypolice.com/department-news/press-releases/ and https://stlouiscountypolice.com/st-louis-county-crime-map/
3. Municipal departments: independent agencies in County, including west, south and north County. The County map includes participating municipalities, not necessarily all municipalities.
4. Highway crashes: https://www.mshp.dps.missouri.gov/HP68/search.jsp (Troop C). Its online reports omit crashes investigated by city/county agencies. Check MoDOT incidents and local police crash reports separately.
5. Adjacent regions: retain separate jurisdictions if expanding beyond City/County; never misclassify Metro East or St. Charles County as St. Louis County.

As of November 15, County primary releases were accessible through indexed official text; the main pages expose limited content to text retrieval. The MSHP search presents a validation screen. The linked CrimeMapping services have not been bulk imported. Do not describe those as complete integrated feeds. Review alternate lawful official access; no bypass of access controls.

UI statistics describe only selected archived reports, with unknown death counts explicitly counted. No "safest neighborhood" ranking, regional total or risk comparison can be inferred from this selected sample. Filters must affect both map pins and list; archive list covers selected jurisdictions even when pins are outside the viewport. Do not auto-zoom the default map to fit incidents or weather cards.
