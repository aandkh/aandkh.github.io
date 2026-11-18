# Air-quality grades

Reviewed November 15, 2026. Implementation: `air-grades.js`, scoped styling: `air-grades.css`; `layer-insights.js` re-exports the existing app interface. No extra network requests. The visible card is intentionally compact.

The pollutant-only ladder below supplies the background grade. Inside a modeled landfill footprint the displayed Open The Windows Score also accounts for local nuisance potential. Its Estimated label, fill colors, fallbacks and source attribution are described in [Local air measurements](LOCAL-AIR-MEASUREMENTS.md#landfill-estimates-in-the-air-quality-fill). The EPA reading and its health guidance retain their source values.

## Pollutant display contract

The live `/api/layers/air` feed supplies EPA AirNow regional **category contours**, not a numeric AQI or a PM2.5 concentration. Preserve its original six categories, colors, observation time, preliminary-data status and source attribution. A shaded area is interpolated between monitors, not measured at every address. Missing pollutant data is unknown. A location can still have a labeled landfill-only estimate.

The 17 grades are **Andymap display subdivisions**, not EPA health categories or validated personal health scores. Lower AQI means a better tier for the same pollutant and time basis. Subtiers within an official category share its health guidance. Never claim that S+ means zero pollution, uniquely “best possible air,” or no health risk.

| Grade, worst → best | Supplied U.S. AQI | Official category |
|---|---:|---|
| HELL | 301+ | Hazardous |
| F- | 251–300 | Very Unhealthy |
| F | 201–250 | Very Unhealthy |
| D- | 176–200 | Unhealthy |
| D | 151–175 | Unhealthy |
| D+ | 131–150 | Unhealthy for Sensitive Groups |
| C- | 116–130 | Unhealthy for Sensitive Groups |
| C | 101–115 | Unhealthy for Sensitive Groups |
| C+ | 91–100 | Moderate |
| B- | 81–90 | Moderate |
| B | 71–80 | Moderate |
| B+ | 61–70 | Moderate |
| A- | 51–60 | Moderate |
| A | 31–50 | Good |
| A+ | 16–30 | Good |
| S | 6–15 | Good |
| S+ | 0–5 | Good |

For a category-only record, display **one estimated grade**, explicitly labeled **Estimated** beside the badge. Per Andrew's November 15 instruction, take the midpoint of the reported integer AQI interval, round down when it lies between two integers, and map that representative value to the existing grade ladder. The displayed numeric reading remains the source's original category range; never present this representative midpoint as an observed AQI. Good → A+, Moderate → B, Unhealthy for Sensitive Groups → C-, Unhealthy → D, Very Unhealthy → F, Hazardous → HELL (all values in this open-ended category have that grade). This is a display estimate, not evidence of the actual subgrade. Label the grade Estimated; do not add a methodology paragraph. Never show a range such as A–S+ or a list of current grades.

A supplied finite nonnegative numeric `properties.aqi` takes precedence and yields one unqualified custom grade, rounded to the reported integer AQI scale; numeric zero is valid and maps to S+. Values above 500 retain Hazardous guidance and are explicitly marked beyond the AQI scale. Do not substitute a polygon identifier or a modeled value from another location/time for a measured local AQI. If the source contains no usable category or numeric AQI, or the supplied fields conflict, the result remains Unknown: the midpoint fallback requires a known source category and cannot reconcile contradictory observations.

`airAdvice(properties)` returns the display grade, precision (`value`, `band`, `unknown`), official category, selected pollutant, and activity/window guidance. `appendAirAdvice(host, properties)` renders it. Pollutant identity comes from explicit `pollutant`/`parameter`, otherwise the current feed's title/id. PM2.5 and ozone are separate assessments. The score does not measure indoor conditions, other pollutants, pollen, local exhaust, temperature or humidity; no grade guarantees safe ventilation or health. Keep the cool-indoor-space caveat when advising closed windows during pollution.

Category input accepts integer numbers 1–6 or strings containing one of those digits (surrounding whitespace allowed). Booleans, arrays and object coercion are rejected.

## Compact presentation

Andrew removed the grade guide and the cigarettes/Burning Man/everyday-exposure explanations on November 15. The air card shows one grade, an adjacent **Estimated** qualifier for a category fallback, monitor interpolation, or modeled local adjustment, the supplied air reading, the official EPA category, a short window recommendation and compact provider credit/timestamp. No expandable grade list, exposure comparison, methodology explanation or redundant reference menus. Preserve the internal 17-grade boundaries without rendering them as a public guide. The unsupported exposure-comparison helper has been removed.

Official source references remain in the site's central credits. Do not add the removed explanations back during maintenance.

Daily source checks should verify City **and** County remain covered by the same layer, observation times advance, pollutant modes are not mixed, and fields have not changed. Updating a fetched timestamp must never relabel an old observation as current. Guidance/threshold changes require source review; the custom 17-tier boundaries should not drift automatically.

Run `node scripts/air-grades-test.mjs` after changes to this component. It checks the 17-grade boundaries, single category estimates, exact-reading precedence, unknown/conflicting records, compact rendering, and provider attribution. Do not run static checks merely because the daily data task is running.
