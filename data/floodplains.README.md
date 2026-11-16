# Floodplain overview reference

`floodplains.bin` is gzip-compressed GeoJSON, deliberately stored with a neutral extension so GitHub Pages does not accidentally add a second content encoding. `floodplains.js` decompresses it after selection and caches it in memory. This is a static reference, not a daily-refresh or live-flood feed.

Source: FEMA, via Esri's USA Flood Hazard Areas feature service, item `ccd29fb4bd5e4b44a2d61638829a5d7e`. Its documented source date is March 3, 2026; retrieved November 16, 2026. Service:
https://services5.arcgis.com/7weheFjxuNkGGiZi/arcgis/rest/services/USA_Flood_Hazard_Areas_view/FeatureServer/0

Extraction covered the app bounds `[-91.2,38.1,-89.4,39.2]`, queried intersecting polygons with `SFHA_TF = 'T' OR ZONE_SUBTY LIKE '%0.2%' OR ZONE_SUBTY LIKE '%LEVEE%'`. Paginated 2,000 records ordered by OBJECTID; 24,658 distinct IDs matched the ID-only query. All source pieces were processed; zero-area fragments created by clipping/rounding are not rendered. Geometries were clipped to app bounds, simplified per polygon with topology preservation at 0.0008 degrees (roughly 90 metres), rounded to five decimals, repaired for resulting ring topology, and grouped by the supplied Esri/FEMA symbology. Minimal-hazard/unknown/nonparticipating areas are not depicted; blank areas do not prove absence of risk.

Classes: 15,095 moderate-hazard pieces, 8,692 high-hazard pieces, 512 regulatory floodway pieces, 356 levee-related pieces, 3 special floodway pieces. The GeoJSON includes this provenance and source counts. Use official FEMA mapping for detail/property decisions. Source attribution and overview limitations appear in the map key and credits.

This replacement repairs the old raster's zoom-14 restriction and the currently failing direct FEMA export service. Revisit only for a relevant source-release signal, correction or confirmed failure; do not add it to routine changing-data checks. Run `node scripts/floodplains-test.mjs` after changes.
