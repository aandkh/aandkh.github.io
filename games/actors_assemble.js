var players = [];
var currentFilm = null;
var currentActorIndex = 0; // Start with 5th actor revealed
var scores = JSON.parse(localStorage.getItem('aaScores')) || {};
var usedFilmIds = [];

var fallbackMovies = [
    {
        title: "The Avengers",
        releaseYear: "2012",
        genres: ["Action", "Science Fiction"],
        actors: [
            "Robert Downey Jr.", // 1st
            "Chris Evans",       // 2nd
            "Mark Ruffalo",      // 3rd
            "Chris Hemsworth",   // 4th
            "Scarlett Johansson" // 5th
        ]
    },
    {
        title: "Titanic",
        releaseYear: "1997",
        genres: ["Drama", "Romance"],
        actors: [
            "Leonardo DiCaprio",
            "Kate Winslet",
            "Billy Zane",
            "Kathy Bates",
            "Frances Fisher"
        ]
    },
    {
        title: "Jurassic Park",
        releaseYear: "1993",
        genres: ["Adventure", "Science Fiction"],
        actors: [
            "Sam Neill",
            "Laura Dern",
            "Jeff Goldblum",
            "Richard Attenborough",
            "Bob Peck"
        ]
    },
    {
        title: "Star Wars: The Force Awakens",
        releaseYear: "2015",
        genres: ["Action", "Science Fiction"],
        actors: [
            "Harrison Ford",
            "Mark Hamill",
            "Carrie Fisher",
            "Adam Driver",
            "Daisy Ridley"
        ]
    },
    {
        title: "The Dark Knight",
        releaseYear: "2008",
        genres: ["Action", "Crime"],
        actors: [
            "Christian Bale",
            "Heath Ledger",
            "Aaron Eckhart",
            "Michael Caine",
            "Maggie Gyllenhaal"
        ]
    }
];

function setupEventListeners() {
    console.log('Setting up event listeners');
    var addPlayerButton = document.getElementById('add-player');
    if (!addPlayerButton) {
        console.error('ERROR: Add Player button not found');
        return;
    }
    addPlayerButton.addEventListener('click', function() {
        console.log('Add Player button clicked');
        var playerList = document.getElementById('player-list');
        if (!playerList) {
            console.error('ERROR: Player list not found');
            return;
        }
        var entry = document.createElement('div');
        entry.className = 'player-entry';
        entry.innerHTML = '<input type="text" class="player-name" placeholder="Player Name"><button class="remove-player">Remove</button>';
        playerList.appendChild(entry);
        updateRemoveButtons();
    });

    var startGameButton = document.getElementById('start-game');
    if (!startGameButton) {
        console.error('ERROR: Start Game button not found');
        return;
    }
    startGameButton.addEventListener('click', function() {
        console.log('Start Game button clicked');
        var playerNames = document.querySelectorAll('.player-name');
        players = [];
        for (var i = 0; i < playerNames.length; i++) {
            var name = playerNames[i].value.trim();
            if (name !== '') {
                players.push(name);
            }
        }
        if (players.length < 1) {
            alert('Please add at least one player.');
            return;
        }
        document.getElementById('player-setup').style.display = 'none';
        document.getElementById('game-area').style.display = 'block';
        initializeGame();
    });
}

function updateRemoveButtons() {
    console.log('Updating remove buttons');
    var removeButtons = document.querySelectorAll('.remove-player');
    for (var i = 0; i < removeButtons.length; i++) {
        removeButtons[i].onclick = function() {
            console.log('Remove Player button clicked');
            this.parentElement.remove();
        };
    }
}

function initializeGame() {
    console.log('Initializing game');
    usedFilmIds = [];
    selectFilm(true);
    updateScoreboard();
    renderGuessInputs();
}

function updateScoreboard() {
    console.log('Updating scoreboard');
    var scoresList = document.getElementById('scores');
    if (!scoresList) {
        console.error('ERROR: Scores list not found');
        return;
    }
    scoresList.innerHTML = '';
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        var li = document.createElement('li');
        li.textContent = player + ': ' + (scores[player] || 0) + ' points';
        scoresList.appendChild(li);
    }
}

