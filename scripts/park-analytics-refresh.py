#!/usr/bin/env python3
"""Precompute park geometry analytics. Explicit/manual refresh only; not a daily job.
Dependencies: shapely>=2, pyproj. Failed sources abort publication; cache is reusable.
"""
import argparse,concurrent.futures,datetime as dt,hashlib,json,math,pathlib,urllib.parse,urllib.request
from shapely.geometry import shape,Point,LineString,Polygon
from shapely.ops import transform,unary_union,polygonize
from shapely import make_valid,STRtree
from pyproj import Transformer
ROOT=pathlib.Path(__file__).resolve().parents[1]
DEM='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples'
BOUNDS='38.1,-91.2,39.2,-89.4'
GROUPS={
'paths':'way[highway~"^(path|footway|pedestrian|steps|cycleway)$"]',
'water':'nwr[natural=water]',
'wood':'(nwr[natural=wood]({b});nwr[landuse=forest]({b});)',
'amenities':'(nwr[amenity~"^(bench|drinking_water)$"]({b});nwr[leisure~"^(playground|pitch|dog_park)$"]({b});nwr[tourism=picnic_site]({b});node[natural=tree]({b});)'}
PROJECT=Transformer.from_crs(4326,26915,always_xy=True).transform
UNPROJECT=Transformer.from_crs(26915,4326,always_xy=True).transform
ACRE=4046.8564224;MILE=1609.344

