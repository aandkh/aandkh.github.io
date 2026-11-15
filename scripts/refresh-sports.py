#!/usr/bin/env python3
"""Refresh official local home schedules. Python standard library only."""
import concurrent.futures,datetime as dt,hashlib,html,json,re,urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1];TZ=ZoneInfo('America/Chicago');NOW=dt.datetime.now(dt.timezone.utc);CHECKED=NOW.isoformat()
SEASON=NOW.year if NOW.month>=7 else NOW.year-1
VENUES={'busch':('Busch Stadium',[-90.1928,38.6226],'700 Clark Ave, St. Louis, MO 63102'),'chaifetz':('Chaifetz Arena',[-90.2282,38.6327],'1 S Compton Ave, St. Louis, MO 63103'),'hyland':('Robert F. Hyland Arena',[-90.50352,38.78912],'209 S Kingshighway St, St. Charles, MO 63301'),'enterprise':('Enterprise Center',[-90.201951,38.625988],'1401 Clark Ave, St. Louis, MO 63103')}
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Andymap public-calendar refresh (+https://www.andrewhanes.com)'}),timeout=22) as r:return r.read().decode('utf-8')
def read(name):
 try:return json.loads((ROOT/name).read_text())
 except (FileNotFoundError,json.JSONDecodeError):return {'features':[]}
def future(f):
 try:
  start=f['properties']['start'];end=dt.datetime.fromisoformat(start.replace('Z','+00:00'))
  if len(start)==10:end=end.replace(tzinfo=TZ)+dt.timedelta(days=1)
  return end>NOW
 except (KeyError,TypeError,ValueError):return False

def feature(group,title,start,venue,url,sport,**extra):
 name,coords,address=VENUES[venue];ident=hashlib.sha256((group+'|'+title+'|'+start).encode()).hexdigest()[:18]
 expires=start if len(start)>10 else (dt.datetime.fromisoformat(start).replace(tzinfo=TZ)+dt.timedelta(days=1)).isoformat()
 return {'type':'Feature','geometry':{'type':'Point','coordinates':coords},'properties':{'id':'sports:'+ident,'layer':'sports','title':title,'start':start,'expiresAt':expires,'venue':name,'address':address,'sport':sport,'description':sport+' · '+name,'url':url,'sourceUrl':url,'source':'Official team schedule','sourceCheckedAt':CHECKED,'refreshGroup':group,**extra}}

def parse_mlb(text,url):
 result=[]
 for date in json.loads(text).get('dates',[]):
  for game in date['games']:
   if game['teams']['home']['team']['id']!=138 or game.get('venue',{}).get('id')!=2889:continue
   status=game.get('status',{})
   if status.get('abstractGameState')=='Final' or re.search('cancel|postpon',status.get('detailedState',''),re.I):continue
   start=game['officialDate'] if status.get('startTimeTBD') else game['gameDate']
   result.append(feature('mlb:cardinals','Cardinals vs. '+game['teams']['away']['team']['name'],start,'busch','https://www.mlb.com/gameday/'+str(game['gamePk']),'Baseball',team='St. Louis Cardinals',sourceUrl=url,sourceId=str(game['gamePk']),timeTBA=bool(status.get('startTimeTBD'))))
 return result

def parse_sidearm(text,group,team,venue,url):
 records=[]
 for raw in re.findall(r'<script[^>]*type=[\"\']application/ld\+json[\"\'][^>]*>(.*?)</script>',text,re.S):
  try:data=json.loads(raw)
  except json.JSONDecodeError:continue
  if isinstance(data,list):records.extend(x for x in data if x.get('@type')=='SportsEvent')
 if not records:raise ValueError('Official schedule has no structured sports events')
 result=[];name=VENUES[venue][0]
 for event in records:
  if name not in event.get('location',{}).get('name',''):continue
  if re.search('cancel|postpon',event.get('eventStatus') or '',re.I):continue
  value=event.get('startDate','');parsed=dt.datetime.fromisoformat(value)
  # Sidearm emits home-local wall time. A midnight placeholder means time TBA.
  tba=parsed.hour==parsed.minute==parsed.second==0
  start=parsed.date().isoformat() if tba else parsed.replace(tzinfo=TZ).isoformat()
  opponent=event.get('awayTeam',{}).get('name','').strip()
  if not opponent:continue
  result.append(feature(group,team+' vs. '+html.unescape(opponent),start,venue,url,'Basketball',team=team,timeTBA=tba))
 return result

def parse_nhl(text,url):
 data=json.loads(text);result=[]
 if not isinstance(data.get('games'),list):raise ValueError('NHL games missing')
 for game in data['games']:
  if game.get('homeTeam',{}).get('abbrev')!='STL' or game.get('gameState') in ['OFF','FINAL']:continue
  opponent=game['awayTeam'].get('placeName',{}).get('default') or game['awayTeam']['abbrev']
  result.append(feature('nhl:blues','Blues vs. '+opponent,game['startTimeUTC'],'enterprise','https://www.nhl.com/blues/schedule','Hockey',team='St. Louis Blues',sourceUrl=url,sourceId=str(game['id'])))
 return result

def main():
 end=(NOW.date()+dt.timedelta(days=365)).isoformat();mlb=f'https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=138&startDate={NOW.date()}&endDate={end}'
 nhl=f'https://api-web.nhle.com/v1/club-schedule-season/STL/{SEASON}{SEASON+1}'
 jobs=[('mlb:cardinals',mlb,lambda t:parse_mlb(t,mlb)),('nhl:blues',nhl,lambda t:parse_nhl(t,nhl))]
 for domain,slug,team,venue,group in [('slubillikens.com','mens-basketball','SLU men','chaifetz','slu:men'),('slubillikens.com','womens-basketball','SLU women','chaifetz','slu:women'),('lindenwoodlions.com','mens-basketball','Lindenwood men','hyland','lindenwood:men'),('lindenwoodlions.com','womens-basketball','Lindenwood women','hyland','lindenwood:women')]:
  url=f'https://{domain}/sports/{slug}/schedule/{SEASON}-{str(SEASON+1)[-2:]}'
  jobs.append((group,url,lambda t,g=group,n=team,v=venue,u=url:parse_sidearm(t,g,n,v,u)))
 def run(job):
  group,url,parse=job
  try:
   rows=parse(get(url));return group,rows,{'source':group,'url':url,'status':'ok','count':sum(future(f) for f in rows),'checkedAt':CHECKED}
  except Exception as e:return group,[],{'source':group,'url':url,'status':'failed','error':str(e)[:180],'attemptedAt':CHECKED}
 rows=[];health=[];success=set()
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for group,events,status in pool.map(run,jobs):
   health.append(status)
   if status['status']=='ok':rows+=events;success.add(group)
 for f in read('sports-reviewed.json')['features']:
  if f['properties'].get('refreshGroup') not in success:rows.append(f)
 for f in read('sports-events.json')['features']:
  if f['properties'].get('refreshGroup') not in success:rows.append(f)
 unique={}
 for f in rows:
  if future(f):unique[(f['properties']['title'],f['properties']['start'])]=f
 features=sorted(unique.values(),key=lambda f:f['properties']['start'])
 if not features:raise SystemExit('No verified future home games; snapshot unchanged')
 out={'type':'FeatureCollection','generatedAt':CHECKED,'coverage':'Published local home schedules, including Cardinals, Blues, CITY SC and college basketball. Partial regional coverage; times may change.','sources':health,'features':features}
 (ROOT/'sports-events.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
 print(json.dumps({'games':len(features),'teams':sorted({f['properties'].get('team') for f in features}),'successfulSources':len(success),'failedSources':sum(x['status']=='failed' for x in health)}))
if __name__=='__main__':main()
