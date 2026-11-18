"""Publish a small metro subset of EPA AirNow's national HourlyAQObs product.

The named hour is the UTC *start* of a complete, preliminary observation period.
Do not substitute a nearby site's value, a non-detect, a permit limit or a
retrieval time for a measured ambient concentration and observation timestamp.
"""
import argparse
import csv
from datetime import datetime, timedelta, timezone
import io
import json
import math
from pathlib import Path
import re
import sys
import urllib.request
import urllib.error

UTC = timezone.utc
HOUR = timedelta(hours=1)
MAX_AGE = 4 * HOUR
MAX_BYTES = 6_000_000
METADATA = 'https://docs.airnowapi.org/docs/HourlyAQObsFactSheet.pdf'
GASES = {'NO2': 'ppb', 'SO2': 'ppb', 'CO': 'ppm'}
ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {'AQSID','Status','SiteName','Latitude','Longitude','CountryCode','StateName',
            'ValidDate','ValidTime','DataSource','NO2_Measured','NO2_AQI',*GASES,
            *(p+'_Unit' for p in GASES)}

def iso(t):
    return t.astimezone(UTC).isoformat(timespec='seconds').replace('+00:00','Z')

def url_for(hour):
    return f'https://files.airnowtech.org/airnow/{hour:%Y/%Y%m%d}/HourlyAQObs_{hour:%Y%m%d%H}.dat'

def number(raw):
    if not isinstance(raw,str) or not re.fullmatch(r'-?\d+(?:\.\d+)?', raw):
        return None
    v = float(raw)
    return v if math.isfinite(v) else None

def parse_file(raw, file_hour, now):
    if now.tzinfo is None or file_hour.tzinfo is None or not HOUR <= now-file_hour <= MAX_AGE:
        raise ValueError('File hour incomplete or stale')
    if not 0 < len(raw) <= MAX_BYTES:
        raise ValueError('Invalid or oversized AirNow file')
    reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig'),newline=''),strict=True)
    if not REQUIRED.issubset(reader.fieldnames or []) or len(set(reader.fieldnames)) != len(reader.fieldnames):
        raise ValueError('AirNow gas columns changed')
    start, end = iso(file_hour), iso(file_hour+HOUR)
    url = url_for(file_hour)
    stations, duplicates = {}, set()
    for r in reader:
        if None in r or r['CountryCode'] != 'US' or r['StateName'] not in ('MO','IL') or r['Status'] != 'Active':
            continue
        lat, lon = number(r['Latitude']), number(r['Longitude'])
        if lat is None or lon is None or not (38.1<=lat<=39.2 and -91.2<=lon<=-89.4): continue
        id_ = r['AQSID'] or ''
        if len(id_) == 12 and id_.startswith('840'): id_ = id_[3:]
        if not re.fullmatch(r'\d{9}', id_) or id_[:2] != ('29' if r['StateName']=='MO' else '17'): continue
        if not r['SiteName'] or not r['DataSource']: continue
        time_match = r['ValidDate'] in {file_hour.strftime('%m/%d/%Y'),file_hour.strftime('%m/%d/%y')} and r['ValidTime'] == file_hour.strftime('%H:%M')
        if not time_match: continue
        readings = []
        for p, unit in GASES.items():
            value = number(r[p])
            # Conservative public display: retain zero; omit negatives (including
            # below-zero instrument noise), sentinels, blanks and unexpected units.
            if value is None or value<0 or (r[p+'_Unit'] or '').lower() != unit: continue
            if p == 'NO2' and r['NO2_Measured'] != '1': continue
            reading = {'parameter':p,'value':value,'unit':unit,'averagingPeriod':'1 hour',
                       'observedAt':start,'periodEnd':end,'status':'preliminary'}
            if p=='NO2':
                aqi = number(r['NO2_AQI'])
                if aqi is not None and aqi.is_integer() and 0<=aqi<=1000: reading['aqi']=int(aqi)
            readings.append(reading)
        if not readings: continue
        s = {'id':id_,'aqsId':id_,'name':r['SiteName'][:160], 'lat':lat,'lon':lon,
             'source':r['DataSource'][:180], 'sourceUrl':url,'observedAt':start,
             'status':'preliminary','readings':readings}
        if id_ in stations and s != stations[id_]: duplicates.add(id_)
        else: stations[id_] = s
    return {'schemaVersion':1,'fetchedAt':iso(now),'maxAgeHours':4,
            'sources':[{'name':'EPA AirNow / reporting agencies', 'url':url, 'documentationUrl':METADATA,
                        'observedAt':start, 'periodEnd':end,'status':'preliminary'}],
            'stations':[stations[k] for k in sorted(stations.keys()-duplicates)]}

def fetch(hour):
    req = urllib.request.Request(url_for(hour),headers={'User-Agent':'Andymap air data refresh/1.0'})
    with urllib.request.urlopen(req, timeout=22) as res:
        return res.read(MAX_BYTES+1)

def refresh(now, fetcher=fetch):
    hour = now.astimezone(UTC).replace(minute=0,second=0,microsecond=0)-HOUR
    # Start with the latest complete hour. A file may not yet exist at :23.
    # Prefer the newest local file that actually supplies accepted gas observations.
    while now-hour <= MAX_AGE:
        try:
            parsed = parse_file(fetcher(hour),hour,now)
            if parsed['stations']: return parsed
            print(f'No eligible local observations in {iso(hour)}',file=sys.stderr)
        except (OSError,ValueError,csv.Error) as e:
            print(f'{iso(hour)}: {e}',file=sys.stderr)
        hour -= HOUR
    raise ValueError('No recent usable EPA hourly gas readings; not republishing old observations as current')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, default=ROOT/'data/airnow-gases.json')
    args=p.parse_args()
    result=refresh(datetime.now(UTC))
    dest=args.output
    dest.parent.mkdir(parents=True,exist_ok=True)
    tmp=dest.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(result, indent=2, allow_nan=False)+'\n')
    tmp.replace(dest)
    print(f"Published {len(result['stations'])} gas stations, hour starting {result['sources'][0]['observedAt']} UTC")
if __name__=='__main__':
    main()
