#!/usr/bin/env python3
"""Precompute public-road touring routes and transparent geometry/terrain metrics.

Stdlib only. OSRM calls are serial and cached for 30 days. USGS samples are cached
indefinitely unless --refresh-elevation is requested. No visitor data is sent.
"""
import argparse, concurrent.futures, datetime as dt, hashlib, importlib.util, json, math, pathlib, statistics, time, urllib.parse, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cycling_geometry',ROOT/'scripts/cycling-refresh.py');geo=importlib.util.module_from_spec(spec);spec.loader.exec_module(geo)
ROUTER='https://router.project-osrm.org/route/v1/driving/'
USGS=geo.DEM
SOURCES={
 'forest':'https://www.forestparkforever.org/navigation',
 'city':'https://www.stlouis-mo.gov/government/departments/parks/parks/browse-parks/',
 'wildwood':'https://www.cityofwildwood.com/DocumentCenter/View/9604/Street-Guide-06132024',
 '94':'https://www.visitmo.com/articles/scenic-drives-on-highway-94',
 'river':'https://www.riversandroutes.com/things-to-do/road-trips/meeting-of-the-great-rivers/',
 'bluff':'https://www.greatriverroad-illinois.org/bluff-road',
 '66':'https://www.visitmo.com/itineraries/route-66-part-one',
 'county':'https://stlouiscountymo.gov/st-louis-county-departments/parks/places/',
}
# Waypoints are publicly named road/town locations selected by Andymap, then
# snapped by OSRM to its routable road graph. The snapped location and road name
# are saved for audit. Guides identify the area, not endorsement of these routes.
SEEDS=[
 ('forest-park','Forest Park parkway loop','Loop','St. Louis city','forest',[
  ('Grand Drive / visitor center',-90.2772,38.6458),('Fine Arts Drive',-90.2946,38.6395),('Wells Drive',-90.2859,38.6311),('McKinley Drive',-90.2714,38.6331),('Grand Drive east',-90.2674,38.6401),('Grand Drive / visitor center',-90.2772,38.6458)]),
 ('south-city','Tower Grove to Carondelet','One way','St. Louis city','city',[
  ('Tower Grove Park / Magnolia',-90.2543,38.6085),('South Grand at Gravois',-90.2498,38.5941),('South Grand at Meramec',-90.2506,38.5799),('Carondelet Park / Holly Hills',-90.2769,38.5642)]),
 ('lafayette-forest','Kingshighway · Forest Park to Tower Grove','One way','St. Louis city','city',[
  ('Kingshighway / Forest Park',-90.2647,38.6403),('Kingshighway / Manchester',-90.2665,38.6252),('Kingshighway / Tower Grove Park',-90.2731,38.6075)]),
 ('wild-horse','Wild Horse Creek road','One way','St. Louis County','wildwood',[
  ('Chesterfield / Wild Horse Creek',-90.5768,38.6659),('Wild Horse Creek valley',-90.6365,38.6437),('Wild Horse Creek west',-90.6776,38.6400),('Wild Horse Creek at Route 109',-90.6990,38.6336)]),
 ('wildwood-hills','Eureka to House Springs · Route W ridges','One way','St. Louis and Jefferson counties','county',[
  ('Eureka / Route 109',-90.6286,38.5000),('Route W north',-90.6375,38.4771),('Route W ridges',-90.6080,38.4430),('House Springs / Route W',-90.5760,38.4070)]),
 ('babler','Babler and Wildwood ridge loop','Loop','St. Louis County','wildwood',[
  ('Babler Park Drive approach',-90.6898,38.6288),('Route 109 north',-90.6990,38.6336),('Route 109 south',-90.6750,38.6034),('Clayton Road / Wildwood',-90.6304,38.6110),('Babler Park Drive approach',-90.6898,38.6288)]),
 ('route66','Pacific to Gray Summit · Route 66 country','One way','Franklin County','66',[
  ('Pacific / East Osage Street',-90.7190,38.4829),('Gray Summit / Route 100 east',-90.8100,38.4910),('Gray Summit / Route 100 west',-90.8310,38.4885)]),
 ('clayton-ladue','Clayton, Ladue and Creve Coeur','One way','St. Louis County','county',[
  ('Ladue Road east',-90.3411,38.6470),('Ladue Road / Warson',-90.3976,38.6560),('Ladue Road / Spoede',-90.4189,38.6540),('Ladue Road / New Ballas',-90.4467,38.6529),('Ladue Road / Mason',-90.4757,38.6557)]),
 ('south-county','South County river-bluff road','One way','St. Louis County','county',[
  ('Jefferson Barracks / Broadway',-90.2884,38.5149),('Telegraph at Jefferson Barracks',-90.2937,38.5075),('Telegraph / Forder',-90.3016,38.4837),('Telegraph / Cliff Cave',-90.3076,38.4549),('Telegraph / Christopher',-90.3257,38.4308)]),
 ('94-defiance','Highway 94 · Weldon Spring to Defiance','One way','St. Charles County','94',[
  ('Weldon Spring / Highway 94 west',-90.7280,38.6900),('Defiance / Highway 94',-90.7734,38.6327)]),
 ('94-augusta','Highway 94 · Defiance to Augusta','One way','St. Charles County','94',[
  ('Defiance / Highway 94',-90.7734,38.6327),('Matson / Highway 94',-90.8185,38.6105),('Augusta / Highway 94',-90.8821,38.5726)]),
 ('94-dutzow','Highway 94 · Augusta to Dutzow','One way','St. Charles County and Warren County','94',[
  ('Augusta / Highway 94',-90.8821,38.5726),('Highway 94 west of Augusta',-90.9302,38.5910),('Dutzow / Highway 94',-90.9990,38.6031)]),
 ('north94','Highway 94 · St. Charles to Portage des Sioux','One way','St. Charles County','94',[
  ('North Second Street / St. Charles',-90.4765,38.8024),('Highway 94 / Orchard Farm',-90.4587,38.9138),('Route J / Highway 94',-90.3429,38.9150),('Portage des Sioux / Main Street',-90.3415,38.9260)]),
 ('river-alton','Great River Road · Alton to Grafton','One way','Madison and Jersey counties, Illinois','river',[
  ('Alton / Broadway',-90.1851,38.8914),('Great River Road / Elsah',-90.3592,38.9511),('Grafton / Main Street',-90.4314,38.9701)]),
 ('river-pere','Great River Road · Grafton to Pere Marquette','One way','Jersey County, Illinois','river',[
  ('Grafton / Main Street',-90.4314,38.9701),('Great River Road west of Grafton',-90.4824,38.9821),('Pere Marquette / Route 100',-90.5412,38.9724)]),
 ('bluff-road','Bluff Road · Columbia to Old Valmeyer','One way','Monroe County, Illinois','bluff',[
  ('Columbia / Palmer Road',-90.2201,38.4371),('Bluff Road / Fountain',-90.2544,38.3868),('Bluff Road / Old Valmeyer',-90.3114,38.3020)]),
]

