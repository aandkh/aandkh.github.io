#!/usr/bin/env python3
"""Decode NASA GIBS' published radiance color bins into a compact regional grid.
Values are estimates from quantized tiles, not original science pixels or SQM.
Requires Pillow. Does not request credentials or infer missing/transparent data.
"""
import datetime as dt, io, json, math, pathlib, statistics, urllib.request, xml.etree.ElementTree as E
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='https://gibs.earthdata.nasa.gov/'
NS={'w':'http://www.opengis.net/wmts/1.0','o':'http://www.opengis.net/ows/1.1'}
NOW=dt.datetime.now(dt.timezone.utc)
def get(u):
    return urllib.request.urlopen(u,timeout=35).read()
def main():
    root=E.fromstring(get(BASE+'wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml'))
    candidates=[]
    for l in root.findall('.//w:Layer',NS):
        name=l.find('o:Identifier',NS).text
        if name in ['VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance','VIIRS_NOAA20_GapFilled_BRDF_Corrected_DayNightBand_Radiance','VIIRS_NOAA21_GapFilled_BRDF_Corrected_DayNightBand_Radiance']:
            date=l.find('w:Dimension/w:Default',NS).text
            candidates.append((date,name))
    date,layer=max(candidates)
    if (NOW.date()-dt.date.fromisoformat(date)).days>45: raise RuntimeError('No recent night-light product; preserve snapshot and let its display expiry apply.')
    cmapurl=BASE+'colormaps/v1.3/VIIRS_DayNightBand_At_Sensor_Radiance.xml'
    cmap=E.fromstring(get(cmapurl)); bins={}
    for e in cmap.iter('ColorMapEntry'):
        if e.get('transparent')=='true' or e.get('nodata')=='true':continue
        rgb=tuple(map(int,e.get('rgb').split(',')))
        raw=e.get('value').strip('[]()').split(',')
        lo=float(raw[0]);hi=float(raw[-1]);value=(lo+hi)/2 if math.isfinite(hi) and hi<1000 else lo
        bins.setdefault(rgb,[]).append(value)
    values={k:statistics.mean(v) for k,v in bins.items()}
    tiles={};z=8;n=2**z
    def pixel(lon,lat):
        px=(lon+180)/360*n*256;py=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n*256
        return round(px),round(py)
    def sample(lon,lat):
        px,py=pixel(lon,lat);samples=[]
        for dy in range(-2,3):
            for dx in range(-2,3):
                xx,yy=px+dx,py+dy;key=(xx//256,yy//256)
                if key not in tiles:
                    x,y=key;url=BASE+f'wmts/epsg3857/best/{layer}/default/{date}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png'
                    tiles[key]=Image.open(io.BytesIO(get(url))).convert('RGBA')
                r,g,b,a=tiles[key].getpixel((xx%256,yy%256))
                if a<200:continue
                color=(r,g,b)
                if color in values:samples.append(values[color])
        return round(statistics.mean(samples),2) if len(samples)>=18 else None
    cells=[]
    west,south,east,north=-91.2,38.1,-89.4,39.2
    for y in range(22):
        for x in range(36):
            lon=west+(x+.5)*.05;lat=south+(y+.5)*.05;v=sample(lon,lat)
            cells.append([round(lon,3),round(lat,3),v])
    valid=sum(c[2] is not None for c in cells)
    if valid<len(cells)*.7:raise RuntimeError('Too little usable radiance coverage; previous snapshot retained.')
    d={'checkedAt':NOW.isoformat(),'expiresAt':(dt.datetime.fromisoformat(date).replace(tzinfo=dt.timezone.utc)+dt.timedelta(days=45)).isoformat(),'sourceDate':date,'source':'NASA VIIRS gap-filled, lunar/atmosphere-corrected nighttime radiance','layer':layer,'sourceUrl':'https://viirsland.gsfc.nasa.gov/Products/NASA/BlackMarble.html','colorMapUrl':cmapurl,'bounds':[west,south,east,north],'step':.05,'units':'nW/(cm² sr), approximate color-bin midpoints capped at 38.2 for saturated pixels','saturationCap':38.2,'note':'Mean of 25 GIBS pixels near each grid center; at least 18 nontransparent recognized colors required. Quantized visualization values; saturated 38.2+ bins use 38.2, so bright areas are lower-bound estimates. Not original-resolution radiance or ground sky brightness. Gap-filling may reuse an earlier clear observation.','cells':cells}
    (ROOT/'sky-lights.json').write_text(json.dumps(d,separators=(',',':'))+'\n');print('Wrote',valid,'/',len(cells),'samples',date,layer)
if __name__=='__main__':main()
