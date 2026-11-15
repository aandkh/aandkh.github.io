#!/usr/bin/env python3
"""Refresh independent/local film screenings; Python standard library only.
Public Fever ticketing pages expose sessions in server-rendered JSON. Fetch only
those public pages, never internal endpoint names contained inside their state.
Blocked calendars retain dated, unexpired reviewed facts without re-verifying them.
"""
import concurrent.futures,datetime as dt,hashlib,html,json,re,urllib.parse,urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1]; TZ=ZoneInfo('America/Chicago')
NOW=dt.datetime.now(dt.timezone.utc); CHECKED=NOW.isoformat(); TODAY=NOW.astimezone(TZ).date()
# Owner exclusion: never fetch or re-import Galleria 6, including old snapshots.
THEATERS=['chase-park-plaza-cinemas']
def excluded_venue(p):
 return bool(re.search(r'galleria[\s-]*6',' '.join(str(p.get(k,'')) for k in ['venue','address','url','sourceUrl','refreshGroup']),re.I))
FEVER='https://feverup.com/movies/en/united-states/movie-theaters/'
SLSC='https://www.slsc.org/calendar-of-events/?tribe_events_cat=omnimax-theater&upcoming=1'
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Andymap public-calendar refresh (+https://www.andrewhanes.com)'}),timeout=22) as r:return r.read().decode('utf-8')
def read(name):
 try:return json.loads((ROOT/name).read_text())
 except (FileNotFoundError,json.JSONDecodeError):return {'features':[]}
def future(f):
 try:
  value=f['properties']['start'];start=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
  if len(value)==10:start=start.replace(tzinfo=TZ)+dt.timedelta(days=1)
  return start>NOW
 except (KeyError,TypeError,ValueError):return False
def feature(title,start,venue,coords,url,group,source,**extra):
 ident=hashlib.sha256((group+'|'+title+'|'+start).encode()).hexdigest()[:18]
 return {'type':'Feature','geometry':{'type':'Point','coordinates':coords},'properties':{'id':'screening:'+ident,'layer':'movies','title':title,'movieTitle':title,'start':start,'expiresAt':start,'venue':venue,'description':venue+' · Scheduled film screening','url':url,'sourceUrl':url,'source':source,'sourceCheckedAt':CHECKED,'refreshGroup':group,**extra}}
def fever_state(text):
 m=re.search(r'<script id="serverapp-state" type="application/json">(.*?)</script>',text,re.S)
 if not m:raise ValueError('Public page did not include theater state')
 return json.loads(m[1])
def parse_fever(text,slug,day):
 data=fever_state(text);venue=next((v for k,v in data.items() if '/countries/united-states/venues/' in k and isinstance(v,dict) and 'latitude' in v),None)
 sessions=next((v for k,v in data.items() if f'movie_sessions_for_date/{day}/' in k),None)
 if venue is None or sessions is None:raise ValueError('Date-specific sessions missing; refusing to relabel another date')
 result=[];url=FEVER+slug+'?date='+day
 for movie in sessions:
  for fmt in movie.get('screenFormatSessions',[]):
   for session in fmt.get('sessions',[]):
    if session.get('isExpired') or session.get('isSoldOut'):continue
    start=session.get('time','')
    if start[:10]!=day:continue
    extra={'address':venue['address'],'ticketSessionId':str(session['sessionId']),'screenFormat':fmt.get('screenFormat','')}
    runtime=movie.get('runtimeMinutes');rating=(movie.get('advisoryRating') or {}).get('title')
    if isinstance(runtime,(int,float)) and runtime>0:extra['runtimeMinutes']=runtime
    if rating and rating not in ['NR','Not Rated','Unrated']:extra['contentRating']=rating
    result.append(feature(movie['title'],start,venue['name'],[venue['longitude'],venue['latitude']],url,'fever:'+slug+':'+day,'Fever / theater ticketing schedule',**extra))
 return result

def parse_slsc(text):
 marker='eventSources:'
 if marker not in text:raise ValueError('Science Center calendar data missing')
 sources=json.JSONDecoder().raw_decode(text.split(marker,1)[1].lstrip())[0];result=[]
 for event in [e for batch in sources for e in batch if isinstance(e,dict)]:
  if not event.get('title','').startswith('OMNIMAX:'):continue
  # Include only source-explicit dated occurrences. Do not guess recurrence rules.
  start=event.get('start','');rules=json.loads(event.get('rset') or '[]')
  exclusions=[(r.get('EXDATE',{}).get('date') or '')[:10] for r in rules if r.get('type')=='EXDATE']
  if start[:10] in exclusions:continue
  title=html.unescape(event['title'].split(':',1)[1].strip());details=html.unescape(event.get('details',''))
  extra={'address':'5050 Oakland Ave, St. Louis, MO 63110','screenFormat':'OMNIMAX'}
  runtime=re.search(r'RUNTIME:\s*(?:Approx\.?\s*)?(\d+)\s*min',details,re.I)
  rating=re.search(r'RATING:\s*(G|PG-13|PG|R)\b',details,re.I)
  if runtime:extra['runtimeMinutes']=int(runtime[1])
  if rating:extra['contentRating']=rating[1].upper()
  result.append(feature(title,start,'Saint Louis Science Center OMNIMAX',[-90.2706523,38.6289444],event['permalink'],'slsc','Saint Louis Science Center official calendar',**extra))
 # The attraction page's upcoming widgets contain already-expanded occurrences.
 return result

def parse_slsc_upcoming(text):
 result=[]
 for link,body in re.findall(r'<a[^>]+href="([^"]*eventstart=[^"]*)"[^>]*>(.*?)</a>',text,re.S):
  clean=html.unescape(re.sub('<[^>]+>',' ',body));m=re.search(r'OMNIMAX:\s*([^\n]+)',clean)
  if not m:continue
  url=html.unescape(link);q=urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
  start=dt.datetime.fromtimestamp(int(q['eventstart'][0]),TZ).isoformat()
  result.append(feature(m[1].strip(),start,'Saint Louis Science Center OMNIMAX',[-90.2706523,38.6289444],url,'slsc-upcoming','Saint Louis Science Center official calendar',address='5050 Oakland Ave, St. Louis, MO 63110',screenFormat='OMNIMAX'))
 return result

def main():
 old=read('movie-screenings.json');features=list(read('movie-reviewed.json')['features']);health=[];successful=set();updates=[]
 jobs=[('fever:'+slug+':'+str(TODAY+dt.timedelta(days=i)),FEVER+slug+'?date='+str(TODAY+dt.timedelta(days=i)),lambda text,s=slug,d=str(TODAY+dt.timedelta(days=i)):parse_fever(text,s,d)) for slug in THEATERS for i in range(8)]
 jobs += [('slsc',SLSC,parse_slsc),('slsc-upcoming','https://www.slsc.org/attraction/omnimax-theater/',parse_slsc_upcoming)]
 def run(job):
  group,url,parse=job
  try:
   rows=parse(get(url));return group,rows,{'source':group,'url':url,'status':'ok','count':sum(future(f) for f in rows),'checkedAt':CHECKED}
  except Exception as e:return group,[],{'source':group,'url':url,'status':'failed','error':str(e)[:180],'attemptedAt':CHECKED}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for group,rows,status in pool.map(run,jobs):
   health.append(status)
   if status['status']=='ok':successful.add(group);updates+=rows
 for f in old.get('features',[]):
  group=f.get('properties',{}).get('refreshGroup','')
  if group and not group.startswith('reviewed:') and group not in successful:features.append(f)
 features+=updates;unique={}
 for f in features:
  if not future(f) or excluded_venue(f.get('properties',{})):continue
  p=f['properties'];key=(p.get('movieTitle',p['title']).casefold(),p.get('venue','').casefold(),p['start'])
  if key not in unique or len(p)>len(unique[key]['properties']):unique[key]=f
 features=sorted(unique.values(),key=lambda f:f['properties']['start'])
 if not features:raise SystemExit('No future verified screenings; not replacing snapshot')
 out={'type':'FeatureCollection','generatedAt':CHECKED,'coverage':'Partial independent/local cinema coverage across St. Louis City and County. Only published film screenings; no undated theater pins. OMNIMAX recurring schedules are partial.','sources':health,'features':features}
 (ROOT/'movie-screenings.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
 print(json.dumps({'screenings':len(features),'venues':sorted({f['properties']['venue'] for f in features}),'successfulSources':len(successful),'failedSources':sum(x['status']=='failed' for x in health)}))
if __name__=='__main__':main()
