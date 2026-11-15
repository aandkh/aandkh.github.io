# Air-quality grades

Reviewed November 15, 2026. Implementation: `air-grades.js`, scoped styling: `air-grades.css`; `layer-insights.js` re-exports the existing app interface. No extra network requests. The full grade guide is created only when opened.

## Display contract

The live `/api/layers/air` feed supplies EPA AirNow regional **category contours**, not a numeric AQI or a PM2.5 concentration. Preserve its original six categories, colors, observation time, preliminary-data status and source attribution. A shaded area is interpolated between monitors, not measured at every address. Unshaded/missing is unknown.

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

For a category-only record, display its **possible grade range**, never a guessed midpoint: Good = A–S+, Moderate = C+–A-, Unhealthy for Sensitive Groups = D+–C, Unhealthy = D-–D, Very Unhealthy = F-–F, Hazardous = HELL. A single subgrade requires a finite nonnegative numeric `properties.aqi`; values are rounded to the reported integer AQI scale. Values above 500 retain Hazardous guidance and are explicitly marked beyond the AQI scale. Do not substitute a polygon identifier, its lower category boundary, or a modeled value from another location/time for a measured local AQI. If a numeric AQI conflicts with the supplied category, the result is Unknown and no window recommendation is issued.

`airAdvice(properties)` returns the display grade, precision (`value`, `band`, `unknown`), official category, selected pollutant, explanation, and activity/window guidance. `appendAirAdvice(host, properties)` renders it. Pollutant identity comes from explicit `pollutant`/`parameter`, otherwise the current feed's title/id. PM2.5 and ozone are separate assessments. The score does not measure indoor conditions, other pollutants, pollen, local exhaust, temperature or humidity; no grade guarantees safe ventilation or health. Keep the cool-indoor-space caveat when advising closed windows during pollution.

Category input accepts integer numbers 1–6 or strings containing one of those digits (surrounding whitespace allowed). Booleans, arrays and object coercion are rejected. The optional comparison clock must be a finite epoch-millisecond number. Positive comparison values below 0.1 display as `<0.1`, never as a rounded zero.

## Comparisons

The 2015 Berkeley Earth cigarette comparison is a rough **population-health communication benchmark**: 22 µg/m³ PM2.5 over a full day is described as about one cigarette-equivalent. It is not chemical equivalence, personal inhaled dose, or a forecast of harm from a particular day. Do not derive a local number from an AQI category, an instantaneous value, a NowCast, ozone, or a model forecast. Do not add time-scaling for a personal outing without new scientific review.

The current contour feed cannot support a local equivalent, so the UI explains the benchmark and explicitly withholds the calculation. The optional `pm25Comparison(properties, now)` contract permits one only when the selected pollutant is PM2.5 and the source supplies all of:

```js
properties.pm25DailyMean = {
  value: 22,                         // finite, nonnegative, original concentration
  unit: 'µg/m³',                     // or 'ug/m3'
  measurementType: 'measured',       // never modeled or NowCast
  periodStart: '2026-11-14T18:00:00Z',
  periodEnd: '2026-11-15T18:00:00Z',  // exactly 24 hours; not future; ≤48 h old
  sourceUrl: 'https://official-source.example/measurement'
};
```

This metadata must come from an actual official measured daily mean with retained station/location provenance; the object above is a schema example, not a data source. The helper validates duration, freshness, units and source URL. A future importer must also verify the measurement applies to the displayed location and cannot relabel a nearby monitor as an address measurement. The output describes a full-day concentration scenario, not the viewer's actual exposure.

Burning Man has changing playa-dust conditions, not a universal reference AQI. The UI links its organizer's description and does not invent “days at Burning Man” equivalences. Everyday examples compare duration and effort qualitatively; they do not calculate a personal dose or imply all pollutant mixtures are interchangeable.

## Primary references to recheck

- [EPA AirNow categories](https://www.airnow.gov/aqi/aqi-basics/) and [NowCast versus daily AQI](https://www.airnow.gov/aqi/aqi-basics/using-air-quality-index/).
- [EPA technical AQI document](https://document.airnow.gov/technical-assistance-document-for-the-reporting-of-daily-air-quailty.pdf), including values above 500.
- [AirNow particle-pollution activity guide](https://document.airnow.gov/air-quality-guide-for-particle-pollution.pdf) and [ozone guide](https://document.airnow.gov/air-quality-guide-for-ozone.pdf).
- [EPA ventilation guidance](https://www.epa.gov/indoor-air-quality-iaq/improving-indoor-air-quality), [smoke/heat advice](https://www.epa.gov/wildfires/frequent-questions-about-wildland-fire-smoke-individuals), and [particle versus gas filtration](https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home).
- [Berkeley Earth comparison, original research memo](https://berkeleyearth.org/air-pollution-and-cigarette-equivalence/).
- [Burning Man Project's playa-weather guidance](https://burningman.org/black-rock-city/preparation/playa-living/weather/).
- [AirNow data-use guidelines](https://docs.airnowapi.org/docs/DataUseGuidelines.pdf): retain EPA/reporting-agency credit, official category colors and preliminary-data labels.

Daily source checks should verify City **and** County remain covered by the same layer, observation times advance, pollutant modes are not mixed, and fields have not changed. Updating a fetched timestamp must never relabel an old observation as current. Guidance/threshold changes require source review; the custom 17-tier boundaries should not drift automatically.

Run `node scripts/air-grades-test.mjs`. It checks every integer AQI through 500, boundaries and order, honest category-only ranges, inconsistent/missing fields, pollutant-specific guidance, rejection of unsupported comparison data, attribution, and collapsed/lazy guide rendering. Regression checks: `node scripts/cycling-test.mjs` and `node scripts/weather-insights-test.mjs`.
