# Regional weather readings

The map center and zoom must never change to fit cards. Place each station at its published coordinate and adjust the card layout instead.

The southeast card uses Missouri Botanical Garden station MBGM7 (38.6127, -90.2608), replacing the stale Downtown Airport KCPS feed on November 15, 2026. This is an observed garden temperature, not a downtown estimate. Metadata: https://mesonet.agron.iastate.edu/geojson/network/MO_DCP.geojson

Current data: https://mesonet.agron.iastate.edu/json/current.py?network=MO_DCP&station=MBGM7
Documentation: https://mesonet.agron.iastate.edu/json/current.py?help=

Iowa Environmental Mesonet permits CORS. last_ob.utc_valid is observation time; generated_at is NOT observation time. airtemp[F] is Fahrenheit, windspeed[kt] is knots (multiply by 1.150779448 for mph), winddirection[deg] is the direction from which wind blows. Reject observations older than two hours, future times, missing values, mismatched station IDs and out-of-range values. Never convert missing wind into calm. Fetch the garden and Lambert in parallel, with six-second deadlines and five-minute memory caches. Network failures can reuse a still-fresh cached observation only.

Forecast playback derives NWS forecasts from each reading's actual latitude/longitude, so the garden card also uses the garden forecast point. Keep the station label truthful.

Daily maintenance: verify each station's actual observation timestamp, temperature and wind availability. Check MBGM7 alongside KSTL, KSET and KSUS; investigate or replace stale sources without broadening the map or falsely moving measurements.