ROAD_MATCHES={
 'forest-park':['Grand Drive','Fine Arts Drive','Wells Drive','McKinley Drive','Grand Drive','Grand Drive'],
 'south-city':['Magnolia Avenue','South Grand Boulevard','South Grand Boulevard','Holly Hills Boulevard'],
 'lafayette-forest':['South Kingshighway Boulevard']*3,
 'wild-horse':['Wild Horse Creek Road']*4,
 'wildwood-hills':['MO 109','MO W','MO W','MO W'],
 'babler':['Babler Park Drive','MO 109','MO 109','Clayton Road','Babler Park Drive'],
 'route66':['East Osage Street','MO 100','MO 100'],
 'clayton-ladue':['Ladue Road']*5,
 'south-county':['South Broadway','Telegraph Road','Telegraph Road','Telegraph Road','Telegraph Road'],
 '94-defiance':['MO 94']*2,'94-augusta':['MO 94']*3,'94-dutzow':['MO 94']*3,
 'north94':['North Second Street','MO 94','MO 94','Main Street'],
 'river-alton':['Broadway','IL 100','IL 100'],
 'river-pere':['IL 100']*3,'bluff-road':['Palmer Road','Bluff Road','Bluff Road'],
}
def select_road_points(seeds,roadways):
 records=roadways.get('elements',[]);output=[]
 for slug,title,kind,area,source,waypoints in seeds:
  chosen=[]
  for w,expected in zip(waypoints,ROAD_MATCHES[slug]):
   candidates=[]
   for f in records:
    tags=f.get('tags',{});name=tags.get('name','');refs=tags.get('ref','').split(';')
    match=name==expected or expected in refs or expected.split()[-1] in refs and expected.startswith(('MO ','IL ')) or expected=='Broadway' and name in ['West Broadway','East Broadway']
    if not match or tags.get('access') in ['private','no'] or tags.get('motor_vehicle') in ['private','no'] or tags.get('highway') in ['footway','cycleway','path','steps','service']:continue
    for c in f.get('geometry',[]):
     coord=[c['lon'],c['lat']];candidates.append((geo.meters([w[1],w[2]],coord),coord,f['id']))
   if not candidates:raise RuntimeError('No public OSM road geometry for '+expected)
   distance,coord,way_id=min(candidates)
   if distance>3500:raise RuntimeError(f'{slug} {expected}: named road more than 3.5 km from intended waypoint')
   chosen.append((w[0],coord[0],coord[1],expected,way_id))
  output.append((slug,title,kind,area,source,chosen))
 return output

