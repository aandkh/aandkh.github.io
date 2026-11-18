import {WIND_MAX_AGE,MINUTE} from './regional-weather.js?v=20261118-metro-wind';
import {ODOR_BANDS} from './air-grades.js?v=20261118-local-air';
// Local odor potential, expressed only on Andymap's windows-grade ladder.
// Distances are cartographic assumptions in metres, not gas concentrations.
import {LANDFILLS} from './landfill-sites.js?v=20261118-local-air';
import {coordinate} from './core.js?v=20261117-construction-layer';
import {pointInGeometry} from './layer-insights.js?v=20261118-local-air';
import {airBearingDistance} from './air-monitors.js?v=20261118-metro-wind';

const RAD = Math.PI / 180;
const METRES_PER_DEGREE = 111195;
const HOUR = 3600000;
const MAX_STATION_KM = 30;

const PROFILES = {
  active:  {peak: 3, reach: 2300, defaultRadius: 400},
  managed: {peak: 2, reach: 1500, defaultRadius: 300},
  closed:  {peak: 1, reach: 720, defaultRadius: 215},
  debris:  {peak: 1, reach: 360, defaultRadius: 160},
  ash:     {peak: 1, reach: 480, defaultRadius: 200}
};

export function observedWinds(stations, airportReadings, now) {
  const reports = [...(airportReadings || [])].map(r => ({
    lat: r.lat, lng: r.lng, name: r.label || r.id, sourceUrl: r.sourceUrl,
    speed: r.windMph, from: r.windFromDeg, variable: r.windVariable,
    observedAt: r.observedAt, dryWeather: typeof r.dryWeather === 'boolean' ? r.dryWeather : null, duration: 0
  }));
  for (const station of stations || []) {
    const p = station.properties, w = p?.wind;
    if (!p?.airMonitor || !w || w.averagingPeriod !== '1 hour' ||
        (w.unit && w.unit.toLowerCase() !== 'mph') || station.geometry?.type !== 'Point') continue;
    const [lng, lat] = station.geometry.coordinates;
    reports.push({lat, lng, name: p.title?.replace(/ · air monitor$/, ''), sourceUrl: p.sourceUrl,
      speed: w.speed, from: w.directionFromDegrees, variable: w.variable || w.calm, observedAt: w.observedAt, duration: HOUR});
  }
  return reports.flatMap(r => {
    const start = Date.parse(r.observedAt), end = start + r.duration, expires = end + WIND_MAX_AGE;
    if (!coordinate(r.lat, r.lng) || !Number.isFinite(start) || (r.duration && start % HOUR !== 0) ||
        end > now || expires <= now || !Number.isFinite(r.speed) || r.speed < 0 || r.speed > 150) return [];
    const directed = !r.variable && r.speed >= 2 && Number.isFinite(r.from) && r.from >= 0 && r.from <= 360;
    return [{...r, effectiveAt:start+r.duration/2, toward: directed ? (r.from + 180) % 360 : null, expires}];
  });
}

function nearestWind(site,reports,now,maxDistance=MAX_STATION_KM){
 let best=null,lowest=Infinity;
 for(const r of reports){
  const distance=airBearingDistance(site,r).km;
  if(distance>maxDistance)continue;
  // For reports more than five minutes apart, time matters along with distance.
  // An hourly average represents the midpoint of its measured interval.
  const ageMinutes=(now-r.effectiveAt)/MINUTE;
  const cost=distance+Math.max(0,ageMinutes-5)*.45;
  if(cost<lowest || cost===lowest && (r.effectiveAt>best.effectiveAt || r.effectiveAt===best.effectiveAt && distance<best.distance)){
   best={...r,distance};lowest=cost;
  }
 }
 return best;
}

function extentRing(site, near, cross, down, toward) {
  const ring = [], axis = (toward ?? 0) * RAD;
  for (let i = 0; i < 48; i++) {
    const angle = 2 * Math.PI * i / 48, cos = Math.cos(angle);
    const along = cos * (cos > 0 ? down : near), across = Math.sin(angle) * cross;
    const east = along * Math.sin(axis) - across * Math.cos(axis);
    const north = along * Math.cos(axis) + across * Math.sin(axis);
    ring.push([site.lng + east / (METRES_PER_DEGREE * Math.cos(site.lat * RAD)), site.lat + north / METRES_PER_DEGREE]);
  }
  ring.push(ring[0]);
  return ring;
}

