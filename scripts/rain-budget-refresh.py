#!/usr/bin/env python3
"""Refresh Andymap's small, measured St. Louis precipitation history.

Only the maintenance process calls IEM. Visitors fetch the local JSON once.
Requires Python 3.9+ standard library; no API key or paid service.
"""
import argparse
import datetime as dt
import json
import math
import pathlib
import re
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
STANDARD = dt.timezone(dt.timedelta(hours=-6))
BASE = 'https://mesonet.agron.iastate.edu'


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Andymap/1.0 public-climate-refresh'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.read().decode('utf-8')
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except (TimeoutError, urllib.error.URLError):
            if attempt == 2:
                raise
        time.sleep(2 * (attempt + 1))


def amount(value, allow_trace=False):
    if allow_trace and isinstance(value, str) and value.strip().upper() == 'T':
        return 0.0, True
    if isinstance(value, bool) or value is None or value == '':
        return None, False
    try:
        number = float(value)
        if not math.isfinite(number) or number < 0:
            return None, False
        # IEM's numerical trace sentinel is not a measured 0.0001 inches.
        if allow_trace and number == 0.0001:
            return 0.0, True
        return number, False
    except (ValueError, TypeError):
        return None, False


def normalize(rows, start, end):
    by_day = {}
    for row in rows:
        if row.get('station') != 'KSTL':
            continue
        try:
            day = dt.date.fromisoformat(row['valid'])
        except (ValueError, TypeError, KeyError):
            continue
        if not start <= day <= end:
            continue
        product = row.get('product', '')
        if not re.fullmatch(r'\d{12}-KLSX-CDUS43-CLISTL', product):
            continue
        issued = dt.datetime.strptime(product[:12], '%Y%m%d%H%M').replace(tzinfo=dt.timezone.utc)
        # Ignore an afternoon "today so far" report: the source day must have ended.
        ends = dt.datetime.combine(day + dt.timedelta(days=1), dt.time(), STANDARD)
        if issued < ends:
            continue
        precip, trace = amount(row.get('precip'), True)
        normal, _ = amount(row.get('precip_normal'))
        clean = {'day': day.isoformat(), 'precipIn': precip, 'normalIn': normal, 'trace': trace, 'product': product}
        previous = by_day.get(clean['day'])
        if previous is None or product > previous['product']:
            by_day[clean['day']] = clean
    return [by_day[day] for day in sorted(by_day)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'rain-budget.json')
    args = parser.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    end = now.astimezone(STANDARD).date() - dt.timedelta(days=1)
    start = end - dt.timedelta(days=119)
    rows, source_urls = [], []
    for year in range(start.year, end.year + 1):
        url = f'{BASE}/json/cli.py?station=KSTL&year={year}'
        rows.extend(json.loads(fetch(url))['results'])
        source_urls.append(url)
    records = normalize(rows, start, end)
    recent = [r for r in records if r['day'] >= (end - dt.timedelta(days=29)).isoformat() and r['precipIn'] is not None]
    if len(recent) < 20 or not records or records[-1]['day'] < (end - dt.timedelta(days=2)).isoformat():
        raise RuntimeError('Source is incomplete or stale; preserving previous snapshot without extending its expiry.')
    report_url = f"{BASE}/api/1/nwstext/{records[-1]['product']}"
    report = fetch(report_url)
    period = re.search(r'CLIMATE NORMAL PERIOD\s+(\d{4})\s+TO\s+(\d{4})', report)
    if not period or 'PRECIPITATION (IN)' not in report:
        raise RuntimeError('Could not verify climate normal period and precipitation units; preserving previous snapshot.')
    output = {
        'schema': 1, 'checkedAt': now.isoformat(),
        'expiresAt': (now + dt.timedelta(hours=48)).isoformat(),
        'station': {'id': 'KSTL', 'name': 'St. Louis Lambert airport', 'lat': 38.7524, 'lng': -90.3734, 'nceiId': 'USW00013994'},
        'source': {'name': 'National Weather Service daily climate reports, archived by Iowa State IEM', 'urls': source_urls, 'latestReportUrl': report_url, 'issuedAt': dt.datetime.strptime(records[-1]['product'][:12], '%Y%m%d%H%M').replace(tzinfo=dt.timezone.utc).isoformat(), 'documentationUrl': BASE + '/json/cli.py?help'},
        'normalPeriod': '\u2013'.join(period.groups()),
        'dayDefinition': 'Midnight to midnight Central Standard Time (UTC\u221206); 1 AM to 1 AM during daylight saving time.',
        'measurement': 'Measured liquid-equivalent precipitation, including melted snow; preliminary NWS observations, not a modeled area average.',
        'records': records,
    }
    # Atomic replacement; failures never replace real data with a zero series.
    temporary = args.output.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(output, separators=(',', ':')) + '\n')
    temporary.replace(args.output)
    print(f"Rain budget: {len(records)} days; {len(recent)}/30 measured days; through {records[-1]['day']}; normal {output['normalPeriod']}; {args.output.stat().st_size} bytes")


if __name__ == '__main__':
    main()