function renderGuessInputs() {
    console.log('Rendering guess inputs');
    var inputsDiv = document.getElementById('player-inputs');
    if (!inputsDiv) {
        console.error('ERROR: Player inputs div not found');
        return;
    }
    inputsDiv.innerHTML = '';
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        var div = document.createElement('div');
        div.innerHTML = '<label>' + player + ': <input type="text" class="guess-input" data-player="' + player + '" placeholder="Movie Title"></label>';
        inputsDiv.appendChild(div);
    }
}

function selectFilm(useCache, attempt = 1) {
    const maxAttempts = 3; // Reduced to avoid long delays
    console.log(`Selecting film, attempt ${attempt} of ${maxAttempts}, useCache: ${useCache}`);

    const filmInfo = document.getElementById('film-info');
    if (!filmInfo) {
        console.error('ERROR: film-info element not found');
        return;
    }
    filmInfo.innerHTML = '<p>Loading film...</p>';

    // Check cache first if useCache is true
    if (useCache) {
        let cachedMovies = JSON.parse(localStorage.getItem('aaCachedMovies')) || [];
        console.log('Cache size:', cachedMovies.length, 'Used film IDs:', usedFilmIds);
        let availableMovies = cachedMovies.filter(movie => !usedFilmIds.includes(movie.id));
        console.log('Available cached movies:', availableMovies.length);
        if (availableMovies.length > 0) {
            currentFilm = availableMovies[Math.floor(Math.random() * availableMovies.length)];
            usedFilmIds.push(currentFilm.id);
            currentActorIndex = 0; // Start with 5th actor (index 4)
            console.log('Selected cached film:', currentFilm);
            renderFilm();
            return;
        }
    }

    // Helper function to handle API requests with retry logic
    function fetchWithRetry(url, retries = maxAttempts, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, false); // Synchronous for simplicity
                xhr.setRequestHeader('Authorization', 'Bearer ' + TMDB_ACCESS_TOKEN);
                xhr.send();
                if (xhr.status === 200) {
                    return JSON.parse(xhr.responseText);
                } else if (xhr.status === 429) {
                    const retryAfter = parseInt(xhr.getResponseHeader('Retry-After')) || delay / 1000;
                    console.warn(`Rate limit hit (429). Retrying after ${retryAfter}s`);
                    setTimeout(() => {}, retryAfter * 1000); // Synchronous wait
                    delay *= 2; // Exponential backoff
                    continue;
                } else {
                    throw new Error(`API error, status: ${xhr.status}`);
                }
            } catch (error) {
                console.error(`Request failed: ${url}`, error);
                if (i === retries - 1) throw error;
                setTimeout(() => {}, delay); // Synchronous wait
                delay *= 2;
            }
        }
    }

    // Fetch movie from TMDb API
    try {
        const page = Math.floor(Math.random() * 10) + 1;
        const discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&primary_release_date.gte=1980-01-01&sort_by=popularity.desc&language=en-US&page=${page}`;
        const discoverData = fetchWithRetry(discoverUrl);

        if (!discoverData.results || discoverData.results.length === 0) {
            throw new Error('No movies found in discover API response');
        }

        const movieIds = discoverData.results.map(movie => movie.id);
        console.log('Movie IDs:', movieIds);
        const randomMovieId = movieIds[Math.floor(Math.random() * movieIds.length)];

        const detailsUrl = `https://api.themoviedb.org/3/movie/${randomMovieId}?api_key=${TMDB_API_KEY}&language=en-US`;
        const movieDetails = fetchWithRetry(detailsUrl);
        console.log('Movie details:', movieDetails);

        const creditsUrl = `https://api.themoviedb.org/3/movie/${randomMovieId}/credits?api_key=${TMDB_API_KEY}&language=en-US`;
        const credits = fetchWithRetry(creditsUrl);
        console.log('Credits:', credits);

        const topActors = credits.cast
            .filter(actor => actor.order < 5)
            .sort((a, b) => a.order - b.order)
            .map(actor => actor.name);

        if (topActors.length < 5) {
            console.warn(`Movie ${movieDetails.title} has fewer than 5 actors (${topActors.length})`);
            if (attempt < maxAttempts) {
                setTimeout(() => selectFilm(useCache, attempt + 1), 1000);
                return;
            } else {
                throw new Error('No movie with 5+ actors found');
            }
        }

        currentFilm = {
            id: movieDetails.id,
            title: movieDetails.title, // Fixed typo (was DiedmovieDetails)
            releaseYear: movieDetails.release_date ? movieDetails.release_date.split('-')[0] : 'Unknown',
            genres: movieDetails.genres.map(genre => genre.name),
            actors: topActors
        };
        usedFilmIds.push(currentFilm.id);
        currentActorIndex = 0;
        console.log('Selected film from API:', currentFilm);

        // Update cache
        let cachedMovies = JSON.parse(localStorage.getItem('aaCachedMovies')) || [];
        cachedMovies.push(currentFilm);
        cachedMovies = cachedMovies.slice(-50); // Keep last 50 movies
        localStorage.setItem('aaCachedMovies', JSON.stringify(cachedMovies));

        renderFilm();
    } catch (error) {
        console.error('API fetch failed:', error);
        if (attempt < maxAttempts) {
            console.log(`Retrying... attempt ${attempt + 1}`);
            setTimeout(() => selectFilm(useCache, attempt + 1), 1000);
        } else {
            console.warn(`API failed after ${maxAttempts} attempts. Using fallback dataset.`);
            currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
            currentFilm.id = currentFilm.title + currentFilm.releaseYear;
            usedFilmIds.push(currentFilm.id);
            currentActorIndex = 0;
            console.log('Fallback film:', currentFilm);
            renderFilm();
        }
    }
}

