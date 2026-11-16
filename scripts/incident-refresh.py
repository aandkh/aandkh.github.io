#!/usr/bin/env python3
"""Refresh public, official County crime/injury-crash feeds; retain the shared metro archive.
No credentials. See INCIDENT-MAINTENANCE.md for City release review and coverage limits.
"""
import sys
sys.dont_write_bytecode = True
import argparse, concurrent.futures, datetime as dt, hashlib, json, pathlib, re, urllib.parse, urllib.request
from zoneinfo import ZoneInfo
ROOT = pathlib.Path(__file__).resolve().parents[1]
LOCAL = ZoneInfo('America/Chicago')
BASE = 'https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/'
SOURCES = {
 'county-nibrs': {'name':'County + participating municipal police crime reports', 'url':'https://www.stlouiscountypolice.com/st-louis-county-crime-map/', 'api':BASE+'crimedata2023_XYTableToPoint2/FeatureServer/0', 'dateField':'occurred', 'cadence':'Weekly; approved reports can arrive later.', 'coverage':'County Police patrol areas and participating municipal departments. Does not cover every municipality. Each case can include multiple reported offenses.', 'fields':'Report_Number,reportingJuris,forJuris,address,latitude,longitude,occurred,OffenseName,NIBRSCode'},
 'county-crashes': {'name':'County Police injury and fatal crashes', 'url':'https://www.stlouiscountypolice.com/st-louis-county-crime-map/', 'api':BASE+'Vehicle_Accidents/FeatureServer/0', 'dateField':'Accident_Date', 'cadence':'Weekly; approved reports can arrive later.', 'coverage':'Crashes investigated by County Police; municipal and Highway Patrol crashes are not comprehensively included. Property-damage-only crashes are omitted.', 'fields':'Accident_ID,Report_Number,Property_Damage_Only,Number_Injured,Number_Killed,Number_of_Vehicles,Accident_Date,Accident_Time,latdd,londd,On_Road,Cross_Road'},
}

def request_json(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Andymap source-maintenance/1.0','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=35) as r: result=json.load(r)
 if result.get('error'): raise RuntimeError(str(result['error']))
 return result

def fetch_source(source,since):
 config=SOURCES[source]; rows=[]; offset=0
 while True:
  query={'f':'json','where':f"{config['dateField']} >= TIMESTAMP '{since} 00:00:00'",'outFields':config['fields'],'returnGeometry':'false','orderByFields':config['dateField']+' ASC,OBJECTID ASC','resultOffset':offset,'resultRecordCount':1000}
  data=request_json(config['api']+'/query?'+urllib.parse.urlencode(query)); batch=data.get('features',[])
  rows.extend(f['attributes'] for f in batch)
  if not data.get('exceededTransferLimit'): break
  if not batch: raise RuntimeError('Incomplete ArcGIS page: transfer limit without records')
  offset+=len(batch)
  if offset>100000: raise RuntimeError('Unexpected archive size; review query')
 return rows

