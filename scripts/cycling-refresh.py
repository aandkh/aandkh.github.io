#!/usr/bin/env python3
"""Refresh public GRG completed greenways and precompute USGS terrain samples.
No visitor's location is used. Geometry/DEM calls occur during refresh, not browsing.
"""
import argparse, concurrent.futures, datetime as dt, hashlib, json, math, pathlib, time, urllib.parse, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
GRG='https://maps2.civildesigninc.com/arcgis/rest/services/GreatRiversGreenway/GRG_All_Projects_ReadOnly/FeatureServer/0'
DEM='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples'
PUBLIC_MAP='https://greatrivers.maps.arcgis.com/apps/instant/sidebar/index.html?appid=c74447caca8d4e3aa75441af79f1373f'
SEEDS=[
 ('gravois',"Gravois Greenway · Grant’s Trail",['117','X117','118A','118'],'Paved rail-trail corridor between Kirkwood and River des Peres.', 'gravois-greenway-grants-trail-river-des-peres-greenway-to-holmes-leffingwell'),
 ('river-des-peres','River des Peres Greenway',['181','256','204','115','236','234','X235'],'River des Peres corridor and its Christy and Carondelet connections.',None),
 ('riverfront','Mississippi Greenway · Riverfront Trail',['X108','004','108A'],'Riverfront corridor from downtown toward Chain of Rocks Park. Some levee sections are shared with authorized vehicles.','mississippi-greenway-chouteau-riverfront-to-old-chain-of-rocks-bridge-riverfront-trail'),
 ('centennial-city','Centennial Greenway · Forest Park to Delmar',['601'],'Urban greenway connecting the Forest Park / Washington University area to Delmar.',None),
 ('st-vincent-south','St. Vincent Greenway · Forest Park to Trojan Park',['191','187A'],'Connected greenway sections between Forest Park, Wellston and Trojan Park.',None),
 ('st-vincent-north','St. Vincent Greenway · Rock Road to North Hanley',['189','187D'],'Greenway through St. Vincent County Park and the UMSL / Metro corridor.',None),
 ('brickline-cortex','Brickline Greenway · Cortex',['305'],'Completed Boyle Avenue–Sarah Avenue section. A short urban connection.',None),
 ('brickline-market','Brickline Greenway · Mill Creek Valley',['308C','308G'],'Completed Mill Creek Valley and stadium-area sections along Market Street.',None),
 ('deer-creek','Deer Creek Greenway',['243','195','287'],'Mapped greenway sections through Deer Creek Park, Lorraine Davis Park and the Marshall Road corridor.',None),
 ('cliff-cave','Mississippi Greenway · Cliff Cave',['173','X173'],'Cliff Cave County Park trail network and connection toward Telegraph Road.',None),
 ('jefferson-barracks','Mississippi Greenway · Jefferson Barracks',['207'],'River des Peres to Jefferson Barracks corridor.',None),
 ('fee-fee','Fee Fee Greenway',['269','222'],'McKelvey Woods / Aquaport corridor toward Creve Coeur Lake Memorial Park.',None),
 ('shaw-olive','Centennial Greenway · Shaw Park to Olive',['603','599D','599A','599C'],'Completed Shaw Park–Olive corridor and nearby completed greenway connections.',None),
 ('monarch','Missouri Greenway · Monarch Chesterfield Levee',['169','006'],'Chesterfield Valley levee trail network. Exposed sections offer little shade.', 'missouri-greenway-monarch-chesterfield-levee'),
 ('earth-city','Missouri Greenway · Earth City Levee',['208'],'Levee greenway north of Earth City.',None),
 ('sunset','Sunset Greenway · Florissant',['135'],'Old Town Florissant to the Missouri River corridor.',None),
 ('maline','Maline Greenway · Bella Fontaine',['286','261'],'Bella Fontaine Park greenway and creek crossings.',None),
 ('meramec-kirkwood','Meramec Greenway · Arnold’s Grove to Greentree',['158','344'],'Valley Park–Kirkwood river corridor with the I-44 bike/pedestrian connection.',None),
 ('meramec-fenton','Meramec Greenway · Unger to Winter Park',['247'],'Fenton river corridor. Check the official map for work at Unger Park.',None),
 ('lower-meramec','Meramec Greenway · Lower Meramec Park',['206'],'Greenway within Lower Meramec County Park.',None),
 ('al-foster','Meramec Greenway · Al Foster / Sherman Beach',['211,212','945032'],'Meramec river trail corridor near Sherman Beach. Surface and access vary by section.',None),
 ('eureka','Meramec Greenway · Eureka',['163'],'Completed Lions Park–Route 66 State Park corridor.',None),
 ('western','Western Greenway',['148,174'],'Wildwood connection between the Rockwoods and Meramec corridors.',None),
 ('busch','Busch Greenway',['144','137'],'Missouri Research Park, Katy Trail and Busch Conservation Area corridor.',None),
 ('dardenne','Dardenne Greenway · Cottleville to St. Peters',['216','203','X232A','X232B','294'],'Completed Dardenne Creek greenway network around Cottleville and St. Peters.',None),
 ('barathaven','Dardenne Greenway · BaratHaven',['130','130A'],'BaratHaven / Bluebird corridor and Twin Island trailhead.',None),
 ('centennial-katy','Centennial Greenway · Katy Trail to Heritage Museum',['132,133','605','605A'],'Katy Trail, Heritage Museum and completed highway-crossing connections.',None),
 ('boschert','Boschert Greenway',['139','245'],'New Town–Katy Trail corridor in St. Charles.',None),
]
def get(url,timeout=40):
 req=urllib.request.Request(url,headers={'User-Agent':'Andymap-source-refresh/1.0 (+https://www.andrewhanes.com)'})
 with urllib.request.urlopen(req,timeout=timeout) as r:return json.load(r)
