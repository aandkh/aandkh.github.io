# Metro observation cards

The four primary stations surround the fixed metro view: KSTL (Lambert, north), KSUS (Chesterfield, west), MBGM7 (Botanical Garden, east), and C7014 (Arnold, south). `metro-weather.js` reads current IEM and NWS airport observations, IEM Botanical Garden observations, and NWS-distributed CWOP observations for Arnold. Their actual coordinates remain attached to each reading; neither the map zoom nor station coordinates are changed to make a symmetrical layout. Backend observations remain usable candidates; the cards can recover directly if that backend fails.

A confirmed November 16 failure was a null KSTL temperature in NWS JSON despite the same timestamped METAR providing 36°F through IEM. Prefer a complete, valid same-station report; among equally complete reports prefer the newest. Never turn missing wind into calm or use forecast temperatures as observations.

If a primary has no usable complete report, try an unused current nearby station within 40 miles (E1948 near Mehlville, KSET, KALN and KBLV are reserve stations). Show the replacement station’s actual name, coordinates and measurement time, with “Nearby” beside the timestamp. Do not relabel a reserve as Lambert or move its geographic anchor. Card slots and default map view stay fixed.

Each direct request has a six-second timeout; mirror requests run in parallel. Successful responses are cached for two minutes. The frontend polls periodically and on return to the page, but polling does not imply a new measurement every poll. Routine METARs may be hourly; KSUS also publishes intermediate reports. IEM’s one-minute ASOS archive is delayed 18–36 hours or more, so it is not a live replacement: https://mesonet.agron.iastate.edu/ASOS/

Keep successful measurements through transient outages only until their original observation timestamp reaches two hours. Fetching again must not renew that timestamp. Missing, expired and future-dated observations remain unavailable. Reserve station requests happen only when a primary is incomplete; avoid unnecessary source traffic.

For changing-data maintenance, check current observation timestamps, usable temperature/wind and feed failures. Investigate reported missing or stale values. Do not routinely re-research station names, coordinates or this methodology. Run `node scripts/metro-weather-test.mjs` after changing this adapter, not as an unrelated daily audit.

## November 16 station-layout correction

NWS station metadata verifies C7014 at 38.445, -90.414 (CW7014 Arnold) and E1948 at 38.47667, -90.3555 (EW1948 St. Louis, near Mehlville). Six consecutive observations checked for each contained usable temperature and wind. Arnold reported 1.67°C and genuine calm at 15:10Z; its earlier readings were 15:05, 14:55, 14:50, 14:45 and 14:40Z. E1948 reported 4.44°C, 3.204 km/h at 15:00Z, with complete ten-minute reports back through 14:10Z. They are citizen observations distributed by NWS, not airport observations. Do not promise uninterrupted updates.

Sources: https://api.weather.gov/stations/C7014 and https://api.weather.gov/stations/E1948 ; append `/observations?limit=6` for recent measurement history. Precise Lambert and Chesterfield coordinates use https://mesonet.agron.iastate.edu/geojson/network/MO_ASOS.geojson .

Rejected alternatives: KCPS remained stale at November 13 16:53Z in IEM; Arnold/Fenton/Jefferson Barracks river stations had no temperature or wind, and southern MoDOT RWIS stations were inactive. Do not re-enable these merely because their station metadata exists.

## November 17 missing latest-response values

C7014 `/observations/latest` returned null temperature/wind at 11:50Z while
`/observations?limit=6` supplied valid -1.11°C and calm for that same timestamp.
After both existing mirrors finish, incomplete stations now try that bounded
same-station collection before nearby substitutes. Original observation times
and the two-hour expiration still apply; complete mirrors need no extra request.