function renderFilm() {
    console.log('Rendering film:', currentFilm);
    console.log('Current actor index:', currentActorIndex);
    var filmInfo = document.getElementById('film-info');
    var actorInfo = document.getElementById('actor-info');
    if (!filmInfo || !actorInfo) {
        console.error('ERROR: Film or actor info div not found');
        return;
    }
    filmInfo.innerHTML = '<h3>' + currentFilm.genres.join(', ') + ' (' + currentFilm.releaseYear + ')</h3>';

    // Build the actor list (1 to 5, top to bottom)
    var actorListHTML = '<ul>';
    for (var i = 0; i < 5; i++) {
        var actorPosition = i + 1; // Display as 1:, 2:, ..., 5:
        var points = 5 - i; // Points: 5 for 1st actor, 1 for 5th
        var actorText = (currentActorIndex >= 4 - i) ?
            currentFilm.actors[i] + ' (' + points + ' point' + (points > 1 ? 's' : '') + ')' :
            '';
        actorListHTML += '<li>' + actorPosition + ': ' + actorText + '</li>';
    }
    actorListHTML += '</ul>';

    actorInfo.innerHTML = currentActorIndex < 5 ?
        actorListHTML :
        '<p>All actors revealed.</p>';

    document.getElementById('result').innerHTML = '';
    var guessInputs = document.querySelectorAll('.guess-input');
    for (var i = 0; i < guessInputs.length; i++) {
        guessInputs[i].value = '';
    }
    document.getElementById('reveal-next-actor').style.display = currentActorIndex < 4 ? 'inline-block' : 'none';
}

function parseGuess(guess, correctTitle) {
    if (!guess || typeof guess !== 'string') {
        console.warn('Invalid guess input:', guess);
        return false;
    }
    guess = guess.trim().toLowerCase();
    correctTitle = correctTitle.toLowerCase();
    // Allow partial matches, e.g., "avengers" for "The Avengers"
    var containsTitle = correctTitle.includes(guess) || guess.includes(correctTitle);
    console.log('Guess:', guess, 'Correct:', correctTitle, 'Match:', containsTitle);
    return containsTitle;
}

