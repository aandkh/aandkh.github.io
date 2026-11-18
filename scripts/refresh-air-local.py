#!/usr/bin/env python3
"""Ingest DNR preliminary hourly Rider Trail measurements, never inferred exposure.
Requires pdftotext (Poppler). CST is fixed UTC-6, including summer.
"""
import argparse
import datetime as dt
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://dnrservices.mo.gov/env/esp/aqm/docs/ridertrail.pdf'
SITE_URL = 'https://dnr.mo.gov/air/hows-air/monitoring/sites/rider-trail-i-70-st-louis-county'
CST = dt.timezone(dt.timedelta(hours=-6))
UTC = dt.timezone.utc
MAX_AGE_HOURS = 4
HEADERS = ['WINDD', 'WINDS', 'SO2', 'NO_Direct', 'NO2_Direct', 'NOX_Direct', 'AMB_PRSR', 'SOLAR', 'OTEMP_10M']
UNITS = ['DEG', 'MPH', 'PPB', 'PPB', 'PPB', 'PPB', 'MM/HG', 'W/M2', 'DEGC']


def iso(t):
    return t.astimezone(UTC).isoformat(timespec='seconds').replace('+00:00', 'Z')


def number(token):
    # No partial numeric parsing: all instrument flags, blanks, NaN and suffixes fail.
    if not re.fullmatch(r'-?(?:\d+(?:\.\d*)?|\.\d+)', token):
        return None
    value = float(token)
    return value if math.isfinite(value) else None


def parse_report(text, now):
    now = now.astimezone(UTC)
    rows, print_times = [], []
    for page in text.split('\f'):
        header = re.search(r'Site:\s+Rider Trail I-70\s+(\d{1,2}/\d{1,2}/\d{4})', page)
        if not header or 'WINDD' not in page:
            continue  # Other pages contain different instruments; never reuse indexes.
        if 'Interval: 001h' not in page:
            raise ValueError('Unexpected source averaging interval')
        lines = page.splitlines()
        heading = next((i for i, s in enumerate(lines) if 'WINDD' in s), None)
        if heading is None or lines[heading].split() != HEADERS or lines[heading+1].split() != ['Time'] + UNITS:
            raise ValueError('DNR column schema changed')
        printed = re.search(r'Date Printed:\s+(\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2})', page)
        if not printed:
            raise ValueError('No source report generation time')
        print_times.append(dt.datetime.strptime(printed[1], '%m/%d/%Y %H:%M').replace(tzinfo=CST).astimezone(UTC))
        day = dt.datetime.strptime(header[1], '%m/%d/%Y').replace(tzinfo=CST)
        for line in lines[heading+2:]:
            fields = line.split()
            if not fields or not re.fullmatch(r'(?:[01]\d|2[0-3]):00', fields[0]):
                continue
            if len(fields) != 10:
                continue  # A missing cell must not shift another instrument into its place.
            when = (day + dt.timedelta(hours=int(fields[0][:2]))).astimezone(UTC)
            age = (now - when).total_seconds()/3600
            if not 1 <= age <= MAX_AGE_HOURS:
                continue  # Only completed, recent hours; no future/partial readings.
            values = dict(zip(HEADERS, map(number, fields[1:])))
            rows.append((when, values))
    if not print_times:
        raise ValueError('No Rider Trail hourly measurement pages')
    printed_at = max(print_times)
    if printed_at > now + dt.timedelta(minutes=5):
        raise ValueError('Future-dated DNR report')
    rows.sort(key=lambda row: row[0], reverse=True)
    readings = []
    for parameter, column in [('SO2','SO2'), ('NO','NO_Direct'), ('NO2','NO2_Direct'), ('NOx','NOX_Direct')]:
        for when, values in rows:
            v = values[column]
            if v is not None and v >= 0:
                readings.append({'parameter':parameter, 'value':v, 'unit':'ppb', 'averagingPeriod':'1 hour',
                    'observedAt':iso(when), 'periodEnd':iso(when+dt.timedelta(hours=1)), 'status':'preliminary'})
                break
    wind = None
    for when, values in rows:
        speed, direction = values['WINDS'], values['WINDD']
        if speed is not None and speed >= 0 and direction is not None and 0 <= direction <= 360:
            wind = {'speed':speed, 'directionFromDegrees':direction % 360 if speed > 0 else None,
                    'unit':'mph', 'averagingPeriod':'1 hour', 'observedAt':iso(when),
                    'periodEnd':iso(when+dt.timedelta(hours=1)), 'status':'preliminary'}
            break
    times = [r['observedAt'] for r in readings] + ([wind['observedAt']] if wind else [])
    return {'schemaVersion':1, 'fetchedAt':iso(now), 'maxAgeHours':MAX_AGE_HOURS,
        'sources':[{'name':'Missouri DNR', 'url':SOURCE, 'siteUrl':SITE_URL, 'reportPrintedAt':iso(printed_at),
                    'sourceTimeZone':'CST (UTC-06:00 year-round)', 'status':'preliminary'}],
        'stations':[{'id':'dnr-29-189-0016', 'name':'Rider Trail I-70', 'lat':38.75264, 'lon':-90.44884,
                     'sourceUrl':SOURCE, 'siteUrl':SITE_URL, 'observedAt':max(times) if times else None,
                     'status':'preliminary' if times else 'unavailable', 'readings':readings, 'wind':wind}]}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--text', help='Saved pdftotext -layout output, for reproducible offline validation')
    p.add_argument('--now', help='ISO timestamp for fixtures only')
    p.add_argument('--output', default=str(ROOT/'data/air-local-observations.json'))
    args = p.parse_args()
    now = dt.datetime.fromisoformat(args.now.replace('Z','+00:00')) if args.now else dt.datetime.now(UTC)
    if now.tzinfo is None:
        raise ValueError('--now must have a time zone')
    if args.text:
        text = Path(args.text).read_text()
    else:
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp)/'report.pdf'
            request = urllib.request.Request(SOURCE, headers={'User-Agent':'Andymap source refresh/1.0'})
            with urllib.request.urlopen(request, timeout=60) as response:
                data = response.read(15_000_001)
            if len(data)>15_000_000 or not data.startswith(b'%PDF-'):
                raise ValueError('Invalid or oversized source PDF')
            pdf.write_bytes(data)
            text = subprocess.run(['pdftotext','-layout',str(pdf),'-'], check=True, capture_output=True, text=True, timeout=60).stdout
    result = parse_report(text, now)
    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, indent=2)+'\n')
    temporary.replace(destination)
    print(json.dumps({'output':str(destination),'fetchedAt':result['fetchedAt'],'observedAt':result['stations'][0]['observedAt']}))


if __name__ == '__main__':
    main()