def get(url,timeout=180):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Andymap/1.0 park metrics (https://www.andrewhanes.com)','Referer':'https://www.andrewhanes.com/'}),timeout=timeout) as r:return json.load(r)

def fetch_group(name,cache,refresh=False):
 path=cache/(name+'.json')
 if path.exists() and not refresh:return json.loads(path.read_text())
 if name in ('wood','amenities'):
  selectors={'wood':[('natural-wood','way[natural=wood]'),('landuse-forest','nwr[landuse=forest]')], 'amenities':[('trees','node[natural=tree]'),('benches-water','nwr[amenity~"^(bench|drinking_water)$"]'),('recreation','nwr[leisure~"^(playground|pitch|dog_park)$"]'),('picnic','nwr[tourism=picnic_site]')]}[name]
  def component(item):
   key,selector=item;partpath=cache/(key+'.json')
   if partpath.exists() and not refresh:return json.loads(partpath.read_text())
   errors=[]
   for host in ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']:
    query='[out:json][timeout:90];'+selector+'('+BOUNDS+');out geom;'
    try:
     data=get(host+'?'+urllib.parse.urlencode({'data':query}),120)
     if data.get('remark') or 'elements' not in data:raise ValueError(data.get('remark','Missing elements'))
     data.update(_query=query,_endpoint=host,_checkedAt=dt.datetime.now(dt.timezone.utc).isoformat());partpath.write_text(json.dumps(data));return data
    except Exception as e:errors.append(str(e))
   raise RuntimeError(key+': '+ '; '.join(errors))
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:parts=list(pool.map(component,selectors))
  elements={e['type']+'/'+str(e['id']):e for part in parts for e in part['elements']}
  data={'elements':list(elements.values()),'osm3s':{'timestamp_osm_base':min(d['osm3s']['timestamp_osm_base'] for d in parts)},'_query':[d['_query'] for d in parts],'_endpoint':list(set(d['_endpoint'] for d in parts)),'_checkedAt':max(d['_checkedAt'] for d in parts)}
  if name=='wood':data['_coverageNote']='natural=wood ways plus landuse=forest nodes/ways/relations. Natural-wood multipolygon relations are not included; mapped woodland is a lower-bound footprint.'
  path.write_text(json.dumps(data));return data
 selector=GROUPS[name];selection=selector.format(b=BOUNDS) if '{b}' in selector else selector+'('+BOUNDS+')'
 query='[out:json][timeout:180];'+selection+';out geom;'
 errors=[]
 for host in ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']:
  try:
   data=get(host+'?'+urllib.parse.urlencode({'data':query}),240)
   if data.get('remark') or not data.get('elements'):raise ValueError(data.get('remark','Empty response'))
   data['_query']=query;data['_endpoint']=host;data['_checkedAt']=dt.datetime.now(dt.timezone.utc).isoformat();path.write_text(json.dumps(data));return data
  except Exception as e:errors.append(str(e))
 raise RuntimeError(name+': '+'; '.join(errors))

def element_geometry(e):
 if e['type']=='node':return Point(e['lon'],e['lat'])
 if e['type']=='way':
  c=[(p['lon'],p['lat']) for p in e.get('geometry',[]) if 'lon'in p]
  if len(c)<2:return None
  return make_valid(Polygon(c)) if len(c)>=4 and c[0]==c[-1] and e.get('tags',{}).get('area')!='no' and 'highway' not in e.get('tags',{}) else LineString(c)
 outer=[];inner=[]
 for m in e.get('members',[]):
  c=[(p['lon'],p['lat']) for p in m.get('geometry',[]) if 'lon'in p]
  if len(c)>1:(inner if m.get('role')=='inner' else outer).append(LineString(c))
 if not outer:return None
 g=unary_union(list(polygonize(unary_union(outer))))
 if inner:g=g.difference(unary_union(list(polygonize(unary_union(inner)))))
 return make_valid(g)

def build_index(raw):
 records=[];geometries=[]
 # Tagged ways can also be members of returned multipolygons: use the relation once.
 members={m['ref'] for e in raw['elements'] if e['type']=='relation' and element_geometry(e) is not None for m in e.get('members',[]) if m.get('type')=='way'}
 for e in raw['elements']:
  if e['type']=='way' and e['id'] in members:continue
  g=element_geometry(e)
  if g is not None and not g.is_empty:
   geometries.append(transform(PROJECT,g));records.append(e)
 return geometries,records,STRtree(geometries)

def overlaps(poly,index):
 geoms,records,tree=index
 for n in tree.query(poly,predicate='intersects'):
  yield records[n],geoms[n].intersection(poly)

def valid_path(tags):
 return tags.get('area')!='yes' and tags.get('access') not in ('private','no') and tags.get('foot') not in ('no','private') and tags.get('highway') not in ('proposed','construction')

def metrics(poly,indexes):
 acres=poly.area/ACRE;paths=[];paved=[];accessible=[];water=[];ponds=[];woods=[];trees=[]
 for e,g in overlaps(poly,indexes['paths']):
  t=e.get('tags',{})
  if not valid_path(t):continue
  paths.append(g)
  if t.get('surface') in ('asphalt','concrete','concrete:plates','concrete:lanes','paved','paving_stones','sett','bricks'):paved.append(g)
  if t.get('wheelchair')=='yes':accessible.append(g)
 for e,g in overlaps(poly,indexes['water']):
  if g.area<=0:continue
  water.append(g)
  if e.get('tags',{}).get('water') in ('pond','lake','reservoir'):ponds.append(g)
 for e,g in overlaps(poly,indexes['wood']):
  if g.area>0:woods.append(g)
 amenities={k:0 for k in ['benches','playgrounds','picnicSites','sportsPitches','drinkingWater','dogAreas']}
 for e,g in overlaps(poly,indexes['amenities']):
  t=e.get('tags',{})
  if t.get('access') in ('private','no'):continue
  for key,tag,value in [('benches','amenity','bench'),('playgrounds','leisure','playground'),('picnicSites','tourism','picnic_site'),('sportsPitches','leisure','pitch'),('drinkingWater','amenity','drinking_water'),('dogAreas','leisure','dog_park')]:
   if t.get(tag)==value:amenities[key]+=1
  if t.get('natural')=='tree':trees.append(t)
 length=unary_union(paths).length if paths else 0;pavedlength=unary_union(paved).length if paved else 0
 waterarea=unary_union(water).area if water else 0;woodarea=unary_union(woods).area if woods else 0
 taxa=sorted(set(species.strip().capitalize() for t in trees for species in t.get('species','').split(';') if species.strip()))
 pondunion=unary_union(ponds) if ponds else None
 pondparts=list(pondunion.geoms) if pondunion is not None and pondunion.geom_type=='MultiPolygon' else [pondunion] if pondunion is not None else []
 # Taxonomy count uses only species, not mixed genus/species double counts.
 return {'acres':round(acres,4),'pathMiles':round(length/MILE,2),'pathDensityMiPer100Acres':round(length/MILE/acres*100,2) if acres else None,'pavedPathMiles':round(pavedlength/MILE,2),'pavedPathPct':round(pavedlength/length*100,1) if length else None,'wheelchairTaggedPathMiles':round(unary_union(accessible).length/MILE,2) if accessible else 0,'waterAcres':round(waterarea/ACRE,4),'largestPondAcres':round(max((g.area for g in pondparts),default=0)/ACRE,4),'pondCount':len(pondparts),'woodlandAcres':round(woodarea/ACRE,4),'woodlandPct':round(woodarea/poly.area*100,1),'mappedTreeCount':len(trees),'treeTaxaCount':len(taxa) if taxa else None,'treeTaxa':taxa,'amenities':amenities}

def sample_points(poly):
 # 150 m grid, capped at 100 points for very large parks; boundary vertices do not
 # represent interior relief. Representative point ensures small parks sampled.
 w,s,e,n=poly.bounds;step=max(150,math.sqrt(poly.area/90));points=[poly.representative_point()]
 x=w+step/2
 while x<e:
  y=s+step/2
  while y<n:
   p=Point(x,y)
   if poly.contains(p):points.append(p)
   y+=step
  x+=step
 # Add distributed boundary points, inset 2 m to avoid adjacent ground.
 boundary=poly.buffer(-2)
 if not boundary.is_empty:
  edge=boundary.boundary
  points.extend(edge.interpolate(i/12,normalized=True) for i in range(12))
 return list(dict.fromkeys((round(UNPROJECT(p.x,p.y)[0],6),round(UNPROJECT(p.x,p.y)[1],6)) for p in points))

def elevations(coords,cache):
 path=cache/('dem-'+hashlib.sha256(json.dumps(coords).encode()).hexdigest()+'.json')
 if path.exists():return json.loads(path.read_text())
 url=DEM+'?'+urllib.parse.urlencode({'f':'json','geometryType':'esriGeometryMultipoint','geometry':json.dumps({'points':coords,'spatialReference':{'wkid':4326}}),'returnFirstValueOnly':'true','outFields':''})
 answer={}
 for attempt in range(2):
  try:
   for s in get(url,70).get('samples',[]):
    i=s.get('locationId');v=float(s.get('value','nan'))
    if isinstance(i,int) and 0<=i<len(coords) and math.isfinite(v) and -100<v<2000:answer[','.join(map(str,coords[i]))]=v
   if len(answer)==len(coords):path.write_text(json.dumps(answer))
   return answer
  except Exception:
   if attempt:return answer

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--cache-dir',default='/tmp/andymap-park-cache');ap.add_argument('--refresh-osm',action='store_true');ap.add_argument('--skip-elevation',action='store_true');ap.add_argument('--amenities-unavailable',action='store_true',help='Use only after confirmed amenity source failures; retain old known values, otherwise null');args=ap.parse_args();cache=pathlib.Path(args.cache_dir);cache.mkdir(parents=True,exist_ok=True)
 raw={}
 for name in GROUPS:
  if name=='amenities' and args.amenities_unavailable:raw[name]={'elements':[],'_status':'unavailable','_failure':'Source queries returned HTTP 502 / gateway timeouts; no successful inventory available.'};continue
  raw[name]=fetch_group(name,cache,args.refresh_osm);print(name,len(raw[name]['elements']),flush=True)
 indexes={name:build_index(data) for name,data in raw.items()};source=json.loads((ROOT/'quieter-parks.json').read_text());parks=[];samples={}
 for f in source['features']:
  if f.get('geometry',{}).get('type') not in ('Polygon','MultiPolygon'):continue
  poly=make_valid(transform(PROJECT,shape(f['geometry'])))
  if poly.area<1:continue
  p={'id':f.get('id') or f['properties']['id'],'name':f['properties']['title'],**metrics(poly,indexes)}
  if args.amenities_unavailable:
   p.update(mappedTreeCount=None,treeTaxaCount=None,treeTaxa=[],amenities={k:None for k in p['amenities']})
  if p['name']=='Tower Grove Park':p['officialTreeCollection']={'treeCount':7000,'typeCount':340,'approximate':True,'source':'Tower Grove Park','sourceUrl':'https://www.towergrovepark.org/about','checkedAt':'2026-11-16'}
  samples[p['id']]=sample_points(poly);parks.append(p)
 allpoints=list(dict.fromkeys(c for v in samples.values() for c in v));values={}
 if not args.skip_elevation:
  batches=[allpoints[i:i+60] for i in range(0,len(allpoints),60)]
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
   for i,result in enumerate(pool.map(lambda c:elevations(c,cache),batches)):
    values.update(result)
    if i%10==0:print('DEM',i+1,'/',len(batches),flush=True)
 for p in parks:
  points=samples[p['id']];good=[values[','.join(map(str,c))] for c in points if ','.join(map(str,c)) in values]
  p.update(elevationSampleCount=len(good),elevationSampleCoverage=round(len(good)/len(points),3),elevationMinFt=None,elevationMaxFt=None,elevationRangeFt=None)
  if len(good)==len(points) and len(good)>=3:p.update(elevationMinFt=round(min(good)*3.28084),elevationMaxFt=round(max(good)*3.28084),elevationRangeFt=round(max(good)*3.28084)-round(min(good)*3.28084))
 if args.amenities_unavailable and (ROOT/'park-analytics.json').exists():
  old=json.loads((ROOT/'park-analytics.json').read_text());prior={v['id']:v for v in old.get('parks',[])}
  for p in parks:
   prev=prior.get(p['id'],{})
   if prev.get('mappedTreeCount') is not None:
    for key in ['mappedTreeCount','treeTaxaCount','treeTaxa','amenities']:p[key]=prev.get(key)
    p['amenitiesCheckedAt']=prev.get('amenitiesCheckedAt') or old.get('sourceChecks',{}).get('amenities',{}).get('checkedAt')
 now=dt.datetime.now(dt.timezone.utc).isoformat();output={'version':1,'checkedAt':now,'coverageNote':'Polygon parks from the existing partial named regional directory; point-only places and trails do not establish park acreage. The live map may include additional places.','sourceDataAt':min(x['osm3s']['timestamp_osm_base'] for x in raw.values() if x.get('osm3s',{}).get('timestamp_osm_base')),'boundarySourceDataAt':source.get('sourceDataAt'),'sourceChecks':{name:{'endpoint':x.get('_endpoint'),'query':x.get('_query'),'checkedAt':x.get('_checkedAt'),'sourceDataAt':x.get('osm3s',{}).get('timestamp_osm_base'),'elements':len(x['elements']),'coverageNote':x.get('_coverageNote'),'status':x.get('_status','partial' if x.get('_coverageNote') else 'available'),'failure':x.get('_failure')} for name,x in raw.items()},'elevationSource':{'url':DEM,'dataset':'USGS 3DEP bare-earth elevation','units':'meters','checkedAt':now if values else None},'source':'OpenStreetMap contributors / USGS 3DEP','license':'ODbL-1.0; USGS public domain','sources':[{'name':'OpenStreetMap','url':'https://www.openstreetmap.org/copyright'},{'name':'USGS 3DEP','url':'https://www.usgs.gov/3d-elevation-program'}],'method':'Mapped park polygons; clipped OSM paths, woodland and water. USGS ground elevation sampled on an adaptive interior grid plus inset boundary points. Incomplete mapped inventory; not a survey or measured canopy.','parks':parks}
 assert len(parks)>600
 target=ROOT/'park-analytics.json';temp=target.with_suffix('.json.tmp');temp.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(target)
 print(json.dumps({'parks':len(parks),'terrain':sum(p['elevationRangeFt'] is not None for p in parks),'pathParks':sum(p['pathMiles']>0 for p in parks),'waterParks':sum(p['waterAcres']>0 for p in parks),'woodParks':sum(p['woodlandAcres']>0 for p in parks),'treeSpeciesParks':sum(bool(p['treeTaxaCount']) for p in parks),'bytes':target.stat().st_size}))
if __name__=='__main__':main()