def masked_address(address):
 # No household-level addresses in the browsing experience.
 text=str(address or '').strip()
 if re.fullmatch(r'\d{1,3}',text):return 'Highway '+text
 # County road-ramp IDs are not house numbers. Keep the actual ramp description.
 if re.match(r'^\d+\s+.*(?:IS\d|MO\d|RT[A-Z]).*\sTO\s',text,re.I):text=re.sub(r'^\d+\s+','Ramp: ',text)
 return re.sub(r'^\s*(\d+)\b(?=\s+\S)',lambda m:str(int(m[1])//100*100)+' block of',text).title().replace('Block Of','block of')

def point(lon,lat):
 try: lon,lat=float(lon),float(lat)
 except (ValueError,TypeError): return None
 if not(-91.0<lon<-89.8 and 38.3<lat<39.0): return None
 return {'type':'Point','coordinates':[round(lon,3),round(lat,3)]}

def kind(name):
 s=name.lower()
 if 'homicide' in s or 'manslaughter' in s: return 'homicide'
 if 'assault' in s: return 'assault'
 if 'robbery' in s: return 'robbery'
 if 'burglary' in s: return 'burglary'
 if 'motor vehicle theft' in s: return 'vehicle theft'
 if 'larceny' in s or 'stolen property' in s: return 'theft'
 if any(x in s for x in ['fraud','forgery','embezzlement','extortion']): return 'fraud'
 if 'vandalism' in s: return 'vandalism'
 if 'weapon' in s: return 'weapons'
 if 'drug' in s: return 'drugs'
 if 'arson' in s: return 'arson'
 return 'other'

PRIORITY=['homicide','assault','robbery','arson','burglary','vehicle theft','weapons','theft','vandalism','fraud','drugs','other']
def crime_features(rows,checked):
 groups={}; omitted=0
 for row in rows:
  # Avoid putting sexual-offense victim residences on this browse map.
  if any(x in str(row.get('OffenseName','')).lower() for x in ['sex offense','pornography']): omitted+=1; continue
  report=str(row.get('Report_Number') or ''); agency=str(row.get('reportingJuris') or '')
  date=str(row.get('occurred') or '')[:10]
  if not(report and agency and re.fullmatch(r'\d{4}-\d{2}-\d{2}',date)): omitted+=1; continue
  key=agency+'|'+report
  entry=groups.setdefault(key,{'rows':[],'date':date});entry['rows'].append(row)
  entry['date']=min(entry['date'],date)
 features=[]
 for key,g in groups.items():
  row=g['rows'][0]; geo=point(row.get('longitude'),row.get('latitude'))
  if not geo: omitted+=len(g['rows']);continue
  offenses=sorted({str(r['OffenseName']) for r in g['rows'] if r.get('OffenseName')})
  types=sorted({kind(o) for o in offenses},key=PRIORITY.index)
  area=str(row.get('forJuris') or row.get('reportingJuris') or 'St. Louis County').title().replace('Saint Louis','St. Louis')
  primary=types[0]; title=primary.title()+' report · '+area
  p={'id':'incident:county-nibrs:'+hashlib.sha256(key.encode()).hexdigest()[:16], 'title':title,'incidentAt':g['date'],'incidentDate':g['date'],'incidentTimeAccuracy':'date-only','incidentKind':primary,'incidentTypes':types,'offenses':offenses,'address':masked_address(row.get('address'))+', '+area+', MO','sourceId':'county-nibrs','sourceCheckedAt':checked,'jurisdiction':'county','reportNumber':str(row['Report_Number']),'reportingAgency':row['reportingJuris'],'locationAccuracy':'Approximate reported area (coordinates rounded to about 100 m)','color':'#c52f73'}
  features.append({'type':'Feature','geometry':geo,'properties':p})
 return features,omitted

def outcome(value):
 if isinstance(value,(int,float)) and value>=0 and int(value)==value: return int(value)
 return None

def crash_features(rows,checked):
 features=[];omitted=0
 for row in rows:
  injuries=outcome(row.get('Number_Injured'));deaths=outcome(row.get('Number_Killed'))
  if not((injuries or 0)>0 or (deaths or 0)>0): omitted+=1;continue
  geo=point(row.get('londd'),row.get('latdd'))
  try: date=dt.datetime.fromtimestamp(row['Accident_Date']/1000,dt.timezone.utc).astimezone(LOCAL).date()
  except (TypeError,ValueError,KeyError): omitted+=1;continue
  if not geo or not row.get('Accident_ID'): omitted+=1;continue
  raw=row.get('Accident_Time'); stamp=date.isoformat();precision='date-only'
  if isinstance(raw,(int,float)) and raw==int(raw) and 0<=raw<=2359 and raw%100<60:
   stamp=dt.datetime.combine(date,dt.time(int(raw)//100,int(raw)%100),LOCAL).isoformat();precision='reported time'
  road=str(row.get('On_Road') or '').strip(); cross=str(row.get('Cross_Road') or '').strip()
  address=masked_address(road)+((' near '+masked_address(cross)) if cross and cross!=road else '')
  p={'id':'incident:county-crash:'+str(row['Accident_ID']),'title':('Fatal crash' if deaths else 'Injury crash')+' · '+(masked_address(road) or 'St. Louis County'),'incidentAt':stamp,'incidentDate':date.isoformat(),'incidentTimeAccuracy':precision,'incidentKind':'crash','incidentTypes':['crash'],'address':address+', St. Louis County, MO','sourceId':'county-crashes','sourceCheckedAt':checked,'jurisdiction':'county','reportNumber':str(row.get('Report_Number') or ''),'locationAccuracy':'Approximate reported road location (rounded to about 100 m)','color':'#ed5900'}
  for k,v in [('deaths',deaths),('injuries',injuries),('vehicles',outcome(row.get('Number_of_Vehicles')))]:
   if v is not None:p[k]=v
  if p.get('deaths',0)>0:p['severity']='fatal'
  elif p.get('injuries',0)>0:p['severity']='injury'
  features.append({'type':'Feature','geometry':geo,'properties':p})
 return features,omitted

def merge_features(old,new):
 # Source agency + case ID is stable; multiple updates never create another incident.
 aliases={alias:f['properties']['id'] for f in old+new for alias in f['properties'].get('alternateIds',[])}
 merged={}
 for f in old+new:
  # Never mutate caller snapshots or reset a case's original discovery date.
  f={**f,'properties':dict(f['properties'])}
  key=aliases.get(f['properties']['id'],f['properties']['id']);previous=merged.get(key)
  if key!=f['properties']['id']:f={**f,'properties':{**f['properties'],'id':key}}
  if previous:
   before=previous['properties'];after=f['properties']
   first=before.get('firstSeenAt',before.get('sourceCheckedAt'))
   if before.get('alternateIds') and not after.get('alternateIds'):f={**previous,'properties':{**after,**before}}
   elif after.get('alternateIds'):f={**f,'properties':{**before,**after}}
   if before.get('alternateIds') or after.get('alternateIds'):
    f['properties']['incidentTypes']=sorted(set(before.get('incidentTypes',[before['incidentKind']])+after.get('incidentTypes',[after['incidentKind']])))
    f['properties']['offenses']=sorted(set(before.get('offenses',[])+after.get('offenses',[])))
   f['properties']['firstSeenAt']=first
  else:f['properties'].setdefault('firstSeenAt',f['properties'].get('sourceCheckedAt'))
  merged[key]=f
 return sorted(merged.values(),key=lambda f:(f['properties'].get('incidentDate') or f['properties']['incidentAt'][:10],f['properties']['id']),reverse=True)

def atomic_json(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False)+'\n');temp.replace(path)

def coverage_audit(features,sources,now):
 today=now.astimezone(LOCAL).date();week=(today-dt.timedelta(days=7)).isoformat();month=(today-dt.timedelta(days=30)).isoformat()
 by={j:{'archive':0,'pastWeek':0,'past30Days':0,'latestIncidentDate':None} for j in ['city','county']};warnings=[]
 for f in features:
  p=f['properties'];j=p.get('jurisdiction');day=p.get('incidentDate',p['incidentAt'][:10])
  if j not in by or day>today.isoformat():continue
  b=by[j];b['archive']+=1;b['pastWeek']+=day>=week;b['past30Days']+=day>=month;b['latestIncidentDate']=max(day,b['latestIncidentDate'] or '')
 source_map={s['id']:s for s in sources}
 for ident,maxlag in [('city-crimemapping',3),('county-nibrs',9),('county-crashes',9),('county-florissant',9),('county-chesterfield-bulletins',7)]:
  s=source_map.get(ident)
  if not s:warnings.append({'code':'missing-source','sourceId':ident,'message':ident+' has no source status; check the combined feed.'});continue
  if s.get('status')=='error':warnings.append({'code':'source-failed','sourceId':ident,'message':ident+' failed its last refresh; prior verified reports are retained.'})
  try:lag=(today-dt.date.fromisoformat(s['latestIncidentDate'])).days
  except (TypeError,KeyError,ValueError):lag=None
  if lag is None or lag>maxlag:warnings.append({'code':'source-lag','sourceId':ident,'message':ident+' latest occurrence is '+str(lag)+' days old; review for stalled publication.'})
  if ident in ['county-nibrs','county-crashes'] and lag is not None and lag>=6:warnings.append({'code':'weekly-lag','sourceId':ident,'message':'County weekly reporting reaches '+s['latestIncidentDate']+'. Newer cases may be missing from the past-week map.'})
 for j,b in by.items():
  if not b['pastWeek']:warnings.append({'code':'empty-region-week','jurisdiction':j,'message':j.title()+' has no published reports in the past-week snapshot. This is not evidence of no incidents.'})
 return {'checkedAt':now.isoformat(),'combined':True,'byJurisdiction':by,'warnings':warnings,'note':'Source health and reporting lag only. Counts do not compare crime rates or neighborhood safety.'}

def fatality_records(features):
 rows=[]
 for f in features:
  p=f['properties'];evidence=p.get('fatalityEvidence',[])
  if p.get('incidentKind')=='crash':continue
  if not evidence and not p.get('deaths',0)>0 and 'homicide' not in p.get('incidentTypes',[p.get('incidentKind')]):continue
  keys=['id','alternateIds','incidentAt','incidentDate','incidentTimeAccuracy','incidentKind','incidentTypes','deaths','fatalityEvidence','sourceUrl','sourceId','title','jurisdiction']
  rows.append({'type':'Feature','properties':{k:p[k] for k in keys if k in p}})
 return rows

def publish_archive(features,metadata,now,root=ROOT):
 months={}
 for f in features:
  p=f['properties']
  # Public structured sources provide local clocks, not a DST fold. Preserve
  # the clock but do not invent which repeated 1 a.m. hour was meant.
  if p.get('sourceId') in ['city-crimemapping','county-crashes'] and len(p['incidentAt'])>10:
   local=dt.datetime.fromisoformat(p['incidentAt']).replace(tzinfo=LOCAL)
   if local.utcoffset()!=local.replace(fold=1).utcoffset():p.update({'incidentAt':local.date().isoformat(),'incidentLocalTime':local.strftime('%H:%M'),'incidentTimeAccuracy':'date-only','timeNote':'Reported local clock time; repeated fall-back hour has no UTC offset in source.'})
  months.setdefault(p['incidentAt'][:7],[]).append(f)
 descriptors=[]
 for month,items in sorted(months.items(),reverse=True):
  path='incident-archive/'+month+'.json';atomic_json(root/path,{'type':'FeatureCollection','features':items})
  descriptors.append({'month':month,'url':'./'+path,'count':len(items)})
 cutoff=(now.astimezone(LOCAL).date()-dt.timedelta(days=7)).isoformat()
 recent=[f for f in features if f['properties']['incidentAt'][:10]>=cutoff]
 metadata.update({'type':'FeatureCollection','features':recent,'archiveMonths':descriptors,'archiveCount':len(features),'recentFrom':cutoff,'checkedAt':now.isoformat(),'archiveStartedAt':metadata.get('archiveStartedAt','2026-11-15')})
 metadata['archiveCoverageFrom']=min((f['properties']['incidentAt'][:10] for f in features),default=None)
 metadata['coverageAudit']=coverage_audit(features,metadata.get('sources',[]),now)
 # A small projection of the FULL archive supports calendar-year analytics without
 # loading every map point. Never claim complete year coverage from this subset.
 metadata['fatalityRecords']=fatality_records(features)
 metadata['fatalityCoverage']={'completeYear':False,'note':'Selected sourced reports only; not a complete City + County mortality census.'}
 atomic_json(root/'recent-incidents.json',metadata)

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--days',type=int,default=45);parser.add_argument('--since');parser.add_argument('--now');parser.add_argument('--repack',action='store_true',help='Merge reviewed releases and rebuild archive without downloading feeds');parser.add_argument('--fixtures',type=pathlib.Path,help='Read <source-id>.json attributes arrays instead of network');args=parser.parse_args()
 now=dt.datetime.fromisoformat(args.now) if args.now else dt.datetime.now(dt.timezone.utc)
 if not now.tzinfo:now=now.replace(tzinfo=dt.timezone.utc)
 since=args.since or (now.astimezone(LOCAL).date()-dt.timedelta(days=args.days)).isoformat();checked=now.isoformat()
 metadata=json.loads((ROOT/'recent-incidents.json').read_text());old=metadata.pop('features',[])
 for path in (ROOT/'incident-archive').glob('????-??.json'):old+=json.loads(path.read_text()).get('features',[])
 source_meta={s['id']:s for s in metadata.get('sources',[]) if s.get('id')};new=[];failures=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
  jobs={executor.submit((lambda s:json.loads((args.fixtures/(s+'.json')).read_text())) if args.fixtures else (lambda s:fetch_source(s,since)),s):s for s in ([] if args.repack else SOURCES)}
  for job in concurrent.futures.as_completed(jobs):
   source=jobs[job];config=SOURCES[source]
   try:
    rows=job.result();features,omitted=(crime_features if source=='county-nibrs' else crash_features)(rows,checked);new+=features
    dates=[f['properties']['incidentAt'][:10] for f in features]
    source_meta[source]={'id':source,**{k:v for k,v in config.items() if k not in ['fields','dateField']},'checkedAt':checked,'status':'ok','latestIncidentDate':max(dates) if dates else source_meta.get(source,{}).get('latestIncidentDate'),'rowsRetrieved':len(rows),'uniqueMappedReports':len(features),'omittedRows':omitted,'reviewWindowFrom':since}
    print(source+': '+str(len(rows))+' source rows → '+str(len(features))+' incidents; latest '+str(max(dates) if dates else 'none'))
   except Exception as e:
    failures.append(source);previous=source_meta.get(source,{})
    source_meta[source]={**previous,'id':source,'name':config['name'],'url':config['url'],'coverage':config['coverage'],'cadence':config['cadence'],'status':'error','lastAttemptAt':checked,'error':str(e)[:180]};print(source+': failed; archive preserved: '+str(e)[:180])
 reviewed_path=ROOT/'incident-reviewed.json'
 if reviewed_path.exists():
  reviewed=json.loads(reviewed_path.read_text())
  for f in reviewed.get('features',[]):
   p=f.get('properties',{})
   if not p.get('id') or not p.get('sourceUrl') or not p.get('locationAccuracy') or not p.get('incidentAt'):raise ValueError('Reviewed incident requires stable ID, source, occurrence date and location precision')
   if f.get('geometry',{}).get('type')!='Point' or not point(*f['geometry']['coordinates']):raise ValueError('Invalid reviewed incident geometry: '+p['id'])
   for key in ['deaths','injuries']:
    if key in p and outcome(p[key]) is None:raise ValueError('Unknown outcome must be omitted: '+p['id'])
   evidence=p.get('fatalityEvidence',[])
   if evidence:
    if p.get('incidentKind')=='crash' or len({e.get('category') for e in evidence})!=len(evidence):raise ValueError('Invalid fatality categories: '+p['id'])
    for e in evidence:
     if e.get('category') not in ['police','other-homicide'] or outcome(e.get('deaths')) is None or e['deaths']<1 or not e.get('sourceUrl') or not e.get('summary'):raise ValueError('Fatality attribution requires sourced, explicit count: '+p['id'])
    if sum(e['deaths'] for e in evidence)>p.get('deaths',0):raise ValueError('Attributed deaths exceed reported total: '+p['id'])
   new.append(f)
  for source in ['city-releases','county-releases','county-reviewed-news','county-chesterfield-bulletins']:
   items=[f for f in reviewed.get('features',[]) if f['properties'].get('sourceId')==source]
   if items and source in source_meta:source_meta[source].update({'checkedAt':reviewed.get('sourceReviews',{}).get(source,reviewed.get('reviewedAt')),'latestIncidentDate':max(f['properties']['incidentAt'][:10] for f in items)})
 metadata['sources']=list(source_meta.values());metadata['coverageNote']='City and County are always shown together. City and Florissant public maps supplement County and participating municipal feeds, which update weekly. Chesterfield daily bulletins, reviewed municipal investigations and Highway Patrol reporting add newer County cases. Agency exclusions and approval delays remain. These are reported incidents, not a complete regional census or safety ranking. Locations are approximate; unknown outcomes are not zero.'
 features=merge_features(old,new);publish_archive(features,metadata,now)
 print(str(len(features))+' total archived incidents; '+str(len(metadata['features']))+' in fast recent snapshot')
 if failures:raise SystemExit(1)
if __name__=='__main__':main()
