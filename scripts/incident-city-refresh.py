#!/usr/bin/env python3
"""Refresh SLMPD's public CrimeMapping map/report views, without authentication.
Uses only the public City crime categories; no registry data is requested or stored.
"""
import sys
sys.dont_write_bytecode = True
import argparse,concurrent.futures,datetime as dt,importlib.util,json,math,pathlib,re,urllib.parse,urllib.request
spec=importlib.util.spec_from_file_location('metro_refresh',pathlib.Path(__file__).with_name('incident-refresh.py'));common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
ROOT=common.ROOT
SOURCE={'id':'city-crimemapping','name':'SLMPD public crime map','url':'https://slmpd.org/mapping/','mapUrl':'https://www.crimemapping.com/Share/66dfeeb3d9874dc78fdf8be1ad7f0c4c','cadence':'Updated daily; approvals can lag occurrence.','coverage':'City police public crime reports. Agency excludes domestic violence, sex crimes and juvenile-related offenses; homicides may appear late. Does not supply injury/death counts. Public-source exclusions are preserved.'}
CATEGORIES={1:'arson',2:'assault',3:'burglary',4:'disturbance',5:'drugs',6:'impaired driving',7:'fraud',8:'homicide',9:'vehicle theft',10:'robbery',12:'theft',13:'vandalism',14:'vehicle break-in',15:'weapons'}
def post(path,data):
 req=urllib.request.Request('https://www.crimemapping.com'+path,data=urllib.parse.urlencode(data).encode(),headers={'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json','User-Agent':'Andymap public-source maintenance/1.0'})
 with urllib.request.urlopen(req,timeout=35) as response:result=json.load(response)
 if isinstance(result,str):result=json.loads(result)
 if isinstance(result,dict) and (result.get('type')=='error' or result.get('sessionend')):raise RuntimeError(str(result.get('message') or 'Public feed unavailable'))
 return result

def filters_for(start,end):
 # Entire City, not the current app viewport. Agency is source selection, never a user toggle.
 xy=lambda lon,lat:[6378137*math.radians(lon),6378137*math.log(math.tan(math.pi/4+math.radians(lat)/2))]
 ring=[xy(-90.40,38.50),xy(-90.40,38.84),xy(-90.10,38.84),xy(-90.10,38.50),xy(-90.40,38.50)]
 spatial=json.dumps({'rings':[ring],'spatialReference':{'wkid':102100}})
 return {'SelectedCategories':list(CATEGORIES),'SpatialFilter':{'FilterType':2,'Filter':spatial},'TemporalFilter':{'PreviousID':'-1','PreviousNumDays':0,'PreviousName':'Custom Time Range','FilterType':'Explicit','ExplicitStartDate':start.strftime('%Y%m%d'),'ExplicitEndDate':end.strftime('%Y%m%d')},'AgencyFilter':[726]},spatial

def fetch_window(start,end):
 filters,spatial=filters_for(start,end)
 pins=post('/map/MapUpdated',{'filterdata':json.dumps(filters),'shareMapID':'','shareMapExtent':'','alertID':'','spatfilter':spatial}).get('result',{})
 if pins.get('st')==1:
  # Same bounded date controls as the public interface; never accept its truncated result.
  if start==end:raise RuntimeError('Daily City feed exceeds public map limit; manual review required')
  mid=start+(end-start)//2
  return fetch_window(start,mid)+fetch_window(mid+dt.timedelta(days=1),end)
 if pins.get('st') not in [0,3]:raise RuntimeError('City source reports incomplete/unavailable coverage')
 if not pins.get('nr'):return []
 report=post('/map/LoadReportJson',{'filter':json.dumps(filters),'coordx':-10046584,'coordy':4674540,'scale':150000,'showOffRecs':'false','mapType':1,'phneDevice':'false'})
 rows=report.get('CrimeIncidents',[])
 if len(rows)!=pins['nr'] or report.get('CrimeNumberRecords')!=len(rows):raise RuntimeError('City map/report count mismatch; snapshot not imported')
 positions={ident:(p['x'],p['y'],p['l']) for p in pins['rs'] for ident in p.get('i',[]) if ident.startswith('0_')}
 results=[]
 for row in rows:
  if row.get('Agency')!='St Louis Police':continue
  match=re.search(r"ReportMapIt\('([^']+)'\)",row.get('MapIt',''))
  if not match or match[1] not in positions:raise RuntimeError('Missing City report map position')
  x,y,_=positions[match[1]]
  # A coincident map pin can contain several categories (legend 0). Use each
  # report row's category, never the cluster's legend, or valid cases disappear.
  category_match=re.search(r'/Identify/(\d+)\.svg',row.get('Type',''))
  if not category_match:raise RuntimeError('Missing City report category')
  category=int(category_match[1])
  if category not in CATEGORIES:continue
  results.append({'report':str(row.get('IncidentNum') or ''),'date':str(row.get('Date') or ''),'offense':row.get('Description'),'address':row.get('Location'),'type':CATEGORIES[category],'longitude':math.degrees(x/6378137),'latitude':math.degrees(2*math.atan(math.exp(y/6378137))-math.pi/2)})
 return results