def meters(a,b):
 r=math.pi/180;v=math.sin((b[1]-a[1])*r/2)**2+math.cos(a[1]*r)*math.cos(b[1]*r)*math.sin((b[0]-a[0])*r/2)**2
 return 6371008.8*2*math.asin(min(1,math.sqrt(v)))
def lines(f):
 g=f['geometry'];return [g['coordinates']] if g['type']=='LineString' else g['coordinates']
def sample(line,spacing=180):
 out=[line[0]];since=0
 for a,b in zip(line,line[1:]):
  length=meters(a,b)
  if not length:continue
  at=spacing-since
  while at<length:
   t=at/length;out.append([round(a[0]+(b[0]-a[0])*t,6),round(a[1]+(b[1]-a[1])*t,6)]);at+=spacing
  since=(since+length)%spacing
 if meters(out[-1],line[-1])>25:out.append(line[-1])
 return out

def simplified(line,tolerance=0.00004):
 if len(line)<3:return line
 a,b=line[0],line[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=dx*dx+dy*dy
 def d(p):
  t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) if den else 0
  return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
 maximum,index=max((d(p),i) for i,p in enumerate(line[1:-1],1))
 if maximum<=tolerance:return [a,b]
 return simplified(line[:index+1],tolerance)[:-1]+simplified(line[index:],tolerance)

