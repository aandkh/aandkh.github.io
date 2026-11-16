// Static, sourced birding recommendations. No sightings or access guarantees.
let pending;
const nameKey = value => String(value || '').toLowerCase().replace(/\b(county|conservation|nature)\b/g, '').replace(/[^a-z0-9]/g, '');
const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
function samePlace(a, b) {
 if (String(a.id || a.properties?.id) === String(b.id || b.properties?.id)) return true;
 if (nameKey(a.properties?.title) !== nameKey(b.properties?.title)) return false;
 const x = a.geometry?.coordinates, y = b.geometry?.coordinates;
 return a.geometry?.type === 'Point' && b.geometry?.type === 'Point' && Math.hypot(x[0] - y[0], x[1] - y[1]) < .02;
}
export function mergeBirding(result = {}, snapshot = {}) {
 const features = [...(Array.isArray(result?.features) ? result.features : [])];
 for (const local of snapshot.features || []) {
  const index = features.findIndex(remote => samePlace(remote, local));
  if (index < 0) features.push(local);
  else if (local.properties?.birdingEvidence) {
   const remote = features[index];
   features[index] = {...remote, properties: {...remote.properties, birdingEvidence: local.properties.birdingEvidence, officialAccessUrl: local.properties.officialAccessUrl}};
  }
 }
 return {...snapshot, ...result, id: 'birding', type: 'FeatureCollection', features, totalInView: features.length,
  status: features.length ? 'partial' : 'empty', note: snapshot.note || result?.note};
}
export async function enrichBirding(result = {}) {
 try {
  pending ||= fetch(new URL('./birding-community.json?v=20261116-birding', import.meta.url), {signal: AbortSignal.timeout(8000)})
   .then(r => { if (!r.ok) throw Error('Birding snapshot unavailable'); return r.json(); }).catch(error => { pending = null; throw error; });
  return mergeBirding(result || {}, await pending);
 } catch { return result || {id:'birding',features:[],status:'unavailable'}; }
}
export function appendBirdingEvidence(host, properties) {
 const evidence = properties?.birdingEvidence;
 if (!evidence || !safeUrl(evidence.url)) return false;
 const section = document.createElement('section');
 section.className = 'birding-evidence';
 const report = document.createElement('p');
 const link = document.createElement('a');
 link.href = safeUrl(evidence.url); link.target = '_blank'; link.rel = 'noopener noreferrer';
 link.textContent = `${evidence.publisher} · ${evidence.date || 'Birding guide'}`;
 report.append(link);
 const accessUrl = safeUrl(properties.officialAccessUrl);
 const access = document.createElement('a'); access.href = accessUrl; access.target = '_blank'; access.rel = 'noopener noreferrer'; access.textContent = 'Official park & access information';
 section.append(report); if (accessUrl) section.append(access); host.append(section); return true;
}
