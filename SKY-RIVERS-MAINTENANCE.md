# Sky and river maintenance

Run with the daily Andymap refresh at 6 AM America/Chicago:

```sh
python scripts/river-refresh.py
python scripts/sky-lights-refresh.py
```

The river script requires only the Python standard library. The sky script requires Pillow. Both write small static JSON assets, so every phone does not have to download years of measurements or satellite tiles. Neither script changes the current map position.

## Rivers

- `river-stations.json` supplies USGS proper names and drainage areas for 75 gauges across the combined region.
- `river-baselines.json` contains each gauge’s own 30-day mean. The initial refresh achieved 71/75 valid baselines, versus 13 with the daily-statistics endpoint alone.
- Use gauge-height parameter `00065` in **feet**, never discharge or another gauge’s datum. Retain negative gauge heights; gauge zero is an arbitrary local datum.
- Deduplicate observation timestamps; average observations within each populated UTC hour, then hours within each St. Louis calendar day. A usable day has at least 18 populated hours; a usable baseline needs at least 20 complete days within the preceding 30-day window. Give every usable day equal weight. Drop missing/invalid/ice/equipment/seasonal markers.
- Current measurements are provisional. The comparison is against a recent baseline, **not seasonal normal, water depth, a flood forecast or a personal risk score**.
- A snapshot expires after three days. Missing comparisons are omitted, with those gauges after comparable gauges. All 75 working current gauges remain useful.
- Sort absolute deviation from each gauge’s mean, then major named rivers, drainage basin area (size proxy), then distance. Never compare the absolute heights of different datums.
- The modern USGS continuous API is implemented as fallback and becomes primary on January 1, 2027, ahead of the documented February 22 WaterServices retirement. Follow the modern endpoint’s pagination; never silently truncate.
- If fewer than 70% of stations refresh, fail without overwriting the previous file. The deployment runner must report this failure.

Sources: https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous and https://waterdata.usgs.gov/iv-data-availability-statement/ and https://waterservices.usgs.gov/.

## Sky

- `sky-lights.json` is derived from the **most recent** available NASA VIIRS NOAA-21/NOAA-20/SNPP gap-filled BRDF-corrected nighttime-radiance layer. The initial usable product date is **November 14, 2026**. It does not reuse the old 2016 Black Marble picture as current light pollution.
- Read NASA’s WMTS capabilities for product/default date; decode the image using NASA’s published colormap. The output is a **quantized/capped radiance proxy**, not unprocessed science data or a measurement of sky brightness at eye level. In particular, the saturated white 38.2+ bin must use its lower bound, not its enormous open-ended midpoint.
- Average a 5×5 pixel neighborhood for each 0.05-degree grid location; require at least 18 recognized nontransparent pixels. Blank data must remain missing. Do not fill it with a dark value. The initial 792 regional cells all have usable data.
- Reject products older than 45 days. Snapshot expiry is 45 days from the product date, and every point lookup also checks the data time. Gap-filled pixels may come from earlier clear nights even though the product carries a newer date.
- The live map uses nine NWS forecast sample areas, each subdivided spatially to show the finer night-light pattern. It **does not** claim 81 independent weather observations. Each square’s popup explicitly says nearby cells share the NWS sample.
- The transparent Andymap faint-star viewing index is: `100 × (1 − cloud_fraction)^1.5 × (0.5 + 0.5/(1 + ln(1 + radiance_proxy)/2)) × (1 − 0.35 × moon_illumination × max(0,sin(moon_altitude))) × clamp((-sun_altitude − 6)/12,0,1)`. The chosen weights are a ranking heuristic, **not calibrated probability, Bortle score or seeing/transparency forecast**. The formula cannot award a detection percentage for Neptune or other targets.
- Sun and Moon positions use bundled SunCalc 1.9.0 with its BSD license preserved. Moon effects are calculated separately for every selected hour and location. The UI identifies naked-eye/optical-aid planets and horizon limitations rather than showing unsupported visibility percentages.
- Site listings in `sky-sites.json` distinguish public nighttime access from scheduled-program venues. Broemmelsiek astronomy area and Stacy Park’s designated field have verified general nighttime permission. McDonnell Planetarium (City) and Babler (County) are clearly program/camping access only; do not imply an event tonight or blanket night access.
- Check these four official access pages and temporary closure notices daily. Refresh the source check time only after actually checking. Check programs for real future dates before adding events. Never infer public access from a favorable-colored map square.

NASA sources: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml ; https://gibs.earthdata.nasa.gov/colormaps/v1.3/VIIRS_DayNightBand_At_Sensor_Radiance.xml ; https://viirsland.gsfc.nasa.gov/Products/NASA/BlackMarble.html .

Site sources: https://www.sccmo.org/2051/Educational-Sites-and-Outreach ; https://www.olivetteparksandrec.com/sky-viewing.html ; https://www.slsc.org/event-overview/public-telescope-viewing/ ; https://mostateparks.com/park/dr-edmund-babler-memorial-state-park .
