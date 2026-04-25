(() => {
  const NO_FACE = 'https://placehold.co/200x300/0a122f/c5e2ff?text=Actor';
  const NO_POSTER = 'https://placehold.co/200x300/121d42/d7e8ff?text=Movie';

  const ACTORS = {
    'Tom Hanks': { img: NO_FACE }, 'Meg Ryan': { img: NO_FACE }, 'Leonardo DiCaprio': { img: NO_FACE },
    'Kate Winslet': { img: NO_FACE }, 'Matt Damon': { img: NO_FACE }, 'Meryl Streep': { img: NO_FACE },
    'Anne Hathaway': { img: NO_FACE }, 'Hugh Jackman': { img: NO_FACE }, 'Scarlett Johansson': { img: NO_FACE },
    'Chris Evans': { img: NO_FACE }, 'Robert Downey Jr.': { img: NO_FACE }, 'Mark Ruffalo': { img: NO_FACE },
    'Chris Hemsworth': { img: NO_FACE }, 'Natalie Portman': { img: NO_FACE }, 'Tom Cruise': { img: NO_FACE },
    'Emily Blunt': { img: NO_FACE }, 'Christian Bale': { img: NO_FACE }, 'Johnny Depp': { img: NO_FACE },
    'Helena Bonham Carter': { img: NO_FACE }, 'Keira Knightley': { img: NO_FACE }, 'Orlando Bloom': { img: NO_FACE },
    'Brad Pitt': { img: NO_FACE }, 'George Clooney': { img: NO_FACE }, 'Ryan Gosling': { img: NO_FACE },
    'Emma Stone': { img: NO_FACE }
  };

  const MOVIES = [
    { id: 1, title: 'Sleepless in Seattle', year: 1993, rating: 6.8, actors: ['Tom Hanks', 'Meg Ryan'], poster: NO_POSTER },
    { id: 2, title: 'Catch Me If You Can', year: 2002, rating: 8.1, actors: ['Tom Hanks', 'Leonardo DiCaprio'], poster: NO_POSTER },
    { id: 3, title: 'Titanic', year: 1997, rating: 7.9, actors: ['Leonardo DiCaprio', 'Kate Winslet'], poster: NO_POSTER },
    { id: 4, title: 'The Departed', year: 2006, rating: 8.1, actors: ['Leonardo DiCaprio', 'Matt Damon'], poster: NO_POSTER },
    { id: 5, title: 'The Devil Wears Prada', year: 2006, rating: 7.0, actors: ['Meryl Streep', 'Anne Hathaway'], poster: NO_POSTER },
    { id: 6, title: 'Interstellar', year: 2014, rating: 8.4, actors: ['Anne Hathaway', 'Matt Damon'], poster: NO_POSTER },
    { id: 7, title: 'The Prestige', year: 2006, rating: 8.2, actors: ['Hugh Jackman', 'Christian Bale'], poster: NO_POSTER },
    { id: 8, title: 'Les Misérables', year: 2012, rating: 7.5, actors: ['Hugh Jackman', 'Anne Hathaway'], poster: NO_POSTER },
    { id: 9, title: 'Avengers: Endgame', year: 2019, rating: 8.3, actors: ['Scarlett Johansson', 'Chris Evans', 'Robert Downey Jr.', 'Mark Ruffalo', 'Chris Hemsworth'], poster: NO_POSTER },
    { id: 10, title: 'Thor', year: 2011, rating: 6.8, actors: ['Chris Hemsworth', 'Natalie Portman'], poster: NO_POSTER },
    { id: 11, title: 'Tropic Thunder', year: 2008, rating: 6.7, actors: ['Tom Cruise', 'Robert Downey Jr.'], poster: NO_POSTER },
    { id: 12, title: 'Edge of Tomorrow', year: 2014, rating: 7.9, actors: ['Tom Cruise', 'Emily Blunt'], poster: NO_POSTER },
    { id: 13, title: 'Sweeney Todd', year: 2007, rating: 7.2, actors: ['Johnny Depp', 'Helena Bonham Carter'], poster: NO_POSTER },
    { id: 14, title: 'Public Enemies', year: 2009, rating: 6.7, actors: ['Johnny Depp', 'Christian Bale'], poster: NO_POSTER },
    { id: 15, title: 'Pirates of the Caribbean', year: 2003, rating: 8.0, actors: ['Johnny Depp', 'Keira Knightley', 'Orlando Bloom'], poster: NO_POSTER },
    { id: 16, title: 'Ocean\'s Eleven', year: 2001, rating: 7.7, actors: ['Brad Pitt', 'George Clooney', 'Matt Damon'], poster: NO_POSTER },
    { id: 17, title: 'La La Land', year: 2016, rating: 8.0, actors: ['Ryan Gosling', 'Emma Stone'], poster: NO_POSTER },
    { id: 18, title: 'Crazy, Stupid, Love.', year: 2011, rating: 7.4, actors: ['Ryan Gosling', 'Emma Stone'], poster: NO_POSTER },
    { id: 19, title: 'Birdman', year: 2014, rating: 7.7, actors: ['Emma Stone', 'Naomi Watts'], poster: NO_POSTER },
    { id: 20, title: 'Spotlight', year: 2015, rating: 8.1, actors: ['Mark Ruffalo', 'Rachel McAdams'], poster: NO_POSTER }
  ];

  const DIFF_PAIRS = {
    easy: [['Tom Hanks', 'Kate Winslet'], ['Ryan Gosling', 'Emma Stone'], ['Scarlett Johansson', 'Chris Hemsworth']],
    medium: [['Meryl Streep', 'Matt Damon'], ['Tom Cruise', 'Natalie Portman'], ['Brad Pitt', 'Scarlett Johansson']],
    hard: [['Meg Ryan', 'Christian Bale'], ['Keira Knightley', 'Anne Hathaway'], ['George Clooney', 'Hugh Jackman']]
  };

  const state = {
    difficulty: 'medium',
    source: null,
    target: null,
    chain: [], // [{movie, actor}]
    suggestions: [],
    shortest: null
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

  function actorMovies(actorName) { return MOVIES.filter(m => m.actors.includes(actorName)); }
  function neighbors(actorName) {
    const out = [];
    actorMovies(actorName).forEach(movie => movie.actors.forEach(a => {
      if (a !== actorName) out.push({ actor: a, movie });
    }));
    return out;
  }

  function bestSharedMovie(a, b) {
    const aMovies = actorMovies(a);
    const bSet = new Set(actorMovies(b).map(m => m.id));
    const shared = aMovies.filter(m => bSet.has(m.id));
    if (!shared.length) return null;
    return shared.sort((x, y) => (y.rating * 100 + y.year) - (x.rating * 100 + x.year))[0];
  }

  function shortestPath(start, target, maxDepth = 5) {
    const q = [[start, []]];
    const seen = new Set([start]);
    while (q.length) {
      const [cur, path] = q.shift();
      if (path.length / 2 >= maxDepth) continue;
      for (const nxt of neighbors(cur)) {
        if (seen.has(nxt.actor)) continue;
        const np = path.concat([{ type: 'movie', data: nxt.movie }, { type: 'actor', data: nxt.actor }]);
        if (nxt.actor === target) return np;
        seen.add(nxt.actor);
        q.push([nxt.actor, np]);
      }
    }
    return null;
  }

  function setStatus(msg, tone = 'info') {
    el.status.textContent = msg;
    el.status.classList.remove('error', 'ok');
    if (tone === 'error') el.status.classList.add('error');
    if (tone === 'ok') el.status.classList.add('ok');
  }

  function actorCard(name) {
    const filmCount = actorMovies(name).length;
    return `<div class="head"><img src="${NO_FACE}" alt=""><div><div class="name">${name || 'Loading…'}</div><div class="muted">${filmCount} films</div></div></div>`;
  }

  function renderChain() {
    el.chain.innerHTML = state.chain.map(step => `
      <div class="glass movie"><img src="${step.movie.poster}"><div><div class="name">${step.movie.title}</div><div class="muted">${step.movie.year} · ⭐ ${step.movie.rating.toFixed(1)}</div></div></div>
      <div class="glass actor"><img src="${NO_FACE}" style="width:52px;height:52px;border-radius:999px"><div class="name">${step.actor}</div></div>
    `).join('');
  }

  function renderSuggestions() {
    el.useTop.disabled = !state.suggestions.length;
    el.suggestions.innerHTML = state.suggestions.map(name => `
      <div class="glass suggestion" data-actor="${name}"><img src="${NO_FACE}"><div>${name}</div></div>
    `).join('');
  }

  function render() {
    el.source.innerHTML = actorCard(state.source);
    el.target.innerHTML = actorCard(state.target);
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

  function selectActor(name) {
    const prevActor = state.chain.length ? state.chain[state.chain.length - 1].actor : state.source;
    if (name === prevActor) return setStatus('Pick a different actor.', 'error');
    const movie = bestSharedMovie(prevActor, name);
    if (!movie) return setStatus('No shared film.', 'error');

    state.chain.push({ movie, actor: name });
    state.suggestions = [];
    el.input.value = '';
    render();

    if (name === state.target) {
      scoreWin();
      el.showShortest.disabled = false;
    } else {
      setStatus('Connected.');
    }
  }

  function newMatchup() {
    const list = DIFF_PAIRS[state.difficulty];
    const [a, b] = list[Math.floor(Math.random() * list.length)];
    state.source = a;
    state.target = b;
    state.chain = [];
    state.shortest = shortestPath(a, b, 6);
    state.suggestions = [];
    el.showShortest.disabled = !state.shortest;
    el.path.style.display = 'none';
    el.path.textContent = '';
    setStatus('Ready.');
    render();
  }

  function updateSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) { state.suggestions = []; renderSuggestions(); return; }
    const all = Object.keys(ACTORS);
    state.suggestions = all
      .filter(name => name.toLowerCase().includes(q))
      .filter(name => name !== state.source)
      .slice(0, 8);

    if (!state.suggestions.length) {
      // never dead-end: offer a few defaults
      state.suggestions = all.slice(0, 8);
    }
    renderSuggestions();
  }

  el.input.addEventListener('input', e => updateSearch(e.target.value));
  el.input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && state.suggestions[0]) selectActor(state.suggestions[0]);
  });
  el.useTop.addEventListener('click', () => state.suggestions[0] && selectActor(state.suggestions[0]));

  el.suggestions.addEventListener('click', e => {
    const row = e.target.closest('[data-actor]');
    if (!row) return;
    selectActor(row.getAttribute('data-actor'));
  });

  el.showShortest.addEventListener('click', () => {
    if (!state.shortest) return;
    const path = [state.source].concat(state.shortest.map(n => n.type === 'movie' ? `🎬 ${n.data.title}` : `🧑 ${n.data}`));
    el.path.style.display = 'block';
    el.path.textContent = path.join(' → ');
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