def convert(rows,checked):
 groups={};omitted=0
 for row in rows:
  try:
   local=dt.datetime.strptime(row['date'],'%Y%m%d%H%M%S').replace(tzinfo=common.LOCAL)
   ambiguous=local.utcoffset()!=local.replace(fold=1).utcoffset()
   stamp=local.date().isoformat() if ambiguous else local.isoformat()
  except (ValueError,KeyError):omitted+=1;continue
  geometry=common.point(row.get('longitude'),row.get('latitude'));report=row.get('report')
  if not geometry or not report:omitted+=1;continue
  key='incident:city-case:'+report;f=groups.get(key)
  if f:
   p=f['properties'];p['offenses']=sorted(set(p['offenses']+[row['offense']]));p['incidentTypes']=sorted(set(p['incidentTypes']+[row['type']]));continue
  address=common.masked_address(row['address']);primary=row['type']
  groups[key]={'type':'Feature','geometry':geometry,'properties':{'id':key,'title':primary.title()+' report · '+address,'incidentAt':stamp,'incidentDate':stamp[:10],'incidentTimeAccuracy':'reported local time','incidentKind':primary,'incidentTypes':[primary],'offenses':[row['offense']],'address':address+', St. Louis, MO','sourceId':'city-crimemapping','sourceCheckedAt':checked,'jurisdiction':'city','reportNumber':report,'reportingAgency':'SLMPD','locationAccuracy':'Source-masked block / intersection, rounded to about 100 m','color':'#c52f73'}}
  if ambiguous:groups[key]['properties'].update({'incidentLocalTime':local.strftime('%H:%M'),'incidentTimeAccuracy':'date-only','timeNote':'Reported local clock time; repeated fall-back hour has no UTC offset in source.'})
 return list(groups.values()),omitted

def refresh(days=30,now=None,fixture=None):
 now=now or dt.datetime.now(dt.timezone.utc);checked=now.isoformat();end=now.astimezone(common.LOCAL).date();start=end-dt.timedelta(days=days)
 if days>179:raise ValueError('City public source retains 180 days; do not request an unavailable window')
 if fixture:rows=json.loads(pathlib.Path(fixture).read_text())
 else:
  windows=[];day=start
  while day<=end:last=min(end,day+dt.timedelta(days=6));windows.append((day,last));day=last+dt.timedelta(days=1)
  rows=[]
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
   for batch in pool.map(lambda pair:fetch_window(*pair),windows):rows+=batch
 features,omitted=convert(rows,checked)
 meta={**SOURCE,'checkedAt':checked,'status':'ok','latestIncidentDate':max((f['properties']['incidentDate'] for f in features),default=None),'reviewWindowFrom':start.isoformat(),'rowsRetrieved':len(rows),'uniqueMappedReports':len(features),'omittedRows':omitted}
 return features,meta

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--days',type=int,default=30);parser.add_argument('--now');parser.add_argument('--fixture');args=parser.parse_args()
 now=dt.datetime.fromisoformat(args.now) if args.now else dt.datetime.now(dt.timezone.utc)
 if not now.tzinfo:now=now.replace(tzinfo=dt.timezone.utc)
 meta=json.loads((ROOT/'recent-incidents.json').read_text());old=meta.pop('features',[])
 for path in (ROOT/'incident-archive').glob('????-??.json'):old+=json.loads(path.read_text()).get('features',[])
 sources={s['id']:s for s in meta.get('sources',[])}
 try:features,health=refresh(args.days,now,args.fixture)
 except Exception as e:
  sources[SOURCE['id']]={**SOURCE,**sources.get(SOURCE['id'],{}),'status':'error','lastAttemptAt':now.isoformat(),'error':str(e)[:180]};meta['sources']=list(sources.values());common.publish_archive(common.merge_features(old,[]),meta,now);raise
 sources[SOURCE['id']]=health;meta['sources']=list(sources.values())
 reviewed=json.loads((ROOT/'incident-reviewed.json').read_text()).get('features',[]) if (ROOT/'incident-reviewed.json').exists() else []
 features=common.merge_features(old,features+reviewed)
 meta['coverageNote']='City and County are always shown together. City public reports update daily; County and participating municipal feeds update weekly. Agency exclusions and approval delays remain. These are reported incidents, not a complete regional census or safety ranking. Locations are approximate; unknown outcomes are not zero.'
 common.publish_archive(features,meta,now)
 print('City: '+str(health['rowsRetrieved'])+' public offense rows → '+str(health['uniqueMappedReports'])+' cases; latest '+str(health['latestIncidentDate'])+'. Total metro archive: '+str(len(features)))
if __name__=='__main__':main()
