# Metro observation cards

The four primary slots are KSET (St. Charles), KSTL (Lambert), KSUS (Chesterfield), and MBGM7 (Botanical Garden). `metro-weather.js` reads current IEM observations for all four and NWS observations for the three airport stations. Backend observations remain usable candidates; the cards can recover directly if that backend fails.

A confirmed November 16 failure was a null KSTL temperature in NWS JSON despite the same timestamped METAR providing 36°F through IEM. Prefer a complete, valid same-station report; among equally complete reports prefer the newest. Never turn missing wind into calm or use forecast temperatures as observations.

If a primary has no usable complete report, try an unused current nearby station within 40 miles (KALN or KBLV are reserve stations). Show the replacement station’s actual name, coordinates and measurement time, with “Nearby” beside the timestamp. Do not relabel a reserve as Lambert or move its geographic anchor. Card slots and default map view stay fixed.

Each direct request has a six-second timeout; mirror requests run in parallel. Successful responses are cached for two minutes. The frontend polls periodically and on return to the page, but polling does not imply a new measurement every poll. Routine METARs may be hourly; KSET/KSUS also publish intermediate reports. IEM’s one-minute ASOS archive is delayed 18–36 hours or more, so it is not a live replacement: https://mesonet.agron.iastate.edu/ASOS/

Keep successful measurements through transient outages only until their original observation timestamp reaches two hours. Fetching again must not renew that timestamp. Missing, expired and future-dated observations remain unavailable. Reserve station requests happen only when a primary is incomplete; avoid unnecessary source traffic.

For changing-data maintenance, check current observation timestamps, usable temperature/wind and feed failures. Investigate reported missing or stale values. Do not routinely re-research station names, coordinates or this methodology. Run `node scripts/metro-weather-test.mjs` after changing this adapter, not as an unrelated daily audit.
