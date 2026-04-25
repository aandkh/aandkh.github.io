import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.TMDB_API_KEY;
const PORT = Number(process.env.PORT || 8787);
const KEVIN_BACON_ID = 4724;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

const cachePath = path.join(__dirname, 'cache', 'tmdb-cache.json');
const chainCachePath = path.join(__dirname, 'cache', 'chain-cache.json');

function loadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const tmdbCache = loadJson(cachePath, {});
const chainCache = loadJson(chainCachePath, {});

async function tmdb(pathname, params = {}) {
  if (!API_KEY) throw new Error('TMDB_API_KEY is missing in .env');

  const q = new URLSearchParams({ api_key: API_KEY, language: 'en-US', ...params });
  const key = `${pathname}?${q.toString()}`;

  const now = Date.now();
  const cached = tmdbCache[key];
  if (cached && now - cached.t < CACHE_TTL_MS) return cached.d;

  const res = await fetch(`https://api.themoviedb.org/3${pathname}?${q.toString()}`);
  if (!res.ok) throw new Error(`TMDB request failed (${res.status}): ${pathname}`);
  const data = await res.json();

  tmdbCache[key] = { t: now, d: data };
  saveJson(cachePath, tmdbCache);
  return data;
}

async function getPerson(personId) {
  const d = await tmdb(`/person/${personId}`);
  return { id: d.id, name: d.name, profile_path: d.profile_path, popularity: d.popularity || 0 };
}

async function getActorMovies(actorId) {
  const d = await tmdb(`/person/${actorId}/movie_credits`);
  return (d.cast || []).filter(m => m.vote_count > 300 && m.release_date).map(m => ({
    id: m.id,
    title: m.title,
    release_date: m.release_date,
    vote_average: m.vote_average,
    vote_count: m.vote_count,
    poster_path: m.poster_path,
    popularity: m.popularity || 0
  }));
}

async function getMovieCast(movieId) {
  const d = await tmdb(`/movie/${movieId}/credits`);
  return (d.cast || []).slice(0, 20).map(c => ({ id: c.id, name: c.name, profile_path: c.profile_path, popularity: c.popularity || 0 }));
}

async function getNeighbors(actorId) {
  const movies = await getActorMovies(actorId);
  const out = [];
  for (const movie of movies.slice(0, 14)) {
    const cast = await getMovieCast(movie.id);
    for (const actor of cast) {
      if (actor.id === actorId) continue;
      out.push({ actorId: actor.id, actorName: actor.name, movie });
    }
  }
  return out;
}

function buildPath(fromStart, fromGoal, meet) {
  const left = [];
  let cur = meet;
  while (fromStart[cur] && fromStart[cur].prev !== null) {
    const edge = fromStart[cur];
    left.push({ movie: edge.movie, actor: { id: cur, name: edge.name } });
    cur = edge.prev;
  }
  left.reverse();

  const right = [];
  cur = meet;
  while (fromGoal[cur] && fromGoal[cur].prev !== null) {
    const edge = fromGoal[cur];
    right.push({ movie: edge.movie, actor: { id: edge.prev, name: edge.prevName } });
    cur = edge.prev;
  }

  return left.concat(right);
}

async function expandFrontier(queue, thisVisited, otherVisited, isStartSide) {
  const levelCount = queue.length;
  for (let i = 0; i < levelCount; i++) {
    const cur = queue.shift();
    const neighbors = await getNeighbors(cur.id);

    for (const n of neighbors) {
      if (thisVisited[n.actorId]) continue;

      thisVisited[n.actorId] = {
        prev: cur.id,
        name: n.actorName,
        prevName: cur.name,
        movie: {
          id: n.movie.id,
          title: n.movie.title,
          release_date: n.movie.release_date,
          vote_average: n.movie.vote_average,
          vote_count: n.movie.vote_count,
          poster_path: n.movie.poster_path
        }
      };

      if (otherVisited[n.actorId]) {
        return n.actorId;
      }

      queue.push({ id: n.actorId, name: n.actorName });
    }
  }
  return null;
}

async function bidirectionalBaconPath(startActorId) {
  const cacheKey = `${startActorId}->${KEVIN_BACON_ID}`;
  const cached = chainCache[cacheKey];
  if (cached && Date.now() - cached.t < CACHE_TTL_MS) return cached.d;

  const [startPerson, baconPerson] = await Promise.all([getPerson(startActorId), getPerson(KEVIN_BACON_ID)]);
  if (startPerson.id === KEVIN_BACON_ID) {
    const direct = { source: startPerson, target: baconPerson, chain: [] };
    chainCache[cacheKey] = { t: Date.now(), d: direct };
    saveJson(chainCachePath, chainCache);
    return direct;
  }

  const startQueue = [{ id: startPerson.id, name: startPerson.name }];
  const goalQueue = [{ id: baconPerson.id, name: baconPerson.name }];

  const fromStart = { [startPerson.id]: { prev: null, name: startPerson.name, prevName: null, movie: null } };
  const fromGoal = { [baconPerson.id]: { prev: null, name: baconPerson.name, prevName: null, movie: null } };

  const MAX_DEPTH = 6;
  let depth = 0;

  while (startQueue.length && goalQueue.length && depth < MAX_DEPTH) {
    depth += 1;
    const meetA = await expandFrontier(startQueue, fromStart, fromGoal, true);
    if (meetA !== null) {
      const result = { source: startPerson, target: baconPerson, chain: buildPath(fromStart, fromGoal, meetA) };
      chainCache[cacheKey] = { t: Date.now(), d: result };
      saveJson(chainCachePath, chainCache);
      return result;
    }

    const meetB = await expandFrontier(goalQueue, fromGoal, fromStart, false);
    if (meetB !== null) {
      const result = { source: startPerson, target: baconPerson, chain: buildPath(fromStart, fromGoal, meetB) };
      chainCache[cacheKey] = { t: Date.now(), d: result };
      saveJson(chainCachePath, chainCache);
      return result;
    }
  }

  const noPath = { source: startPerson, target: baconPerson, chain: [] };
  chainCache[cacheKey] = { t: Date.now(), d: noPath };
  saveJson(chainCachePath, chainCache);
  return noPath;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, tmdbConfigured: Boolean(API_KEY), kevinBaconId: KEVIN_BACON_ID });
});

app.get('/api/search/person', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'q is required' });
    const d = await tmdb('/search/person', { query: q, include_adult: 'false', page: 1 });
    const results = (d.results || []).slice(0, 10).map(p => ({ id: p.id, name: p.name, profile_path: p.profile_path, popularity: p.popularity || 0 }));
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/person/:id/movie-credits', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    const movies = await getActorMovies(id);
    res.json({ id, movies });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/movie/:id/credits', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    const cast = await getMovieCast(id);
    res.json({ id, cast });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/bacon-chain', async (req, res) => {
  try {
    const actorId = Number(req.query.actorId);
    if (!Number.isFinite(actorId)) return res.status(400).json({ error: 'actorId is required' });
    const result = await bidirectionalBaconPath(actorId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Six Degrees backend listening on http://localhost:${PORT}`);
});
