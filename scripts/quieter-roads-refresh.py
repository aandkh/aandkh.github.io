#!/usr/bin/env python3
"""Build the complete regional OSM major-road distance snapshot (stdlib only).

The road hierarchy is a distance proxy, not observed traffic or sound. Refresh at
most weekly unless --force. A bad/partial Overpass response never replaces good data.
"""
import argparse,datetime as dt,gzip,json,math,pathlib,urllib.parse,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
COVERAGE=[-91.2,38.1,-89.4,39.2] # Matches core.js REGION, including City and County together.
QUERY_BOUNDS=[-91.35,37.95,-89.25,39.35] # Buffer avoids false nearest-road claims along the app boundary.
CLASSES=['motorway','trunk','primary','secondary','motorway_link','trunk_link','primary_link','secondary_link']
ENDPOINT='https://overpass-api.de/api/interpreter'
QUERY='[out:json][timeout:180];way["highway"~"^(motorway|trunk|primary|secondary)(_link)?$"](37.95,-91.35,39.35,-89.25);out geom qt;'

def simplify(points,tolerance=5):
    if len(points)<=2:return points
    # Local tangent plane for compression only; the app computes spherical distances.
    cos=math.cos(math.radians(sum(p[1] for p in points)/len(points)))
    xy=[(p[0]*111195*cos,p[1]*111195) for p in points]
    keep={0,len(points)-1};stack=[(0,len(points)-1)]
    while stack:
        lo,hi=stack.pop();ax,ay=xy[lo];bx,by=xy[hi];dx,dy=bx-ax,by-ay;den=dx*dx+dy*dy;best=-1;idx=lo
        for i in range(lo+1,hi):
            px,py=xy[i];t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/den)) if den else 0
            dist=(px-ax-t*dx)**2+(py-ay-t*dy)**2
            if dist>best:best,idx=dist,i
        if best>tolerance*tolerance:keep.add(idx);stack.extend([(lo,idx),(idx,hi)])
    return [points[i] for i in sorted(keep)]

def encode(points):
    out=[];last=[0,0]
    for lng,lat in points:
        for i,v in enumerate([lat,lng]):
            n=round(v*100000);delta=n-last[i];last[i]=n;value=(delta<<1) if delta>=0 else ~(delta<<1)
            while value>=32:out.append(chr((32|(value&31))+63));value>>=5
            out.append(chr(value+63))
    return ''.join(out)

def build(raw,checked):
    if raw.get('remark'):raise RuntimeError('Overpass reported incomplete data: '+raw['remark'])
    names=[];lookup={};roads=[];counts={c:0 for c in CLASSES};rawpoints=0;packedpoints=0
    for f in raw.get('elements',[]):
        tags=f.get('tags',{});kind=tags.get('highway');g=f.get('geometry',[])
        if f.get('type')!='way' or kind not in CLASSES or len(g)<2:continue
        # Construction/proposed ways were never requested; a construction tag on a
        # currently mapped highway is kept, since distance is not access or traffic.
        points=[[p['lon'],p['lat']] for p in g if isinstance(p.get('lon'),(int,float)) and isinstance(p.get('lat'),(int,float))]
        if len(points)<2:continue
        name=tags.get('name') or tags.get('ref') or ''
        if name not in lookup:lookup[name]=len(names);names.append(name)
        compact=simplify(points);rawpoints+=len(points);packedpoints+=len(compact);counts[kind]+=1
        roads.append([f['id'],lookup[name],CLASSES.index(kind),encode(compact)])
    if len(roads)<10000 or any(counts[k]<100 for k in ['motorway','primary','secondary']):raise RuntimeError('Unexpectedly small regional road response; keep existing snapshot')
    return {'version':1,'encoding':'polyline5','source':'OpenStreetMap contributors via Overpass API','sourceUrl':'https://www.openstreetmap.org/copyright','queryUrl':ENDPOINT+'?'+urllib.parse.urlencode({'data':QUERY}),'license':'ODbL-1.0','checkedAt':checked,'sourceDataAt':raw.get('osm3s',{}).get('timestamp_osm_base'),'coverageBounds':COVERAGE,'queriedBounds':QUERY_BOUNDS,'coverageNote':'Entire Andymap region: St. Louis City and County, St. Charles, Jefferson, Franklin and the Metro East; one combined road snapshot. Geometry is fetched beyond the comparison boundary.','classes':CLASSES,'classificationNote':'OSM motorway, trunk, primary and secondary roads plus connecting ramps. These tags express road-network importance, not measured traffic volume. Secondary roads include suburban arterial connections.','simplificationMeters':5,'precisionDegrees':.00001,'names':names,'roads':roads,'counts':{'ways':len(roads),'sourcePoints':rawpoints,'storedPoints':packedpoints,'classes':counts}}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',default=str(ROOT/'quiet-roads.json'));p.add_argument('--source-json');p.add_argument('--force',action='store_true');args=p.parse_args();target=pathlib.Path(args.output);now=dt.datetime.now(dt.timezone.utc)
    if target.exists() and not args.force and not args.source_json:
        old=json.loads(target.read_text());at=dt.datetime.fromisoformat(old['checkedAt'].replace('Z','+00:00'))
        if (now-at).total_seconds()<7*86400:print(json.dumps({'cached':True,'checkedAt':old['checkedAt'],'ways':len(old['roads'])}));return
    if args.source_json:raw=json.loads(pathlib.Path(args.source_json).read_text())
    else:
        url=ENDPOINT+'?'+urllib.parse.urlencode({'data':QUERY});request=urllib.request.Request(url,headers={'User-Agent':'Andymap/1.0 public-road-distance refresh (https://www.andrewhanes.com)'})
        with urllib.request.urlopen(request,timeout=210) as r:raw=json.load(r)
    data=build(raw,now.isoformat().replace('+00:00','Z'))
    if target.exists():
        old=json.loads(target.read_text())
        if len(data['roads'])<.75*len(old.get('roads',[])):raise RuntimeError('Road count dropped by more than 25%; review source before replacement')
    body=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n';temp=target.with_suffix('.json.tmp');temp.write_text(body);temp.replace(target)
    print(json.dumps({**data['counts'],'bytes':len(body.encode()),'gzipBytes':len(gzip.compress(body.encode()))}))
if __name__=='__main__':main()