// Buffer each mapped waste cell separately. Its convex envelope is an
// approximation at this scale. In particular, never span both Champ pits.
function expandFootprint(footprint, offsets, site) {
 const points = [];
 for (const [lng,lat] of footprint) {
  for (const [x,y] of offsets.slice(0,-1)) points.push([lng+x-site.lng,lat+y-site.lat]);
 }
 points.sort((a,b) => a[0]-b[0] || a[1]-b[1]);
 function hullHalf(ordered) {
  const out = [];
  for (const p of ordered) {
   while (out.length >= 2) {
    const a = out.at(-2), b = out.at(-1);
    if ((b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]) > 0) break;
    out.pop();
   }
   out.push(p);
  }
  out.pop();
  return out;
 }
 const ring = [...hullHalf(points), ...hullHalf(points.reverse())];
 ring.push(ring[0]);
 return ring;
}

export function buildLandfillContours(stations = [], {now = Date.now(), airportReadings = [], sites = LANDFILLS, point} = {}) {
  const reports = observedWinds(stations, airportReadings, now), contours = [];
  for (const site of sites) {
    if (point && (Math.abs(point.lat-site.lat) > .1 || Math.abs(point.lng-site.lng) > .13)) continue;
    const profile = PROFILES[site.profile], wind = nearestWind(site,reports,now);
    const radius = site.footprint ? 0 : site.acres > 0 ? Math.sqrt(site.acres * 4046.86 / Math.PI) : profile.defaultRadius;
    const directed = wind?.toward != null;
    const dust = site.profile === 'ash';
    // Dry-weather screening only for documented active ash disposal areas.
    if(dust){
      if(!directed || wind.speed<12 || wind.dryWeather===false)continue;
      if(wind.dryWeather!==true){
        const evidence=nearestWind(site,reports.filter(r=>typeof r.dryWeather==='boolean' && Math.abs(r.effectiveAt-wind.effectiveAt)<=20*MINUTE),now,12);
        if(!evidence?.dryWeather)continue;
        wind.drySupport={name:evidence.name,sourceUrl:evidence.sourceUrl,observedAt:evidence.observedAt};
        wind.expires=Math.min(wind.expires,evidence.expires);
      }
    }
    // Slowly moving air dilutes less. At very light speeds direction is uncertain.
    // Strong winds carry odor downwind, but dilute the stronger bands sooner.
    const transport = dust ? Math.min(1.4, wind.speed / 18) : directed ? Math.min(1, (wind.speed - 1) / 3) / (1 + Math.max(0, wind.speed - 9) / 15) : 0;
    for (let level = 0; level <= profile.peak; level++) {
      const fraction = (profile.peak - level + 1) / (profile.peak + 1);
      const buffer = (site.profile === 'debris' || dust ? 180 : 400) * fraction;
      const near = radius + buffer * (directed ? .88 : wind ? 1.18 : 1);
      const cross = directed ? radius + buffer + profile.reach * transport * .12 * fraction : near;
      const down = directed ? radius + buffer + profile.reach * transport * fraction ** 1.6 : near;
      const offsets = extentRing(site, near, cross, down, wind?.toward);
      const ring = site.footprint ? expandFootprint(site.footprint, offsets, site) : offsets;
      const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
      contours.push({type: 'Feature', bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        geometry: {type: 'Polygon', coordinates: [ring]},
        properties: {id: 'landfill:' + site.id + ':' + level, title: site.name + (dust ? ' · potential dust' : ' · modeled odor'),
          landfill: {site, wind, level}, color: ODOR_BANDS[level].color, source: 'Andymap landfill odor estimate', sourceUrl: site.url}});
    }
  }
  return contours;
}

export function landfillAt(contours, point) {
  if (!coordinate(point?.lat, point?.lng)) return null;
  let best = null, distance = Infinity;
  for (const contour of contours || []) {
    const [w,s,e,n] = contour.bbox;
    const candidate = contour.properties.landfill;
    if (point.lng < w || point.lng > e || point.lat < s || point.lat > n || (best && candidate.level < best.properties.landfill.level)) continue;
    if (!pointInGeometry([point.lng, point.lat], contour.geometry)) continue;
    const km = airBearingDistance(candidate.site, point).km;
    if (!best || candidate.level > best.properties.landfill.level || km < distance) {best = contour; distance = km;}
  }
  return best;
}
