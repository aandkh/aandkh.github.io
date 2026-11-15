"""Refresh direct comedy calendars; merge reviewed mixed-venue events separately.
Requires beautifulsoup4. Usage: python scripts/refresh-venue-events.py [--snapshot-dir DIR]
Failures keep the last known snapshot; expired shows are filtered by the client.
"""
import argparse, datetime as dt, gzip, hashlib, json, re
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
ZONE=ZoneInfo('America/Chicago')
NOW=dt.datetime.now(dt.timezone.utc)
SOURCES={
 'helium':('https://st-louis.heliumcomedy.com/events','Helium Comedy Club',[-90.3491,38.6357],'1151 Saint Louis Galleria, Richmond Heights, MO'),
 'funny':('https://stlouisfunnybone.com/events','Westport Funny Bone',[-90.4477,38.7010],'614 West Port Plaza, St. Louis, MO'),
}
def feature(key,title,start,url):
 source,venue,coords,address=SOURCES[key]
 end=start.astimezone(ZONE).replace(hour=0,minute=0,second=0,microsecond=0)+dt.timedelta(days=1)
 return {'type':'Feature','geometry':{'type':'Point','coordinates':coords},'properties':{
 'id':f'venue-comedy:{key}:{hashlib.sha256(url.encode()).hexdigest()[:16]}:{start.isoformat()}', 'title':title.removeprefix('Special Event: ').strip(),
 'start':start.isoformat(),'expiresAt':end.isoformat(),'description':f'{venue} · Check the official listing for tickets, admission requirements and changes.',
 'address':f'{venue}, {address}','source':f'Official {venue} calendar','sourceUrl':source,'url':url,'sourceCheckedAt':NOW.isoformat(),'venueSource':key}}
def extract(key,html):
 soup=BeautifulSoup(html,'html.parser');out=[]
 if key=='helium':
  for tag in soup.select('script[type="application/ld+json"]'):
   for e in json.loads(tag.string).get('Events',[]):
    if any(word in e['name'].lower() for word in ['bingo','academy','workshop']):continue
    out.append(feature(key,e['name'],dt.datetime.fromisoformat(e['startDate'].replace('Z','+00:00')),e['url']))
 else:
  for card in soup.select('.schedule'):
   title=card.select_one('h3').get_text(' ',strip=True)
   for row in card.select('.performanceRow'):
    raw=row.select_one('.performanceDate').get_text(' ',strip=True).split(', ',1)[-1].title()
    day=dt.datetime.strptime(raw,'%B %d').replace(year=NOW.astimezone(ZONE).year)
    if day.month<NOW.astimezone(ZONE).month:day=day.replace(year=day.year+1)
    time=re.search(r'Show:\s*(\d+:\d+\s*[AP]M)',row.select_one('.performanceTime').get_text(' ',strip=True))
    if not time:continue
    clock=dt.datetime.strptime(time[1],'%I:%M %p').time();start=dt.datetime.combine(day.date(),clock,ZONE)
    out.append(feature(key,title,start,row.select_one('.performanceTicketBtn')['href']))
 if not out:raise ValueError(f'{key}: no shows parsed; keep previous records')
 return out
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--snapshot-dir');args=parser.parse_args()
 path=ROOT/'comedy-calendar.json';data=json.loads(path.read_text()) if path.exists() else {'features':[]}
 for key,(url,*_) in SOURCES.items():
  try:
   raw=Path(args.snapshot_dir,f'{key}.html').read_bytes() if args.snapshot_dir else urlopen(Request(url,headers={'User-Agent':'Andymap calendar refresh'}),timeout=30).read()
   if raw[:2]==b'\x1f\x8b':raw=gzip.decompress(raw)
   shows=extract(key,raw)
   data['features']=[f for f in data['features'] if f['properties'].get('venueSource')!=key]+shows
   print(key,len(shows))
  except Exception as error:print(f'WARNING: {key}: {error}')
 data['features']=[f for f in data['features'] if dt.datetime.fromisoformat(f['properties']['expiresAt'].replace('Z','+00:00'))>NOW]
 data['note']='Official venue calendar snapshots. Partial regional coverage; verify changes with the venue. Separate performances are retained.'
 path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