def get(url,timeout=50):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Andymap-road-research/1.0 (+https://www.andrewhanes.com)','Referer':'https://www.andrewhanes.com/'}),timeout=timeout) as r:return json.load(r)
def bearing(a,b):
 lat1,lat2=map(math.radians,[a[1],b[1]]);d=math.radians(b[0]-a[0]);return math.degrees(math.atan2(math.sin(d)*math.cos(lat2),math.cos(lat1)*math.sin(lat2)-math.sin(lat1)*math.cos(lat2)*math.cos(d)))
def delta(a,b):return (a-b+180)%360-180
def cumulative(points):
 out=[0]
 for a,b in zip(points,points[1:]):out.append(out[-1]+geo.meters(a,b))
 return out
def shape_metrics(line):
 points=geo.sample(line,50);dist=cumulative(points);headings=[bearing(a,b) for a,b in zip(points,points[1:])]
 turns=[abs(delta(a,b)) for a,b in zip(headings,headings[1:])]
 turning=sum(v for v in turns if v>=3);length=dist[-1]
 # Count discrete groups of appreciable directional change, including junctions.
 groups=[];current=0
 for angle in turns+[0]:
  if angle>=5:current+=angle
  else:
   if current>=30:groups.append(current)
   current=0
 # Longest run whose bearings stay within 12 degrees of its first bearing and
 # whose samples stay within 30 metres of the start-to-end line. A geometric
 # straight may contain intersections, crossings, signals and access points.
 best=(0,0,0)
 for start in range(len(headings)):
  reference=headings[start]
  for end in range(start+1,len(headings)+1):
   if abs(delta(headings[end-1],reference))>12:break
   if end-start>1:
    chord=bearing(points[start],points[end]);deviation=max(abs(math.sin(math.radians(delta(bearing(points[start],points[k]),chord)))*geo.meters(points[start],points[k])) for k in range(start+1,end))
    if deviation>30:break
   run=dist[end]-dist[start]
   if run>best[0]:best=(run,start,end)
 return {'directionChangeDegPerMile':round(turning/max(length/1609.344,.01),1),'directionChangeCount':len(groups),'longestStraightMiles':round(best[0]/1609.344,2),'straightSegment':{'startMile':round(dist[best[1]]/1609.344,2),'endMile':round(dist[best[2]]/1609.344,2),'coordinates':points[best[1]:best[2]+1]}}
def terrain_metrics(points,values):
 good=[v for v in values if v is not None];coverage=len(good)/max(1,len(values));out={'terrainSampleCoverage':round(coverage,3)}
 # Every sample must be present for cumulative climb or sustained-grade claims.
 if coverage<1 or len(good)<4:return out
 smooth=[statistics.median(values[max(0,i-1):i+2]) for i in range(len(values))];dist=cumulative(points)
 profile=[[round(d/1609.344,3),round(v*3.28084)] for d,v in zip(dist,smooth)]
 # Three-metre vertical hysteresis prevents summing sub-resolution DEM chatter.
 climbs=descents=0;anchor=smooth[0];direction=0;extreme=anchor
 for v in smooth[1:]+[smooth[-1]]:
  if direction>=0:
   if v>=extreme:extreme=v
   elif extreme-v>=3:climbs+=max(0,extreme-anchor);anchor=extreme;extreme=v;direction=-1
  if direction<=0:
   if v<=extreme:extreme=v
   elif v-extreme>=3:descents+=max(0,anchor-extreme);anchor=extreme;extreme=v;direction=1
 if extreme>=anchor:climbs+=extreme-anchor
 else:descents+=anchor-extreme
 best=(0,0,0,0)
 for i in range(len(points)):
  for j in range(i+1,min(i+6,len(points))):
   span=dist[j]-dist[i]
   if span<590:continue
   grade=100*(smooth[j]-smooth[i])/span
   if abs(grade)>best[0]:best=(abs(grade),i,j,grade)
   break
 out.update(terrainLowFt=round(min(good)*3.28084),terrainHighFt=round(max(good)*3.28084),terrainRangeFt=round((max(good)-min(good))*3.28084),climbFt=round(climbs*3.28084),descentFt=round(descents*3.28084),netElevationFt=round((smooth[-1]-smooth[0])*3.28084),elevationProfile=profile,steepestSustainedPct=round(best[0],1),steepestSegment={'startMile':round(dist[best[1]]/1609.344,2),'endMile':round(dist[best[2]]/1609.344,2),'signedGradePct':round(best[3],1),'coordinates':points[best[1]:best[2]+1]},terrainSampleCount=len(good))
 return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--cache-dir',default='/tmp/andymap-joyrides-cache');ap.add_argument('--roadways-cache',help='OSM Overpass way geometry used to select exact named-road waypoints');ap.add_argument('--refresh-routes',action='store_true');ap.add_argument('--refresh-elevation',action='store_true');ap.add_argument('--skip-elevation',action='store_true');args=ap.parse_args();cache=pathlib.Path(args.cache_dir);cache.mkdir(parents=True,exist_ok=True)
 now=dt.datetime.now(dt.timezone.utc).isoformat();target=ROOT/'joyrides.json'
 try:old={f['properties']['id']:f for f in json.loads(target.read_text()).get('features',[])}
 except (OSError,ValueError,KeyError):old={}
 records=[];allpoints={};terrainkeys=['terrainSampleCoverage','terrainLowFt','terrainHighFt','terrainRangeFt','climbFt','descentFt','netElevationFt','elevationProfile','steepestSustainedPct','steepestSegment','terrainSampleCount','elevationCheckedAt']
 if args.roadways_cache:seeds=select_road_points(SEEDS,json.loads(pathlib.Path(args.roadways_cache).read_text()))
 else:
  # Audit-approved snapped public-road waypoints persist in the shipped snapshot.
  seeds=[]
  for slug,title,kind,area,source,waypoints in SEEDS:
   previous=old.get('joyrides:'+slug);saved=previous['properties'].get('waypoints',[]) if previous else []
   if not saved or not all(w.get('osmWayId') for w in saved):raise RuntimeError('Initial build requires --roadways-cache with named OSM road geometry')
   seeds.append((slug,title,kind,area,source,[(w['name'],*w['requested'],w['intendedRoad'],w['osmWayId']) for w in saved]))
 for slug,title,kind,area,source,waypoints in seeds:
  coords=';'.join(f'{w[1]},{w[2]}' for w in waypoints);url=ROUTER+coords+'?'+urllib.parse.urlencode({'overview':'full','geometries':'geojson','steps':'true'});path=cache/(slug+'-'+hashlib.sha256(url.encode()).hexdigest()[:10]+'.json');previous=old.get('joyrides:'+slug)
  try:
   if path.exists() and not args.refresh_routes and time.time()-path.stat().st_mtime<2592000:response=json.loads(path.read_text());routechecked=dt.datetime.fromtimestamp(path.stat().st_mtime,dt.timezone.utc).isoformat()
   elif previous and not args.refresh_routes and not args.refresh_elevation and previous['properties'].get('terrainSampleCoverage')==1 and time.time()-dt.datetime.fromisoformat(previous['properties']['routeCheckedAt']).timestamp()<2592000:
    # The checked-in complete snapshot is also a persistent route cache.
    records.append({**previous,'properties':{**previous['properties'],'sourceCheckedAt':previous['properties']['routeCheckedAt']},'_reuse':True});continue
   else:
    response=get(url);time.sleep(1.1)
    if response.get('code')!='Ok':raise RuntimeError(response.get('message',response.get('code')))
    path.write_text(json.dumps(response));routechecked=now
   if response.get('code')!='Ok' or len(response.get('routes',[]))!=1:raise RuntimeError('Invalid route response')
   r=response['routes'][0];line=[[round(c[0],6),round(c[1],6)] for c in r['geometry']['coordinates']]
   if any(w.get('distance',9999)>75 for w in response['waypoints']):raise RuntimeError('Waypoint too far from the named OSM road')
   steps=[s for leg in r['legs'] for s in leg['steps']]
   if any(s.get('mode')!='driving' for s in steps):raise RuntimeError('Ferry / non-driving route rejected')
   roads=[]
   for s in steps:
    name=s.get('name') or s.get('ref')
    if name and name not in roads:roads.append(name)
   samples=geo.sample(line,200);geometry={'type':'LineString','coordinates':geo.simplified(line,.000025)}
   p={'id':'joyrides:'+slug,'title':title,'description':f'{kind} through {area}.','routeKind':kind,'area':area,'routeMiles':round(r['distance']/1609.344,2),'routeMinutes':round(r['duration']/60),'routeCheckedAt':routechecked,'sourceCheckedAt':now,'source':'OpenStreetMap / OSRM · USGS 3DEP','sourceUrl':'https://www.openstreetmap.org/copyright','url':SOURCES[source],'guideUrl':SOURCES[source],'geometrySourceUrl':url,'waypoints':[{'name':w[0],'requested':[w[1],w[2]],'location':s['location'],'road':s.get('name',''),'snapDistanceM':round(s['distance'])} for w,s in zip(waypoints,response['waypoints'])],'roadNames':roads,'routingNote':'OSRM driving estimate; excludes live traffic, stops and parking. The named route is an Andymap selection, not an official signed itinerary.','accessNote':'Mapped driving roads; closures, access hours and local restrictions can change. Check Traffic and posted signs.','terrainMethod':'USGS bare-earth elevation sampled every 200 m, median-smoothed over three samples. Estimated climb uses 3 m vertical hysteresis. Sustained grade compares samples at least 590 m apart. Bridges and tunnels can differ from ground; these are terrain estimates, not surveyed road grades.','shapeMethod':'Road shape sampled every 50 m. Turning intensity sums heading changes of at least 3° per mile, including junctions. Direction-change groups total at least 30°. A straight stays within 12° of its initial bearing and 30 m of its chord. Intersections and signals can occur anywhere; these metrics do not assess safety or suitable speed.'}
   p['sourceCheckedAt']=routechecked
   for wp,seed in zip(p['waypoints'],waypoints):wp.update(intendedRoad=seed[3],osmWayId=seed[4],osmUrl='https://www.openstreetmap.org/way/'+str(seed[4]))
   p.update(shape_metrics(line));reuse=previous and previous['geometry']==geometry and previous['properties'].get('terrainSampleCoverage')==1 and not args.refresh_elevation
   if reuse:
    for k in terrainkeys:
     if k in previous['properties']:p[k]=previous['properties'][k]
   else:
    for c in samples:allpoints[','.join(map(str,c))]=c
   records.append({'type':'Feature','geometry':geometry,'properties':p,'_samples':samples,'_reuse':bool(reuse)})
   print(slug,round(p['routeMiles'],1),'mi',p['routeMinutes'],'min',' | '.join(roads[:10]),flush=True)
  except Exception as e:
   if previous:records.append({**previous,'_reuse':True});print('Preserved prior route',slug,str(e),flush=True)
   else:raise RuntimeError(f'{slug}: {e}') from e
 points=list(allpoints.values());batches=[points[i:i+60] for i in range(0,len(points),60)];elevations={}
 def dem(coords):
  path=cache/('dem-'+hashlib.sha256(json.dumps(coords).encode()).hexdigest()+'.json')
  if path.exists() and not args.refresh_elevation:return json.loads(path.read_text())
  url=USGS+'?'+urllib.parse.urlencode({'f':'json','geometryType':'esriGeometryMultipoint','geometry':json.dumps({'points':coords,'spatialReference':{'wkid':4326}},separators=(',',':')),'returnFirstValueOnly':'true','outFields':''})
  for attempt in range(2):
   try:
    answer={}
    for s in get(url,60).get('samples',[]):
     idx=s.get('locationId');v=float(s.get('value','nan'))
     if isinstance(idx,int) and 0<=idx<len(coords) and math.isfinite(v) and -100<v<2000:answer[','.join(map(str,coords[idx]))]=v
    if len(answer)==len(coords):path.write_text(json.dumps(answer))
    return answer
   except Exception as e:
    if attempt:print('DEM unavailable:',str(e)[:100],flush=True);return {}
  return {}
 print('Terrain requests',len(batches),'for',len(points),'samples',flush=True)
 if not args.skip_elevation:
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
   for i,result in enumerate(pool.map(dem,batches)):elevations.update(result);print('DEM',i+1,'/',len(batches),flush=True)
 for f in records:
  reuse=f.pop('_reuse',False);samples=f.pop('_samples',[])
  if not reuse:
   f['properties'].update(terrain_metrics(samples,[elevations.get(','.join(map(str,c))) for c in samples]))
   if f['properties'].get('terrainSampleCoverage')==1:f['properties']['elevationCheckedAt']=now
 if len(records)!=len(SEEDS):raise RuntimeError('Incomplete catalog; preserve previous snapshot')
 out={'type':'FeatureCollection','status':'reference','checkedAt':min(f['properties']['sourceCheckedAt'] for f in records),'generatedAt':now,'source':'OpenStreetMap / OSRM / USGS','note':'Curated regional drives with precomputed road-shape and ground-terrain estimates. Live traffic and closures are separate.','attribution':'© OpenStreetMap contributors · OSRM routing · USGS 3DEP','features':records};tmp=target.with_suffix('.json.tmp');tmp.write_text(json.dumps(out,separators=(',',':'))+'\n');tmp.replace(target)
 print('Saved',len(records),'routes;',sum(f['properties'].get('terrainSampleCoverage')==1 for f in records),'complete terrain profiles;',target.stat().st_size,'bytes')
if __name__=='__main__':main()
