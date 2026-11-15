let cache, at = 0, pending;
const note = 'Published screenings at independent and local cinemas across St. Louis City and County. Partial coverage; confirm availability with the theater. Runtime and rating appear only when supplied.';
const chains = /\b(?:AMC|Marcus|B&B|Alamo Drafthouse|Regal|Cinemark|Landmark Theatres)\b/i;
export function movieFacts(p) {
  return [Number.isFinite(p.runtimeMinutes) && p.runtimeMinutes > 0 ? p.runtimeMinutes + ' min' : '', typeof p.contentRating === 'string' && p.contentRating.trim() ? p.contentRating.trim() : ''].filter(Boolean).join(' · ');
}
async function jsonFile(file) {
  const r = await fetch('./' + file, {cache: 'no-cache', signal: AbortSignal.timeout(8000)});
  if (!r.ok) throw Error(file + ': ' + r.status);
  return r.json();
}
export async function movieData() {
  if (cache && Date.now() - at < 300000) return cache;
  if (!pending) pending = Promise.allSettled([jsonFile('movie-screenings.json'), jsonFile('movie-metadata.json')]).then(([screenings, metadata]) => {
    if (screenings.status === 'rejected' && !cache) throw screenings.reason;
    cache = {screenings: screenings.status === 'fulfilled' ? screenings.value : cache.screenings, metadata: metadata.status === 'fulfilled' ? metadata.value : cache?.metadata || {}};
    at = Date.now();
    return cache;
  }).finally(() => { pending = null; });
  return pending;
}
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function mergeMovieScreenings(result = {}, screenings = {}, metadata = {}, now = Date.now()) {
  const seen = new Map();
  for (const f of [...(screenings.features || []), ...(result.features || [])]) {
    const original = f.properties || {}, facts = metadata[original.url] || {};
    const {sourceCheckedAt: metadataCheckedAt, ...movie} = facts;
    const p = {...original, ...movie, title: movie.movieTitle || original.movieTitle || original.title, ...(metadataCheckedAt ? {metadataCheckedAt} : {})};
    // A cinema location is not a showtime. Only genuinely dated screenings belong here.
    const start = Date.parse(p.start);
    if (!Number.isFinite(start) || start <= now || chains.test((p.venue || '') + ' ' + (p.source || ''))) continue;
    const coord = f.geometry?.coordinates;
    if (f.geometry?.type !== 'Point' || !Array.isArray(coord) || !coord.every(Number.isFinite)) continue;
    const key = [normalized(p.movieTitle || p.title), normalized(p.venue || p.address), start].join('|');
    if (!seen.has(key)) seen.set(key, {...f, properties: {...p, layer: 'movies'}});
  }
  const features = [...seen.values()].sort((a, b) => Date.parse(a.properties.start) - Date.parse(b.properties.start));
  return {...result, type: 'FeatureCollection', checkedAt: new Date(now).toISOString(), snapshotGeneratedAt: screenings.generatedAt || screenings.checkedAt || null, features, status: features.length ? 'partial' : 'empty', note, coverage: screenings.coverage || note};
}
export async function enrichMovies(result = {}) {
  try { const {screenings, metadata} = await movieData(); return mergeMovieScreenings(result, screenings, metadata); }
  catch { return mergeMovieScreenings(result); }
}
// Run in parallel with the backend: a university-calendar failure must not hide local theaters.
export async function loadMovieScreenings(loadRemote) {
  const [remote, local] = await Promise.allSettled([Promise.resolve().then(loadRemote), movieData()]);
  const result = remote.status === 'fulfilled' ? remote.value : {};
  return local.status === 'fulfilled' ? mergeMovieScreenings(result, local.value.screenings, local.value.metadata) : mergeMovieScreenings(result);
}