def join_lines(raw):
 # Join only genuine coincident endpoints; never create an invented trail across a gap.
 remaining=[x[:] for x in raw if len(x)>1];merged=[]
 while remaining:
  line=remaining.pop(0);changed=True
  while changed:
   changed=False
   for i,c in enumerate(remaining):
    if meters(line[-1],c[0])<1:line.extend(c[1:])
    elif meters(line[-1],c[-1])<1:line.extend(c[-2::-1])
    elif meters(line[0],c[-1])<1:line=c[:-1]+line
    elif meters(line[0],c[0])<1:line=c[:0:-1]+line
    else:continue
    remaining.pop(i);changed=True;break
  merged.append(line)
 return merged

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--geometry-cache');ap.add_argument('--cache-dir',default='/tmp/andymap-cycling-cache');ap.add_argument('--skip-elevation',action='store_true');ap.add_argument('--refresh-elevation',action='store_true',help='Resample unchanged routes as well (monthly terrain refresh).');args=ap.parse_args()
 cache=pathlib.Path(args.cache_dir);cache.mkdir(parents=True,exist_ok=True)
 checked=dt.datetime.now(dt.timezone.utc).isoformat()
 try:previous={f['properties']['id']:f for f in json.loads((ROOT/'cycling-routes.json').read_text()).get('features',[])}
 except (OSError,ValueError,KeyError):previous={}
 terrain_fields=['terrainSampleCoverage','terrainLowFt','terrainHighFt','terrainRangeFt','elevationSourceUrl','elevationMethod','terrainSampleCount','effortScore','difficulty','difficultyBasis','elevationProfile','profileLabel','elevationCheckedAt']
 geometry_key=lambda g:hashlib.sha256(json.dumps(g,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 query=GRG+'/query?'+urllib.parse.urlencode({'f':'geojson','where':"ShowPublic = 'Yes' AND Internal_Status = 'Completed'",'outFields':'ID,Name,GreenwayName,SubprojectCode,Jurisdiction,Miles_GIS,Internal_Status,ShowPublic,last_edited_date','outSR':'4326'})
 raw=json.loads(pathlib.Path(args.geometry_cache).read_text()) if args.geometry_cache else get(query)
 if raw.get('exceededTransferLimit'):raise RuntimeError('Source pagination required; refusing incomplete geometry')
 source=raw.get('features',[])
 if len(source)<100:raise RuntimeError('Unexpected greenway feed size; preserve previous snapshot')
 records=[];all_points={}
 for slug,title,codes,description,urlslug in SEEDS:
  selected=[f for f in source if f['properties'].get('SubprojectCode') in codes and f['properties'].get('ShowPublic')=='Yes' and f['properties'].get('Internal_Status')=='Completed']
  if not selected:continue
  rawlines=[];seen=set()
  for f in selected:
   for line in lines(f):
    line=[[round(x,6),round(y,6)] for x,y,*_ in line];key=min(json.dumps(line),json.dumps(line[::-1]))
    if key not in seen:seen.add(key);rawlines.append(line)
  paths=join_lines(rawlines);paths.sort(key=lambda line:sum(meters(a,b) for a,b in zip(line,line[1:])),reverse=True)
  coords=[simplified(line) for line in paths]
  edges={tuple(sorted((tuple(a),tuple(b)))) for line in rawlines for a,b in zip(line,line[1:])}
  length=sum(meters(a,b) for a,b in edges)/1609.344
  samples=[sample(line) for line in paths]
  p={'id':'cycling:grg:'+slug,'title':title,'description':description,'routeKind':'Named greenway section' if len(paths)==1 else 'Named greenway network','routeMiles':round(length,2),'mappedMiles':round(length,2),'lengthBasis':'Length of the displayed completed greenway geometry, including branches; not an out-and-back ride distance.','source':'Great Rivers Greenway GIS / USGS 3DEP','sourceUrl':PUBLIC_MAP,'url':'https://greatriversgreenway.org/greenways/'+urlslug+'/' if urlslug else PUBLIC_MAP,'sourceCheckedAt':checked,'geometrySourceUrl':query,'sourceCodes':codes,'routeParts':len(paths),'jurisdictions':sorted(set(f['properties'].get('Jurisdiction') or 'Regional' for f in selected)),'accessNote':'Completed greenway geometry is not a live closure or access guarantee. Check the official route map before riding.'}
  geometry={'type':'LineString','coordinates':coords[0]} if len(coords)==1 else {'type':'MultiLineString','coordinates':coords}
  old=previous.get(p['id']);reuse=not args.refresh_elevation and old and geometry_key(old['geometry'])==geometry_key(geometry) and old['properties'].get('terrainSampleCoverage',0)>=.95 and 'terrainRangeFt' in old['properties']
  if reuse:
   for key in terrain_fields:
    if key in old['properties']:p[key]=old['properties'][key]
   p.setdefault('elevationCheckedAt',old['properties'].get('sourceCheckedAt'))
  else:
   for line in samples:
    for c in line:all_points[','.join(map(str,c))]=c
  records.append({'type':'Feature','geometry':geometry,'properties':p,'_samples':samples,'_reuseTerrain':bool(reuse)})
 if len(records)<25:raise RuntimeError('Named route coverage unexpectedly shrank; preserve previous snapshot')
 print('Routes',len(records),'terrain samples',len(all_points),flush=True)
 elevations={};bad=0
 points=list(all_points.values());batches=[points[i:i+60] for i in range(0,len(points),60)]
 def dem_batch(coords):
  key=hashlib.sha256(json.dumps(coords).encode()).hexdigest();path=cache/(key+'.json')
  if path.exists() and not args.refresh_elevation:return json.loads(path.read_text())
  u=DEM+'?'+urllib.parse.urlencode({'f':'json','geometryType':'esriGeometryMultipoint','geometry':json.dumps({'points':coords,'spatialReference':{'wkid':4326}},separators=(',',':')),'returnFirstValueOnly':'true','outFields':''})
  try:
   response=get(u,50)
   if response.get('error'):raise RuntimeError(response['error'])
   answer={}
   for s in response.get('samples',[]):
    idx=s.get('locationId');value=float(s.get('value','nan'))
    if isinstance(idx,int) and 0<=idx<len(coords) and math.isfinite(value) and -100<value<2000:answer[','.join(map(str,coords[idx]))]=value
   if answer:path.write_text(json.dumps(answer))
   return answer
  except Exception as e:print('DEM batch unavailable:',str(e)[:120],flush=True);return {}
 if not args.skip_elevation:
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
   for i,result in enumerate(pool.map(dem_batch,batches)):
    elevations.update(result)
    if i%10==0:print('DEM batches',i+1,'/',len(batches),flush=True)
 for f in records:
  p=f['properties'];samples=f.pop('_samples')
  if f.pop('_reuseTerrain',False):continue
  vals=[elevations.get(','.join(map(str,c))) for line in samples for c in line];known=[v for v in vals if v is not None]
  p['terrainSampleCoverage']=round(len(known)/len(vals),3) if vals else 0
  if len(known)>=3 and p['terrainSampleCoverage']>=.95:
   low,high=min(known),max(known);relief=(high-low)*3.28084
   p['elevationCheckedAt']=checked
   p.update(terrainLowFt=round(low*3.28084),terrainHighFt=round(high*3.28084),terrainRangeFt=round(relief),elevationSourceUrl='https://www.usgs.gov/3d-elevation-program',elevationMethod='USGS bare-earth terrain sampled approximately every 180 metres along mapped paths. Bridges and tunnels may differ from ground elevation. Terrain range is highest minus lowest sampled ground, not cumulative climbing.',terrainSampleCount=len(known))
   # Transparent effort grouping, not a technical trail grading or an individual fitness judgment.
   score=p['routeMiles']/6+relief/200
   p['effortScore']=round(score,2);p['difficulty']='Easy' if score<1.5 else 'Moderate' if score<3.5 else 'Long / hilly';p['difficultyBasis']='Andymap effort estimate: mapped miles ÷ 6 + sampled terrain range in feet ÷ 200. Under 1.5 = Easy, under 3.5 = Moderate, otherwise Long / hilly. Does not assess traffic, trail surface, technical obstacles or rider fitness.'
   profile=[];cumulative=0;prev=None
   for c in samples[0]:
    if prev is not None:cumulative+=meters(prev,c)/1609.344
    prev=c;v=elevations.get(','.join(map(str,c)))
    if v is not None:profile.append([round(cumulative,3),round(v*3.28084)])
   p['elevationProfile']=profile;p['profileLabel']='Sampled ground elevation · longest connected mapped section'
 output={'type':'FeatureCollection','checkedAt':checked,'sources':[{'name':'Great Rivers Greenway public GIS','url':PUBLIC_MAP,'dataUrl':query},{'name':'USGS 3DEP bare-earth elevation','url':'https://www.usgs.gov/3d-elevation-program','dataUrl':DEM}],'method':'Completed public GRG geometry, grouped into named sections; no inferred route connections. Terrain samples are precomputed for fast browsing.','features':records}
 target=ROOT/'cycling-routes.json';tmp=target.with_suffix('.json.tmp');tmp.write_text(json.dumps(output,separators=(',',':'))+'\n');tmp.replace(target)
 print('Saved',len(records),'routes;',sum('terrainRangeFt' in f['properties'] for f in records),'with terrain statistics;',target.stat().st_size,'bytes')
if __name__=='__main__':main()
