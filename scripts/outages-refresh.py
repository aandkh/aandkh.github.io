#!/usr/bin/env python3
"""Refresh public electricity supplements: water advisories and gas status.

Uses only published public data. Does not authenticate to customer ISP accounts.
Run hourly (or more often); notices expire in the UI if refresh stops.
"""
import concurrent.futures
import datetime as dt
import hashlib
import html
import json
import pathlib
import re
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'outages-expanded.json'
CENTRAL = ZoneInfo('America/Chicago')
UTC = dt.timezone.utc
SERVICE = 'https://utility.arcgis.com/usrsvcs/servers/482bbe2135c54d178ec406189303faf4/rest/services/CustomerAdvisoryMap/DisplayData_SDE/MapServer'
FIELDS = 'EventID,EventNotificationType,EventType,EventState,EventStatus,EventNotificationDate,EventStartDate,EventCompletionDate,EventExpirationDate,EventExpirationDateEstimated,EventLastUpdatedDate,EventHeader,EventHyperlink'
CITY = 'https://www.stlwater.com/outages/'
SPIRE = 'https://www.spireenergy.com/outages'

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Andymap/1.0 (+https://www.andrewhanes.com)'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode()

def iso(value):
    return value.astimezone(UTC).isoformat().replace('+00:00', 'Z')

def epoch(value):
    return dt.datetime.fromtimestamp(value / 1000, UTC) if isinstance(value, (int, float)) and value > 0 else None

def text(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', value))).strip()

def local_time(value):
    return dt.datetime.strptime(text(value), '%m/%d/%Y %I:%M %p').replace(tzinfo=CENTRAL)

def clock(value):
    return value.astimezone(CENTRAL).strftime('%b %-d, %-I:%M %p %Z') if value else ''

def water_query(layer):
    return SERVICE + '/' + str(layer) + '/query?' + urllib.parse.urlencode({
        'f':'geojson', 'where':'1=1', 'geometry':'-90.8,38.35,-90.05,38.95',
        'geometryType':'esriGeometryEnvelope', 'inSR':4326, 'outSR':4326,
        'spatialRel':'esriSpatialRelIntersects', 'outFields':FIELDS, 'returnGeometry':'true'})

def water_features(raw, now):
    result = []
    for f in raw:
        p = f.get('properties', {})
        expires = epoch(p.get('EventExpirationDate'))
        kind = p.get('EventType', '')
        if p.get('EventStatus') != 'Active' or not expires or expires <= now or re.search('complete|lifted|cancelled|canceled', kind, re.I):
            continue
        if f.get('geometry', {}).get('type') not in ('Polygon','MultiPolygon'):
            continue
        planned = bool(re.search('planned', kind, re.I))
        boil = bool(re.search('boil', kind, re.I))
        title = re.split(r'\s+:\s+(?:This|Hello|There|We)\b', p.get('EventHeader',kind), flags=re.I)[0].strip()
        start = epoch(p.get('EventStartDate'))
        estimate = epoch(p.get('EventCompletionDate'))
        updated = epoch(p.get('EventLastUpdatedDate')) or epoch(p.get('EventNotificationDate'))
        description = ('Provider-issued boil-water notice. Read the official notice for instructions and confirmation of lifting.' if boil else
                       'Scheduled water-system work; this does not mean everyone in the area has lost service.' if planned else
                       'Provider-reported water service issue. Some customers in the outlined area may have low pressure, discolored water or interrupted service.')
        description += (((' Scheduled start ' if planned or start > now else ' Started ')+clock(start)+'.') if start else '') + (' Provider estimate: '+clock(estimate)+'.' if estimate else '')
        description += ' Outline supplied by the water provider; individual addresses may differ.'
        url = p.get('EventHyperlink','')
        if not re.fullmatch(r'https://alertsdetail\.awapps\.com/alert/\d+',url):
            url = 'https://amwater.com/moaw/alerts'
        key = 'american-water:' + p['EventID']
        result.append({'type':'Feature','id':key,'geometry':f['geometry'],'properties':{
            'id':key,'layer':'outages','utility':'water','planned':planned,
            'severity':'advisory' if boil else 'planned' if planned else 'disruption',
            'title':('Water work · ' if planned else 'Water · ')+title,
            'description':description,'source':'Illinois American Water' if p.get('EventState')=='IL' else 'Missouri American Water',
            'url':url,'sourceUrl':url,'observedAt':iso(updated) if updated else None,'sourceCheckedAt':iso(now),
            'expiresAt':iso(min(expires,now+dt.timedelta(hours=6))),'providerExpiresAt':iso(expires),
            'estimatedRestoration':iso(estimate) if estimate else None,'locationAccuracy':'Provider advisory boundary',
            'color':'#e63e65' if boil else '#8a81c9' if planned else '#1689d8'}})
    return result

def city_features(raw, now):
    # Select the current-service-outages table, never the historical maintenance table.
    tables = re.findall(r'<table\b[^>]*>.*?</table>', raw, re.S|re.I)
    table = next((t for t in tables if 'Taken Out of Service' in t and 'Est. Time Restored' in t), None)
    if table is None:
        raise ValueError('City current outage table missing; manual review required')
    updated_match = re.search(r'Last Updated\s*<strong[^>]*>(.*?)</strong>',raw,re.S|re.I)
    if not updated_match:
        raise ValueError('City update timestamp missing')
    updated = dt.datetime.strptime(text(updated_match[1]),'%I:%M %p, %B %d, %Y').replace(tzinfo=CENTRAL)
    if now-updated > dt.timedelta(hours=6):
        raise ValueError('City source table is more than six hours old')
    results=[]
    for row in re.findall(r'<tr\b[^>]*>.*?</tr>',table,re.S|re.I):
        cells = re.findall(r'<td\b[^>]*>(.*?)</td>',row,re.S|re.I)
        if len(cells)!=3:
            continue
        start,estimate=local_time(cells[0]),local_time(cells[1])
        address=text(cells[2]); key='stl-water:'+hashlib.sha256((iso(start)+'|'+address).encode()).hexdigest()[:16]
        description='Listed by St. Louis Water Division as a current service outage. Taken out of service '+clock(start)+'. Estimated restoration '+clock(estimate)+'.'
        if estimate<now:
            description+=' The estimate has passed; the source still lists this outage. Restoration is not confirmed.'
        description+=' Published street location; no affected-property boundary was supplied.'
        results.append({'type':'Feature','id':key,'geometry':None,'properties':{
            'id':key,'layer':'outages','utility':'water','planned':False,'severity':'disruption',
            'title':'Water service · '+address,'description':description,'address':address+', St. Louis, MO',
            'source':'City of St. Louis Water Division','url':CITY,'sourceUrl':CITY,'observedAt':iso(updated),
            'sourceCheckedAt':iso(now),'expiresAt':iso(updated+dt.timedelta(hours=6)),
            'estimatedRestoration':iso(estimate),'locationAccuracy':'Street location only; list entry, no guessed map boundary','color':'#1689d8'}})
    return results

def main():
    now=dt.datetime.now(UTC)
    urls={'american-water-17':water_query(17),'american-water-16':water_query(16),'city-water':CITY,'spire':SPIRE}
    data={};errors={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs={pool.submit(fetch,u):k for k,u in urls.items()}
        for job in concurrent.futures.as_completed(jobs):
            k=jobs[job]
            try:data[k]=job.result()
            except Exception as e:errors[k]=str(e)
    previous=json.loads(OUT.read_text()) if OUT.exists() else {'features':[],'providers':[]}
    features=[];providers=[];sources=[]
    for key in ('american-water-17','american-water-16'):
        try:
            d=json.loads(data[key])
            if d.get('error') or d.get('exceededTransferLimit') or not isinstance(d.get('features'),list):raise ValueError('Incomplete service result')
            features+=water_features(d['features'],now)
            sources.append({'id':key,'checkedAt':iso(now),'ok':True,'url':urls[key]})
        except Exception as e:errors[key]=str(e)
    try:
        features+=city_features(data['city-water'],now)
        sources.append({'id':'city-water','checkedAt':iso(now),'ok':True,'url':CITY})
    except Exception as e:errors['city-water']=str(e)
    try:
        if 'not currently experiencing outages across our system' in text(data['spire']).lower():
            providers.append({'id':'spire','name':'Spire gas','summary':'Provider reports no current system outages','checkedAt':iso(now),'expiresAt':iso(now+dt.timedelta(hours=6)),'url':SPIRE})
        else:
            raise ValueError('Spire status changed; review the official page and add a sourced notice')
        sources.append({'id':'spire','checkedAt':iso(now),'ok':True,'url':SPIRE})
    except Exception as e:errors['spire']=str(e)
    # Preserve only not-yet-expired evidence on failure; never reset its checked/expiry time.
    for f in previous.get('features',[]):
        source=f.get('properties',{}).get('source','')
        failed=(source=='City of St. Louis Water Division' and 'city-water' in errors) or ('American Water' in source and any(k in errors for k in ('american-water-16','american-water-17')))
        if failed and dt.datetime.fromisoformat(f['properties']['expiresAt'].replace('Z','+00:00'))>now:
            features.append(f)
    unique={f['properties']['id']:f for f in reversed(features)}
    payload={'checkedAt':iso(now),'features':list(unique.values()),'providers':providers,'sourceChecks':sources,'refreshErrors':errors,
             'note':'Official water provider advisory boundaries and City water street notices. Electricity is loaded separately. ISP account outage maps are not included.'}
    OUT.write_text(json.dumps(payload,separators=(',',':'),ensure_ascii=False)+'\n')
    print(json.dumps({'features':len(payload['features']),'providers':len(providers),'errors':errors}))
    if errors:raise SystemExit(1)

if __name__=='__main__':main()