function setupSubmitGuesses() {
    console.log('Setting up submit guesses');
    var submitButton = document.getElementById('submit-guesses');
    if (!submitButton) {
        console.error('ERROR: Submit Guesses button not found');
        return;
    }
    submitButton.addEventListener('click', function() {
        console.log('Submit Guesses button clicked');
        var guesses = [];
        var allGuessed = true;
        var guessInputs = document.querySelectorAll('.guess-input');
        for (var i = 0; i < guessInputs.length; i++) {
            var input = guessInputs[i];
            var player = input.dataset.player;
            var guess = input.value.trim();
            if (!guess) allGuessed = false;
            var isCorrect = parseGuess(guess, currentFilm.title);
            guesses.push({ player: player, guess: guess, isCorrect: isCorrect });
        }
        if (!allGuessed) {
            document.getElementById('result').innerHTML = '<p>Please enter guesses for all players.</p>';
            return;
        }
        var winners = guesses.filter(function(g) { return g.isCorrect; });
        var points = 5 - currentActorIndex; // 5 points for 1 actor, 1 point for 5 actors
        console.log('Points awarded:', points, 'for movie:', currentFilm.title);
        if (winners.length > 0) {
            for (var i = 0; i < winners.length; i++) {
                scores[winners[i].player] = (scores[winners[i].player] || 0) + points;
            }
            localStorage.setItem('aaScores', JSON.stringify(scores));
            updateScoreboard();
            document.getElementById('result').innerHTML = [
                '<p><strong>Correct!</strong> The movie is ' + currentFilm.title + '.</p>',
                guesses.map(function(g) {
                    return '<p>' + g.player + ' guessed "' + g.guess + '" (<span class="' + (g.isCorrect ? 'correct' : 'incorrect') + '">' + (g.isCorrect ? 'Correct' : 'Incorrect') + '</span>)</p>';
                }).join(''),
                '<p><strong>Winner' + (winners.length > 1 ? 's' : '') + ':</strong> ' +
                winners.map(function(w) { return w.player; }).join(', ') + ' (+' + points + ' point' + (points > 1 ? 's' : '') + ')</p>'
            ].join('');
            document.getElementById('submit-guesses').style.display = 'none';
            document.getElementById('reveal-next-actor').style.display = 'none';
        } else {
            if (currentActorIndex === 4) {
                // No correct guesses after all actors revealed
                document.getElementById('result').innerHTML = [
                    '<p><strong>No correct guesses.</strong> The movie was ' + currentFilm.title + '.</p>',
                    guesses.map(function(g) {
                        return '<p>' + g.player + ' guessed "' + g.guess + '" (<span class="incorrect">Incorrect</span>)</p>';
                    }).join('')
                ].join('');
                document.getElementById('submit-guesses').style.display = 'none';
                document.getElementById('reveal-next-actor').style.display = 'none';
            } else {
                document.getElementById('result').innerHTML = [
                    '<p><strong>Incorrect.</strong> Try again or reveal the next actor.</p>',
                    guesses.map(function(g) {
                        return '<p>' + g.player + ' guessed "' + g.guess + '"</p>';
                    }).join('')
                ].join('');
            }
        }
    });
}

function setupRevealNextActor() {
    console.log('Setting up reveal next actor');
    var revealButton = document.getElementById('reveal-next-actor');
    if (!revealButton) {
        console.error('ERROR: Reveal Next Actor button not found');
        return;
    }
    revealButton.addEventListener('click', function() {
        console.log('Reveal Next Actor button clicked');
        if (currentActorIndex < 4) {
            currentActorIndex++;
            console.log('Revealing actors up to index:', currentActorIndex);
            renderFilm();
            document.getElementById('result').innerHTML = '';
        }
    });
}

function setupNextMovie() {
    console.log('Setting up next movie');
    var nextMovieButton = document.getElementById('next-movie');
    if (!nextMovieButton) {
        console.error('ERROR: Next Movie button not found');
        return;
    }
    nextMovieButton.addEventListener('click', function() {
        console.log('Next Movie button clicked');
        selectFilm(true);
        document.getElementById('submit-guesses').style.display = 'inline-block';
    });
}

function setupResetGame() {
    console.log('Setting up reset game');
    var resetButton = document.getElementById('reset-game');
    if (!resetButton) {
        console.error('ERROR: Reset Game button not found');
        return;
    }
    resetButton.addEventListener('click', function() {
        console.log('Reset Game button clicked');
        players = [];
        scores = {};
        usedFilmIds = [];
        localStorage.removeItem('aaScores');
        localStorage.removeItem('aaCachedMovies');
        document.getElementById('player-setup').style.display = 'block';
        document.getElementById('game-area').style.display = 'none';
        var playerList = document.getElementById('player-list');
        playerList.innerHTML = '<div class="player-entry"><input type="text" class="player-name" placeholder="Player Name"><button class="remove-player">Remove</button></div>';
        updateRemoveButtons();
    });
}

try {
    console.log('Initializing script');
    setupEventListeners();
    setupSubmitGuesses();
    setupRevealNextActor();
    setupNextMovie();
    setupResetGame();
    updateRemoveButtons();
} catch (error) {
    console.error('ERROR: Failed to initialize script:', error);
}
console.log('Script loaded successfully');
