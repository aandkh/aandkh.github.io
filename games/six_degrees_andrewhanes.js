window.TMDB_API_KEY = "91a1ed2c83fc7c0f6fc193825e438650";

(() => {
  const IMG = 'https://image.tmdb.org/t/p/w185';
  const NO_FACE = 'https://placehold.co/200x300/0a122f/c5e2ff?text=Actor';
  const NO_POSTER = 'https://placehold.co/200x300/121d42/d7e8ff?text=Movie';
  const POP_MOVIE_THRESHOLD = 300;

  const ERAS = [
    { label: '1970s', from: 1970, to: 1979 },
    { label: '1980s', from: 1980, to: 1989 },
    { label: '1990s', from: 1990, to: 1999 },
    { label: '2000s', from: 2000, to: 2009 },
    { label: '2010s', from: 2010, to: 2019 },
    { label: '2020s', from: 2020, to: 2026 }
  ];

  const DEPTH = { easy: 3, medium: 4, hard: 5 };

  // Offline fallback graph, used only if TMDB is unavailable.
  const FALLBACK_MOVIES = [
    { id: 1, title: 'Sleepless in Seattle', year: 1993, rating: 6.8, actors: ['Tom Hanks', 'Meg Ryan'] },
    { id: 2, title: 'Catch Me If You Can', year: 2002, rating: 8.1, actors: ['Tom Hanks', 'Leonardo DiCaprio'] },
    { id: 3, title: 'Titanic', year: 1997, rating: 7.9, actors: ['Leonardo DiCaprio', 'Kate Winslet'] },
    { id: 4, title: 'The Departed', year: 2006, rating: 8.1, actors: ['Leonardo DiCaprio', 'Matt Damon'] },
    { id: 5, title: 'The Devil Wears Prada', year: 2006, rating: 7.0, actors: ['Meryl Streep', 'Anne Hathaway'] },
    { id: 6, title: 'Interstellar', year: 2014, rating: 8.4, actors: ['Anne Hathaway', 'Matt Damon'] },
    { id: 7, title: 'The Prestige', year: 2006, rating: 8.2, actors: ['Hugh Jackman', 'Christian Bale'] },
    { id: 8, title: 'Avengers: Endgame', year: 2019, rating: 8.3, actors: ['Scarlett Johansson', 'Chris Evans', 'Robert Downey Jr.'] },
    { id: 9, title: 'Tropic Thunder', year: 2008, rating: 6.7, actors: ['Tom Cruise', 'Robert Downey Jr.'] },
    { id: 10, title: 'Edge of Tomorrow', year: 2014, rating: 7.9, actors: ['Tom Cruise', 'Emily Blunt'] }
  ];

  const FALLBACK_PAIRS = [
    ['Tom Hanks', 'Kate Winslet'],
    ['Meryl Streep', 'Matt Damon'],
    ['Tom Cruise', 'Scarlett Johansson']
  ];

  const state = {
    difficulty: 'medium',
    source: null,
    target: null,
    sourceEra: null,
    targetEra: null,
    chain: [],
    suggestions: [],
    shortest: null,
    tmdbAvailable: true,
    loading: false
  };

  const el = {
    source: document.getElementById('source-card'),
    target: document.getElementById('target-card'),
    chain: document.getElementById('chain'),
    input: document.getElementById('actor-input'),
    useTop: document.getElementById('use-top'),
    showShortest: document.getElementById('show-shortest'),
    suggestions: document.getElementById('suggestions'),
    status: document.getElementById('status'),
    path: document.getElementById('path')
  };

  function setStatus(msg, tone = 'info') {
    el.status.textContent = msg;
    el.status.classList.remove('error', 'ok');
    if (tone === 'error') el.status.classList.add('error');
    if (tone === 'ok') el.status.classList.add('ok');
  }

  function cacheGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }
  function cacheSet(k, v) { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d: v })); }
  async function withCache(key, ttlMs, fn) {
    const c = cacheGet(key);
    if (c && Date.now() - c.t < ttlMs) return c.d;
    const d = await fn();
    cacheSet(key, d);
    return d;
  }

  async function tmdb(path, params = {}) {
    if (!window.TMDB_API_KEY) throw new Error('TMDB key missing');
    const q = new URLSearchParams({ api_key: window.TMDB_API_KEY, language: 'en-US', ...params });
    const headers = window.TMDB_ACCESS_TOKEN ? { Authorization: 'Bearer ' + window.TMDB_ACCESS_TOKEN } : {};
    const r = await fetch(`https://api.themoviedb.org/3${path}?${q.toString()}`, { headers });
    if (!r.ok) throw new Error(`TMDB ${r.status}`);
    return r.json();
  }

  function normalizeMovie(m) {
    return {
      id: m.id,
      title: m.title,
      year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
      rating: Number(m.vote_average || 0),
      vote_count: Number(m.vote_count || 0),
      poster: m.poster_path ? `${IMG}${m.poster_path}` : NO_POSTER,
      release_date: m.release_date || null,
      popularity: Number(m.popularity || 0)
    };
  }

  async function actorDetails(actorId) {
    if (!state.tmdbAvailable) return fallbackActorDetails(actorId);

    return withCache(`tmdb-actor-${actorId}`, 1000 * 60 * 60 * 24, async () => {
      const [person, credits] = await Promise.all([
        tmdb(`/person/${actorId}`),
        tmdb(`/person/${actorId}/movie_credits`)
      ]);

      const films = (credits.cast || [])
        .filter(m => m.vote_count > POP_MOVIE_THRESHOLD && m.release_date)
        .map(normalizeMovie);

      return {
        id: person.id,
        name: person.name,
        img: person.profile_path ? `${IMG}${person.profile_path}` : NO_FACE,
        filmCount: films.length,
        films
      };
    });
  }

  async function searchActors(query) {
    if (!state.tmdbAvailable) return fallbackSearchActors(query);

    const q = query.trim();
    if (!q) return [];

    return withCache(`tmdb-search-${q.toLowerCase()}`, 1000 * 60 * 10, async () => {
      const d = await tmdb('/search/person', { query: q, include_adult: 'false', page: 1 });
      return (d.results || [])
        .filter(a => a.known_for_department === 'Acting' || !a.known_for_department)
        .slice(0, 10)
        .map(a => ({
          id: a.id,
          name: a.name,
          img: a.profile_path ? `${IMG}${a.profile_path}` : NO_FACE
        }));
    });
  }

  async function movieCast(movieId) {
    if (!state.tmdbAvailable) return fallbackMovieCast(movieId);
    return withCache(`tmdb-movie-cast-${movieId}`, 1000 * 60 * 60 * 24, async () => {
      const d = await tmdb(`/movie/${movieId}/credits`);
      return (d.cast || []).slice(0, 18).map(c => ({ id: c.id, name: c.name, img: c.profile_path ? `${IMG}${c.profile_path}` : NO_FACE }));
    });
  }

  async function bestSharedMovie(actorA, actorB) {
    const [a, b] = await Promise.all([actorDetails(actorA.id), actorDetails(actorB.id)]);
    const bSet = new Set(b.films.map(m => m.id));
    const shared = a.films.filter(m => bSet.has(m.id));
    if (!shared.length) return null;
    shared.sort((x, y) => (y.popularity + y.vote_count * 0.02) - (x.popularity + x.vote_count * 0.02));
    return shared[0];
  }

  async function shortestPath(startId, targetId, maxDepth) {
    const queue = [[startId, []]];
    const seen = new Set([startId]);

    while (queue.length) {
      const [cur, path] = queue.shift();
      if (path.length / 2 >= maxDepth) continue;

      const actor = await actorDetails(cur);
      for (const movie of actor.films.slice(0, 12)) {
        const cast = await movieCast(movie.id);
        for (const c of cast) {
          if (seen.has(c.id)) continue;
          const np = path.concat([{ type: 'movie', data: movie }, { type: 'actor', data: c }]);
          if (c.id === targetId) return np;
          seen.add(c.id);
          queue.push([c.id, np]);
        }
      }
    }
    return null;
  }

  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  async function randomFamousActorFromEra(era) {
    const page = randomInt(1, 5);
    const discover = await tmdb('/discover/movie', {
      include_adult: 'false',
      include_video: 'false',
      sort_by: 'popularity.desc',
      'primary_release_date.gte': `${era.from}-01-01`,
      'primary_release_date.lte': `${era.to}-12-31`,
      'vote_count.gte': '1000',
      page
    });

    const movies = (discover.results || []).filter(m => m.release_date);
    if (!movies.length) throw new Error('No famous movies in era');

    for (let i = 0; i < Math.min(8, movies.length); i++) {
      const mv = randomPick(movies);
      const credits = await tmdb(`/movie/${mv.id}/credits`);
      const cast = (credits.cast || []).filter(c => c.known_for_department === 'Acting' || c.popularity > 1).slice(0, 8);
      if (!cast.length) continue;
      const person = randomPick(cast);
      const actor = await actorDetails(person.id);
      if (actor.filmCount > 2) return actor;
    }

    throw new Error('Could not pick famous actor from era');
  }

  async function newMatchupLive() {
    const sourceEra = randomPick(ERAS);
    let targetEra = randomPick(ERAS);
    if (targetEra.label === sourceEra.label) targetEra = randomPick(ERAS);

    const source = await randomFamousActorFromEra(sourceEra);
    let target = await randomFamousActorFromEra(targetEra);

    // avoid same actor
    let guard = 0;
    while (target.id === source.id && guard < 5) {
      target = await randomFamousActorFromEra(targetEra);
      guard += 1;
    }

    state.source = source;
    state.target = target;
    state.sourceEra = sourceEra.label;
    state.targetEra = targetEra.label;
  }

  function fallbackActorsList() {
    const s = new Set();
    FALLBACK_MOVIES.forEach(m => m.actors.forEach(a => s.add(a)));
    return [...s];
  }

  function fallbackActorDetails(name) {
    const films = FALLBACK_MOVIES.filter(m => m.actors.includes(name)).map(m => ({
      id: m.id,
      title: m.title,
      year: m.year,
      rating: m.rating,
      vote_count: 1000,
      poster: NO_POSTER,
      popularity: m.rating * 10
    }));
    return Promise.resolve({ id: name, name, img: NO_FACE, filmCount: films.length, films });
  }

  function fallbackSearchActors(query) {
    const q = query.toLowerCase();
    const all = fallbackActorsList();
    const filtered = all.filter(n => n.toLowerCase().includes(q)).slice(0, 10);
    return Promise.resolve(filtered.map(name => ({ id: name, name, img: NO_FACE })));
  }

  function fallbackMovieCast(movieId) {
    const m = FALLBACK_MOVIES.find(x => x.id === movieId);
    const cast = (m ? m.actors : []).map(name => ({ id: name, name, img: NO_FACE }));
    return Promise.resolve(cast);
  }

  function fallbackBestSharedMovie(a, b) {
    const movie = FALLBACK_MOVIES.find(m => m.actors.includes(a.id) && m.actors.includes(b.id));
    return movie ? { id: movie.id, title: movie.title, year: movie.year, rating: movie.rating, poster: NO_POSTER, popularity: movie.rating * 10, vote_count: 1000 } : null;
  }

  function actorCardHTML(actor, eraLabel) {
    return `<div class="head"><img src="${actor?.img || NO_FACE}" alt=""><div><div class="name">${actor?.name || 'Loading…'}</div><div class="muted">${actor?.filmCount || 0} films${eraLabel ? ` · ${eraLabel}` : ''}</div></div></div>`;
  }

  function renderChain() {
    el.chain.innerHTML = state.chain.map(step => `
      <div class="glass movie"><img src="${step.movie.poster || NO_POSTER}"><div><div class="name">${step.movie.title}</div><div class="muted">${step.movie.year || '—'} · ⭐ ${(step.movie.rating || 0).toFixed(1)}</div></div></div>
      <div class="glass actor"><img src="${step.actor.img || NO_FACE}" style="width:52px;height:52px;border-radius:999px"><div class="name">${step.actor.name}</div></div>
    `).join('');
  }

  function renderSuggestions() {
    el.useTop.disabled = !state.suggestions.length || state.loading;
    el.suggestions.innerHTML = state.suggestions.map(a => `
      <div class="glass suggestion" data-id="${a.id}"><img src="${a.img || NO_FACE}"><div>${a.name}</div></div>
    `).join('');
  }

  function render() {
    el.source.innerHTML = actorCardHTML(state.source, state.sourceEra);
    el.target.innerHTML = actorCardHTML(state.target, state.targetEra);
    renderChain();
    renderSuggestions();
  }

  function scoreWin() {
    const degrees = state.chain.length;
    const optimalDegrees = state.shortest ? state.shortest.filter(x => x.type === 'actor').length : degrees;
    const extra = Math.max(0, degrees - optimalDegrees);
    const score = Math.max(50, 1000 - degrees * 100 - extra * 10 + (degrees <= optimalDegrees ? 200 : 0));
    const stars = degrees <= optimalDegrees ? 3 : degrees === optimalDegrees + 1 ? 2 : 1;
    setStatus(`Connected. Score ${score}. ${'⭐'.repeat(stars)}`, 'ok');
  }

  async function selectActor(actor) {
    if (!state.source || !state.target) return;
    const prev = state.chain.length ? state.chain[state.chain.length - 1].actor : state.source;
    if (prev.id === actor.id) return setStatus('Pick a different actor.', 'error');

    state.loading = true;
    renderSuggestions();
    setStatus('Checking connection…');

    try {
      const movie = state.tmdbAvailable ? await bestSharedMovie(prev, actor) : fallbackBestSharedMovie(prev, actor);
      if (!movie) return setStatus('No shared film.', 'error');

      state.chain.push({ movie, actor });
      state.suggestions = [];
      el.input.value = '';
      render();

      if (actor.id === state.target.id) {
        scoreWin();
        el.showShortest.disabled = false;
      } else {
        setStatus('Connected.');
      }
    } catch (e) {
      setStatus('Validation failed.', 'error');
      if (state.tmdbAvailable) {
        state.tmdbAvailable = false;
        setStatus('TMDB unavailable. Switched to offline mode.', 'error');
      }
    } finally {
      state.loading = false;
      renderSuggestions();
    }
  }

  async function computeShortestPath() {
    try {
      if (state.tmdbAvailable) {
        state.shortest = await shortestPath(state.source.id, state.target.id, DEPTH[state.difficulty]);
      } else {
        state.shortest = null;
      }
    } catch {
      state.shortest = null;
    }
  }

  async function newMatchup() {
    state.loading = true;
    state.chain = [];
    state.suggestions = [];
    state.shortest = null;
    el.path.style.display = 'none';
    el.path.textContent = '';
    el.showShortest.disabled = true;
    setStatus('Generating random famous actors…');
    render();

    try {
      if (!window.TMDB_API_KEY) throw new Error('No TMDB key');
      await newMatchupLive();
      await computeShortestPath();
      setStatus(`Ready. ${state.sourceEra} → ${state.targetEra}`);
      state.tmdbAvailable = true;
    } catch {
      state.tmdbAvailable = false;
      const [a, b] = randomPick(FALLBACK_PAIRS);
      state.source = await fallbackActorDetails(a);
      state.target = await fallbackActorDetails(b);
      state.sourceEra = 'offline';
      state.targetEra = 'offline';
      setStatus('TMDB unavailable. Offline mode active.', 'error');
    } finally {
      state.loading = false;
      render();
    }
  }

  async function updateSearch(query) {
    const q = query.trim();
    if (!q) { state.suggestions = []; renderSuggestions(); return; }

    try {
      const found = await searchActors(q);
      state.suggestions = found.slice(0, 8);
      if (!state.suggestions.length && !state.tmdbAvailable) state.suggestions = (await fallbackSearchActors('')).slice(0, 8);
      renderSuggestions();
    } catch {
      state.tmdbAvailable = false;
      state.suggestions = (await fallbackSearchActors(q)).slice(0, 8);
      renderSuggestions();
      setStatus('Search switched to offline mode.', 'error');
    }
  }

  el.input.addEventListener('input', e => updateSearch(e.target.value));
  el.input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && state.suggestions[0]) selectActor(state.suggestions[0]);
  });

  el.useTop.addEventListener('click', () => state.suggestions[0] && selectActor(state.suggestions[0]));

  el.suggestions.addEventListener('click', e => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const id = row.getAttribute('data-id');
    const actor = state.suggestions.find(a => String(a.id) === String(id));
    if (actor) selectActor(actor);
  });

  el.showShortest.addEventListener('click', () => {
    if (!state.shortest) {
      el.path.style.display = 'block';
      el.path.textContent = 'Shortest path unavailable in current mode.';
      return;
    }

    const items = [state.source.name].concat(state.shortest.map(n => n.type === 'movie' ? `🎬 ${n.data.title}` : `🧑 ${n.data.name}`));
    el.path.style.display = 'block';
    el.path.textContent = items.join(' → ');
  });

  document.getElementById('new-match').addEventListener('click', newMatchup);
  document.querySelectorAll('[data-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      state.difficulty = btn.getAttribute('data-diff');
      newMatchup();
    });
  });

  newMatchup();
})();
