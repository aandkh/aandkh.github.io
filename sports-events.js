import {eventDiscoveryCutoff,eventDiscoverable,isEventDate} from './event-lifecycle.js?v=20261116-full-speed';
let cache, at = 0, pending;
const note = 'Published local home games: Cardinals, Blues, CITY SC and college basketball, alongside regional listings. Partial coverage. Times marked TBA have no confirmed start time; check the official schedule for changes.';
export async function sportsData() {
  if (cache && Date.now() - at < 300000) return cache;
  if (!pending) pending = fetch('./sports-events.json', {cache: 'no-cache', signal: AbortSignal.timeout(8000)}).then(r => {
    if (!r.ok) throw Error('Sports schedule unavailable');
    return r.json();
  }).then(data => {cache = data; at = Date.now(); return data;}).catch(error => {if (cache) return cache; throw error;}).finally(() => {pending = null;});
  return pending;
}
const stamp = value => Date.parse(value?.length === 10 ? value + 'T12:00:00-06:00' : value);
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function mergeSportsEvents(result = {}, schedule = {}, now = Date.now(), {includePast=false} = {}) {
  const seen = new Map();
  for (const f of [...(schedule.features || []), ...(result.features || [])]) {
    const p = f.properties || {}, time = eventDiscoveryCutoff(p.start);
    if (!Number.isFinite(time) || (!includePast && !eventDiscoverable(p,now))) continue;
    if (!f.geometry) continue;
    const key = [normalized(p.title), normalized(p.venue || p.address), isEventDate(p.start) ? 'day:'+p.start : time, p.timeTBA ? p.sourceId || '' : ''].join('|');
    if (!seen.has(key)) seen.set(key, {...f, properties: {...p, layer: 'sports'}});
  }
  const features = [...seen.values()].sort((a, b) => stamp(a.properties.start) - stamp(b.properties.start));
  return {...result, type: 'FeatureCollection', checkedAt: new Date(now).toISOString(), snapshotGeneratedAt: schedule.generatedAt || schedule.checkedAt || null, features, status: features.length ? 'partial' : 'empty', note, coverage: schedule.coverage || note};
}
export async function enrichSports(result = {}, options = {}) {
  try {return mergeSportsEvents(result, await sportsData(), Date.now(), options);} catch {return mergeSportsEvents(result, {}, Date.now(), options);}
}
export async function loadSportsEvents(loadRemote) {
  const [remote, local] = await Promise.allSettled([Promise.resolve().then(loadRemote), sportsData()]);
  return mergeSportsEvents(remote.status === 'fulfilled' ? remote.value : {}, local.status === 'fulfilled' ? local.value : {});
}
