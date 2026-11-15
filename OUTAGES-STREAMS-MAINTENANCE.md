# Water notices and Streams maintenance

## Refresh

Run `python scripts/outages-refresh.py` from the checkout. Python 3.9+ standard library only. Run `node scripts/outages-check.mjs` to validate the result.

The refresh reads American Water's **public Customer Advisory Map** service, the **City of St. Louis Water Division current outages table**, and **Spire's public gas outage page**. These are separate providers merged into one regional view, never separate City/County tabs. The geographic query includes both jurisdictions and nearby communities.

Refresh City/Spire snapshots hourly (prefer every 15 minutes). The frontend refreshes American Water polygons directly, with a five-minute in-memory cache and a bundled snapshot when the provider cannot be reached. The public ArcGIS endpoint was verified to return an `Access-Control-Allow-Origin` header for `https://www.andrewhanes.com` on November 15, 2026. Never depend on a secret key, customer login, or unverified inferred outage footprint.

Each displayed item retains its source URL, observed time, checked time and expiry. An evidence check never resets an old source observation. Snapshot data expires after six hours or the provider's expiration, whichever comes first. Completed, lifted, cancelled and expired advisories are excluded. Planned works have separate wording and purple styling. **An estimate passing is not proof that service was restored.** City rows still listed after their estimated restoration time say so explicitly. City street notices without an affected-area polygon remain list-only; do not shade a whole city or guess affected properties.

The script exits nonzero when a source fails or Spire's published no-current-outage statement changes, while retaining only unexpired prior records. Investigate changed Spire notices and add the provider's actual description and published affected area before mapping them. Inspect the health report in `outages-expanded.json`; never silently reinterpret a failed request as zero outages.

## Sources and provenance

- American Water public viewer: https://awgis.amwater.com/CustomerAdvisoryMap/
- Viewer configuration: https://awgis.amwater.com/CustomerAdvisoryMap/config.json
- Web map item: `3791d39fd2384eb7947769093b9dc53b`, portal `https://aw.maps.arcgis.com`
- Public service referenced by that web map: https://utility.arcgis.com/usrsvcs/servers/482bbe2135c54d178ec406189303faf4/rest/services/CustomerAdvisoryMap/DisplayData_SDE/MapServer
- Layer 17 = emergency active advisories; layer 16 = general active advisories. Layer 15 (lifted) is intentionally omitted. Only factual fields and original summaries are retained; no customer information or source article prose is copied.
- City water: https://www.stlwater.com/outages/ — current outage table only, not the historical maintenance table.
- Gas status: https://www.spireenergy.com/outages — a timestamped provider statement, not independent proof that every customer's service works.

ISP outage maps are **not included**. Spectrum's published checker and AT&T's outage page require account/address verification. No public local incident feed was verified. Do not put fake Internet outages or a nonfunctional ISP toggle in the UI. A provider help link is not a mapped outage feature.

## Streams repair

`terrain-streams.js` replaces the slow 3DHP dynamic image export with USGS's cached hydrography overlay:

`https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}`

USGS documents the cached layer as quicker and more reliable for display: https://www.usgs.gov/national-hydrography/access-national-hydrography-products

This is a **reference map**, not observed stream flow or flooding. It includes river, stream, canal, lake and pond cartography at appropriate zooms. Native cache reaches zoom 17; retain the user's map center and zoom when enabling it. Smaller streams become visible as the user zooms. Browser tile caching and small 256px tiles avoid regenerating a whole map image on each pan. No nightly geographic download is required; check one regional tile at multiple zooms during daily health checks.

## Integration

- For terrain mode `streams`, return `terrainStreams()` instead of requesting the old backend image.
- Render its `tileUrl` with `createStreamsLayer(L, opacity)` (or equivalent settings), before the generic terrain image-overlay branch.
- Apply `enrichOutages(result)` to the electricity result, including a failed electricity fallback with `features:[]`. This first-paint path reads only the bundled snapshot and a completed in-memory live response; it never waits for an external water request.
- After committing the initial result, call `refreshOutageWater(latestResult)` in the background and commit its returned new result only if the selected layer/request is still current. Concurrent calls share a five-minute cache and the same in-flight query pair. An unsuccessful provider refresh preserves unexpired evidence; a successful empty response removes that provider's old notices.
- Use `appendUtilityStatus(host,result)` instead of the old links-only provider section.
- Preserve individual expiry filtering during redraws. Do not apply the electricity response's old global expiry to merged water notices.
