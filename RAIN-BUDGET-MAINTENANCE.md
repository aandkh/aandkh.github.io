# Rain budget

Integration: import `appendRainBudget` from `rain-budget.js`, load the scoped
`rain-budget.css`, and call `appendRainBudget(host, {lat, lng})` in Forecast.
It returns its section immediately and fills it asynchronously. It accepts an
optional `now` (Date, ISO timestamp or epoch milliseconds) and `snapshot` for
reproducible tests. `now` means the actual analysis time, **not a selected future
forecast hour**. `rainBudgetData(snapshot, {now})` and `rainClimateDay(now)` are
pure exports. Map coordinates only supply distance to the regional gauge; they
do not turn an airport measurement into a neighborhood estimate.

## Refresh

Run once daily after NWS publishes yesterday's climate report, as part of the
existing 6 AM America/Chicago maintenance:

```sh
python scripts/rain-budget-refresh.py
node scripts/rain-budget-test.mjs
python scripts/rain-budget-refresh-test.py
```

Python 3.9+ standard library; no keys or installed packages. One request per
calendar year needed for the last 120 days (at most two), then one original NWS
report to verify normal period and units. `--output PATH` supports staging. A
failed or substantially incomplete refresh exits nonzero and preserves the old
file **without** extending its expiry. Commit/publish `rain-budget.json` with
the daily data updates. No browser requests go to the historical data provider.
The tiny local JSON is request-deduplicated and cached in memory for 15 minutes;
HTTP validation is requested on a new load. Checked snapshots expire after 48
hours. Expired cards suppress current numeric readouts and retain source/date.

## Sources and definitions

- NWS daily climate reports, archived by Iowa State IEM:
  https://mesonet.agron.iastate.edu/json/cli.py?help
  https://mesonet.agron.iastate.edu/json/cli.py?station=KSTL&year=2026
- Station metadata (KSTL → USW00013994, Lambert):
  https://mesonet.agron.iastate.edu/geojson/network/NWSCLI.geojson
- Original daily report, dated and linked in each snapshot:
  https://mesonet.agron.iastate.edu/api/1/nwstext/202611150830-KLSX-CDUS43-CLISTL
- NWS regional 1991–2020 normal reference:
  https://www.weather.gov/lsx/regionalclimatesummary
- Official description of preliminary climate reports:
  https://www.weather.gov/wrh/climate?tab=cliplot&wfo=lsx
- IEM describes the station climate-day convention and trace sentinel:
  https://mesonet.agron.iastate.edu/cgi-bin/request/daily.py?help
  https://mesonet.agron.iastate.edu/request/daily.phtml?network=NWSCLI

This is **one measured regional station**, not a modeled average or complete
rainfall map for City and County. Both jurisdictions see the same regional
card. Rainfall can vary substantially within the metro. No false street-level
precision is implied.

Totals are liquid-equivalent precipitation, including melted snow. NWS values
are preliminary and may be revised. Climate days use fixed CST (UTC−06), hence
1 AM–1 AM CDT in summer. The current unfinished climate day and reports issued
before a climate day ends are excluded. The rolling 7/30 days end yesterday in
that time convention. Trace is preserved separately and contributes no measured
hundredths of an inch; it is never silently presented as absolutely no rain.

The normal is the sum of NWS daily normals for **the exact matching dates and
station** (currently 1991–2020, verified from the latest original product).
Missing measurements never become zero. A partial sum is explicitly labeled;
departure/percent of normal require every measured day and normal. Dry spell
means successive complete days under 0.01 in, traces included under that
threshold. Missing days interrupt it; ≥ denotes a known minimum, not an exact
streak. This measure is not a drought, flood or soil-moisture classification.
