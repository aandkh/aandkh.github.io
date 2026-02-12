(function () {
  const IMG = 'https://image.tmdb.org/t/p/w185';
  const NO_FACE = 'https://placehold.co/200x300/0a122f/c5e2ff?text=No+Image';
  const POP_MOVIE_THRESHOLD = 300;
  const diffCaps = { easy: 3, medium: 4, hard: 5 };
  const seededPairs = {
    easy: [['Tom Hanks', 'Meg Ryan'], ['Emma Stone', 'Ryan Gosling'], ['Brad Pitt', 'George Clooney']],
    medium: [['Meryl Streep', 'Matt Damon'], ['Scarlett Johansson', 'Hugh Jackman'], ['Zendaya', 'Benedict Cumberbatch']],
    hard: [['Tilda Swinton', 'Vin Diesel'], ['Anya Taylor-Joy', 'Al Pacino'], ['Saoirse Ronan', 'Keanu Reeves']]
  };

  // Offline fallback graph for when TMDB is unavailable.
  const fallbackActors = {
    1:{id:1,name:'Tom Hanks',profile_path:null,filmCount:4},
    2:{id:2,name:'Meg Ryan',profile_path:null,filmCount:2},
    3:{id:3,name:'Leonardo DiCaprio',profile_path:null,filmCount:3},
    4:{id:4,name:'Kate Winslet',profile_path:null,filmCount:2},
    5:{id:5,name:'Meryl Streep',profile_path:null,filmCount:3},
    6:{id:6,name:'Matt Damon',profile_path:null,filmCount:3},
    7:{id:7,name:'Anne Hathaway',profile_path:null,filmCount:4},
    8:{id:8,name:'Chris Evans',profile_path:null,filmCount:2},
    9:{id:9,name:'Scarlett Johansson',profile_path:null,filmCount:3},
    10:{id:10,name:'Hugh Jackman',profile_path:null,filmCount:3},
    11:{id:11,name:'Tom Cruise',profile_path:null,filmCount:2},
    12:{id:12,name:'Emily Blunt',profile_path:null,filmCount:1},
    13:{id:13,name:'Robert Downey Jr.',profile_path:null,filmCount:3},
    14:{id:14,name:'Mark Ruffalo',profile_path:null,filmCount:2},
    15:{id:15,name:'Chris Hemsworth',profile_path:null,filmCount:2},
    16:{id:16,name:'Natalie Portman',profile_path:null,filmCount:1},
    17:{id:17,name:'Keira Knightley',profile_path:null,filmCount:1},
    18:{id:18,name:'Orlando Bloom',profile_path:null,filmCount:1},
    19:{id:19,name:'Johnny Depp',profile_path:null,filmCount:3},
    20:{id:20,name:'Helena Bonham Carter',profile_path:null,filmCount:1},
    21:{id:21,name:'Christian Bale',profile_path:null,filmCount:2}
  };

  const fallbackMovies = {
    101:{id:101,title:'Sleepless in Seattle',release_date:'1993-06-25',vote_average:6.8,vote_count:1200,poster_path:null,popularity:20,actors:[1,2]},
    102:{id:102,title:'Catch Me If You Can',release_date:'2002-12-25',vote_average:8.1,vote_count:15000,poster_path:null,popularity:55,actors:[1,3]},
    103:{id:103,title:'Titanic',release_date:'1997-12-19',vote_average:7.9,vote_count:25000,poster_path:null,popularity:70,actors:[3,4]},
    104:{id:104,title:'The Devil Wears Prada',release_date:'2006-06-30',vote_average:7.0,vote_count:9000,poster_path:null,popularity:40,actors:[5,7]},
    105:{id:105,title:'Interstellar',release_date:'2014-11-07',vote_average:8.4,vote_count:36000,poster_path:null,popularity:80,actors:[6,7]},
    106:{id:106,title:'Avengers: Endgame',release_date:'2019-04-26',vote_average:8.3,vote_count:26000,poster_path:null,popularity:90,actors:[8,9,13,14,15]},
    107:{id:107,title:'Movie 43',release_date:'2013-01-25',vote_average:4.6,vote_count:1500,poster_path:null,popularity:18,actors:[9,10]},
    108:{id:108,title:'The Prestige',release_date:'2006-10-20',vote_average:8.2,vote_count:14000,poster_path:null,popularity:62,actors:[10,7,21]},
    109:{id:109,title:'Edge of Tomorrow',release_date:'2014-06-06',vote_average:7.9,vote_count:13000,poster_path:null,popularity:58,actors:[11,12]},
    110:{id:110,title:'Tropic Thunder',release_date:'2008-08-13',vote_average:6.7,vote_count:5400,poster_path:null,popularity:46,actors:[11,13]},
    111:{id:111,title:'Thor',release_date:'2011-05-06',vote_average:6.8,vote_count:22000,poster_path:null,popularity:60,actors:[15,16]},
    112:{id:112,title:'Pirates of the Caribbean',release_date:'2003-07-09',vote_average:8.0,vote_count:21000,poster_path:null,popularity:72,actors:[17,18,19]},
    113:{id:113,title:'Sweeney Todd',release_date:'2007-12-21',vote_average:7.2,vote_count:5400,poster_path:null,popularity:38,actors:[19,20]},
    114:{id:114,title:'Public Enemies',release_date:'2009-07-01',vote_average:6.7,vote_count:3300,poster_path:null,popularity:30,actors:[19,21]},
    115:{id:115,title:'The Departed',release_date:'2006-10-06',vote_average:8.1,vote_count:14500,poster_path:null,popularity:64,actors:[3,6]}
  };

  const fallbackPairs = [[1,4],[5,10],[11,9],[17,6],[2,15]];
  let fallbackMode = false;

  const state = { difficulty: 'medium', source: null, target: null, chain: [], suggestions: [], optimal: null };
  const el = {
    source: document.getElementById('source-card'),
    target: document.getElementById('target-card'),
    chain: document.getElementById('chain'),
    input: document.getElementById('actor-input'),
    useTop: document.getElementById('use-top'),
    suggestions: document.getElementById('suggestions'),
    status: document.getElementById('status')
  };

  function setStatus(msg, bad) {
    el.status.textContent = msg;
    el.status.style.color = bad ? '#ff9ab0' : '#85d3ff';
  }

  function cacheGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }
  function cacheSet(k, v) { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d: v })); }
  async function withCache(key, ttl, fn) {
    const c = cacheGet(key);
    if (c && Date.now() - c.t < ttl) return c.d;
    const d = await fn();
    cacheSet(key, d);
    return d;
  }

  function fallbackFilmsFor(actorId){ return Object.values(fallbackMovies).filter(m => m.actors.includes(actorId)); }

  async function tmdb(url) {
    const headers = window.TMDB_ACCESS_TOKEN ? { Authorization: 'Bearer ' + window.TMDB_ACCESS_TOKEN } : {};
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error('TMDB request failed: ' + r.status);
    return r.json();
  }

  async function searchActors(q) {
    const needle = q.toLowerCase();
    if (fallbackMode) {
      return Object.values(fallbackActors).filter(a => a.name.toLowerCase().includes(needle)).slice(0, 8).map(a => ({...a, known_for_department: 'Acting'}));
    }
    return withCache('sd:search:' + needle, 864e5 * 7, async () => {
      const d = await tmdb(`https://api.themoviedb.org/3/search/person?api_key=${window.TMDB_API_KEY}&query=${encodeURIComponent(q)}&include_adult=false`);
      return (d.results || []).slice(0, 8).map(a => ({ id: a.id, name: a.name, profile_path: a.profile_path, known_for_department: a.known_for_department }));
    });
  }

  async function actorDetails(id) {
    if (fallbackMode) {
      const a = fallbackActors[id];
      return { ...a, films: fallbackFilmsFor(id) };
    }
    return withCache('sd:actor:' + id, 864e5 * 30, async () => {
      const [person, credits] = await Promise.all([
        tmdb(`https://api.themoviedb.org/3/person/${id}?api_key=${window.TMDB_API_KEY}`),
        tmdb(`https://api.themoviedb.org/3/person/${id}/movie_credits?api_key=${window.TMDB_API_KEY}`)
      ]);
      const films = (credits.cast || []).filter(m => m.vote_count > POP_MOVIE_THRESHOLD && m.release_date).map(m => ({
        id: m.id, title: m.title, release_date: m.release_date, vote_average: m.vote_average, vote_count: m.vote_count, poster_path: m.poster_path, popularity: m.popularity || 0
      }));
      return { id: person.id, name: person.name, profile_path: person.profile_path, filmCount: films.length, films };
    });
  }

  async function movieCast(movieId) {
    if (fallbackMode) {
      const m = fallbackMovies[movieId];
      return (m ? m.actors : []).map(id => fallbackActors[id]);
    }
    return withCache('sd:cast:' + movieId, 864e5 * 30, async () => {
      const d = await tmdb(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${window.TMDB_API_KEY}`);
      return (d.cast || []).slice(0, 16).map(c => ({ id: c.id, name: c.name, profile_path: c.profile_path }));
    });
  }

  async function bestSharedMovie(a, b) {
    const [x, y] = await Promise.all([actorDetails(a.id), actorDetails(b.id)]);
    const ys = new Set(y.films.map(f => f.id));
    const shared = x.films.filter(f => ys.has(f.id));
    if (!shared.length) return null;
    shared.sort((m1, m2) => (m2.popularity + m2.vote_count * 0.02) - (m1.popularity + m1.vote_count * 0.02));
    return shared[0];
  }

  async function shortestPath(startId, targetId, maxDepth) {
    const q = [[startId, []]];
    const seen = new Set([startId]);
    while (q.length) {
      const [cur, path] = q.shift();
      if (path.length / 2 >= maxDepth) continue;
      const actor = await actorDetails(cur);
      for (const mv of actor.films.slice(0, 10)) {
        const cast = await movieCast(mv.id);
        for (const c of cast) {
          if (seen.has(c.id)) continue;
          const np = path.concat([{ type: 'movie', data: mv }, { type: 'actor', data: c }]);
          if (c.id === targetId) return np;
          seen.add(c.id);
          q.push([c.id, np]);
        }
      }
    }
    return null;
  }

  function actorCardHTML(a) {
    const src = a && a.profile_path ? IMG + a.profile_path : NO_FACE;
    return `<div class="head"><img loading="lazy" src="${src}" alt=""><div><div class="name">${a ? a.name : 'Loading…'}</div><div class="muted">${a ? `${a.filmCount || 0} films` : ''}</div></div></div>`;
  }

  function render() {
    el.source.innerHTML = actorCardHTML(state.source);
    el.target.innerHTML = actorCardHTML(state.target);
    el.useTop.disabled = !state.suggestions.length;
    el.chain.innerHTML = state.chain.map(step => {
      const ps = step.movie.poster_path ? IMG + step.movie.poster_path : NO_FACE;
      const y = step.movie.release_date ? step.movie.release_date.slice(0, 4) : '—';
      const hs = step.actor.profile_path ? IMG + step.actor.profile_path : NO_FACE;
      return `<div class="glass movie"><img loading="lazy" src="${ps}"><div><div class="name">${step.movie.title}</div><div class="muted">${y} · ⭐ ${Number(step.movie.vote_average || 0).toFixed(1)}</div></div></div>
              <div class="glass actor"><img loading="lazy" src="${hs}" style="width:52px;height:52px;border-radius:999px;object-fit:cover"><div><div class="name">${step.actor.name}</div></div></div>`;
    }).join('');
  }

  async function pickActor(actor) {
    if (!state.source || !state.target) return;
    const prev = state.chain.length ? state.chain[state.chain.length - 1].actor : state.source;
    setStatus('Checking link…');
    try {
      const shared = await bestSharedMovie(prev, actor);
      if (!shared) return setStatus('No shared film.', true);
      state.chain.push({ movie: shared, actor });
      state.suggestions = []; el.suggestions.innerHTML = ''; el.input.value = '';
      if (actor.id === state.target.id) {
        const shortest = await shortestPath(state.source.id, state.target.id, diffCaps[state.difficulty]);
        const optimalDegrees = shortest ? shortest.filter(n => n.type === 'actor').length : state.chain.length;
        const deg = state.chain.length;
        const extra = Math.max(0, deg - optimalDegrees);
        const score = Math.max(50, 1000 - deg * 100 - extra * 10 + (deg <= optimalDegrees ? 200 : 0));
        const stars = deg <= optimalDegrees ? 3 : deg === optimalDegrees + 1 ? 2 : 1;
        setStatus(`Optimal Path. Degrees ${deg}. Score ${score}. ${'⭐'.repeat(stars)}`);
      } else {
        setStatus('Connected.');
      }
      render();
    } catch {
      setStatus('Validation failed.', true);
    }
  }

  function pickFallbackPair() {
    const [s, t] = fallbackPairs[Math.floor(Math.random() * fallbackPairs.length)];
    state.source = { ...fallbackActors[s], films: fallbackFilmsFor(s) };
    state.target = { ...fallbackActors[t], films: fallbackFilmsFor(t) };
    render();
    setStatus('Connected. (offline fallback mode)');
  }

  async function resetRound() {
    state.chain = []; state.suggestions = []; el.suggestions.innerHTML = ''; el.input.value = '';
    state.source = null; state.target = null; render(); setStatus('Loading matchup…');
    try {
      if (fallbackMode) return pickFallbackPair();
      const pair = seededPairs[state.difficulty][Math.floor(Math.random() * seededPairs[state.difficulty].length)];
      const [a, b] = await Promise.all([searchActors(pair[0]), searchActors(pair[1])]);
      if (!a[0] || !b[0]) throw new Error('No actor pair');
      const [src, tgt] = await Promise.all([actorDetails(a[0].id), actorDetails(b[0].id)]);
      state.source = src; state.target = tgt; render(); setStatus('Connected.');
    } catch {
      fallbackMode = true;
      pickFallbackPair();
    }
  }

  el.input.addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    if (!q) { state.suggestions = []; el.suggestions.innerHTML = ''; el.useTop.disabled = true; return; }
    try {
      const found = await searchActors(q);
      state.suggestions = found.filter(a => a.known_for_department === 'Acting' || !a.known_for_department);
    } catch {
      fallbackMode = true;
      state.suggestions = Object.values(fallbackActors).filter(a => a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
      setStatus('Using offline fallback mode.');
    }
    if (!state.suggestions.length && fallbackMode) {
      state.suggestions = Object.values(fallbackActors).slice(0, 8);
    }
    el.useTop.disabled = !state.suggestions.length;
    el.suggestions.innerHTML = state.suggestions.map(s => {
      const src = s.profile_path ? IMG + s.profile_path : NO_FACE;
      return `<div class="glass suggestion" data-id="${s.id}"><img loading="lazy" src="${src}"><div>${s.name}</div></div>`;
    }).join('');
  });

  el.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && state.suggestions[0]) pickActor(state.suggestions[0]); });
  el.useTop.addEventListener('click', () => state.suggestions[0] && pickActor(state.suggestions[0]));
  el.suggestions.addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const id = Number(row.getAttribute('data-id'));
    const actor = state.suggestions.find(s => s.id === id);
    if (actor) pickActor(actor);
  });

  document.getElementById('new-match').addEventListener('click', resetRound);
  document.querySelectorAll('[data-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      state.difficulty = btn.getAttribute('data-diff');
      resetRound();
    });
  });

  if (!window.TMDB_API_KEY) fallbackMode = true;
  resetRound();
})();
