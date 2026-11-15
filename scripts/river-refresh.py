#!/usr/bin/env python3
"""Refresh compact 30-day gauge-height baselines from USGS measurements.

Network work runs during maintenance, never in a visitor's browser. Each day
gets equal weight; dense reporting must not outweigh sparse reporting days.
"""
import concurrent.futures, datetime as dt, json, math, pathlib, statistics, urllib.parse, urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
ZONE = ZoneInfo('America/Chicago')
NOW = dt.datetime.now(dt.timezone.utc)
END = NOW.astimezone(ZONE).replace(hour=0, minute=0, second=0, microsecond=0)
START = END - dt.timedelta(days=30)

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Andymap/1.0 public-water-data-refresh'}), timeout=45) as r:
        return json.load(r)

def aggregate(rows):
    hours = {}
    for time, value in rows:
        try:
            t = dt.datetime.fromisoformat(time.replace('Z','+00:00'))
            value = float(value)
            if not math.isfinite(value) or value <= -999 or not START <= t < END: continue
            hours.setdefault(t.astimezone(ZONE).strftime('%Y-%m-%d'), {}).setdefault(t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H'), {})[t.isoformat()] = value
        except (ValueError, TypeError): continue
    days = {day:statistics.mean(statistics.mean(v.values()) for v in hourly.values()) for day,hourly in hours.items() if len(hourly)>=18}
    if len(days)<20: return None
    values=list(days.values())
    return {'meanFt':round(statistics.mean(values),4),'days':len(days),'minDailyMeanFt':round(min(values),4),'maxDailyMeanFt':round(max(values),4),'method':'Mean of daily means, each built from at least 18 populated UTC hours; equal weight per day. Provisional measurements may be revised.'}

def modern(site):
    q=urllib.parse.urlencode({'f':'json','limit':10000,'monitoring_location_id':'USGS-'+site,'parameter_code':'00065','datetime':START.isoformat()+'/'+END.isoformat()})
    url='https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items?'+q
    rows=[]
    while url:
        d=fetch(url)
        rows.extend((p['time'],p['value']) for f in d.get('features',[]) if (p:=f.get('properties',{})).get('unit_of_measure')=='ft' and p.get('qualifier') not in ['Ice','Eqp','Ssn'])
        url=next((l['href'] for l in d.get('links',[]) if l.get('rel')=='next'),None)
    return rows

def batch(sites):
    output={}
    try:
        if NOW.date() >= dt.date(2027,1,1): raise RuntimeError('Modern API preferred during WaterServices retirement')
        q=urllib.parse.urlencode({'format':'json','sites':','.join(sites),'parameterCd':'00065','startDT':START.isoformat(),'endDT':END.isoformat(),'siteStatus':'all'})
        d=fetch('https://waterservices.usgs.gov/nwis/iv/?'+q)
        for s in d.get('value',{}).get('timeSeries',[]):
            site=s['sourceInfo']['siteCode'][0]['value']
            if s.get('variable',{}).get('unit',{}).get('unitCode')!='ft': continue
            rows=[(v['dateTime'],v['value']) for group in s.get('values',[]) for v in group.get('value',[]) if not set(v.get('qualifiers',[])) & {'Ice','Eqp','Ssn'}]
            output[site]=aggregate(rows)
    except Exception as e:
        print('Legacy batch unavailable; using modern USGS endpoint:',type(e).__name__,flush=True)
    for site in sites:
        if site not in output:
            try: output[site]=aggregate(modern(site))
            except Exception as e: print(site,'not refreshed:',type(e).__name__,flush=True)
    return output

def main():
    sites=sorted(json.loads((ROOT/'river-stations.json').read_text()))
    baselines={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(batch,[sites[i:i+5] for i in range(0,len(sites),5)]):
            baselines.update({k:v for k,v in result.items() if v})
            print('Usable baselines:',len(baselines),flush=True)
    if len(baselines)<len(sites)*.7:
        raise RuntimeError('Insufficient successful coverage; preserving the previous snapshot.')
    d={'checkedAt':NOW.isoformat(),'expiresAt':(NOW+dt.timedelta(days=3)).isoformat(),'periodStart':START.isoformat(),'periodEnd':END.isoformat(),'source':'USGS continuous gauge-height measurements','sourceUrl':'https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous','unit':'ft','note':'Each gauge is compared only with its own recent 30-day baseline. This is not a seasonal normal or a flood-risk classification.','baselines':baselines}
    (ROOT/'river-baselines.json').write_text(json.dumps(d,indent=2)+'\n')
    print('Wrote',len(baselines),'of',len(sites),'gauges')

if __name__=='__main__': main()
