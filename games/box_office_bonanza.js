var players = [];
var currentFilm = null;
var scores = JSON.parse(localStorage.getItem('bobScores')) || {};

var fallbackMovies = [
    { title: "Titanic", releaseYear: "1997", worldwideGross: 2208208395 },
    { title: "Avengers: Endgame", releaseYear: "2019", worldwideGross: 2797800564 },
    { title: "Avatar", releaseYear: "2009", worldwideGross: 2847246203 },
    { title: "Star Wars: The Force Awakens", releaseYear: "2015", worldwideGross: 2068223624 },
    { title: "Jurassic World", releaseYear: "2015", worldwideGross: 1671713208 },
    { title: "The Lion King (2019)", releaseYear: "2019", worldwideGross: 1656943394 },
    { title: "The Avengers", releaseYear: "2012", worldwideGross: 1518812988 },
    { title: "Furious 7", releaseYear: "2015", worldwideGross: 1516045911 },
    { title: "Frozen II", releaseYear: "2019", worldwideGross: 1450026933 },
    { title: "Spider-Man: Far From Home", releaseYear: "2019", worldwideGross: 1131927996 }
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
    selectFilm(true); // Use cache for initial load
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
        div.innerHTML = '<label>' + player + ': <input type="text" class="guess-input" data-player="' + player + '" placeholder="Guess (e.g., 20m or 1.5b)"></label>';
        inputsDiv.appendChild(div);
    }
}

function selectFilm(useCache, attempt) {
    if (!attempt) attempt = 1;
    var maxAttempts = 5;
    console.log('Selecting film, attempt ' + attempt + ' of ' + maxAttempts + ', useCache: ' + useCache);

    var cachedMovies = JSON.parse(localStorage.getItem('cachedMovies')) || [];
    if (useCache && cachedMovies.length > 0) {
        console.log('Using cached movie');
        currentFilm = cachedMovies[Math.floor(Math.random() * cachedMovies.length)];
        renderFilm();
        return;
    }

    var filmInfo = document.getElementById('film-info');
    filmInfo.innerHTML = '<p>Loading film...</p>';

    var page = Math.floor(Math.random() * 10) + 1; // Random page 1-10
    var url = 'https://api.themoviedb.org/3/discover/movie?api_key=' + TMDB_API_KEY +
              '&primary_release_date.gte=1980-01-01&sort_by=popularity.desc&language=en-US&page=' + page;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + TMDB_ACCESS_TOKEN);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                console.log('API response status: 200');
                var data;
                try {
                    data = JSON.parse(xhr.responseText);
                    console.log('API response data:', data);
                } catch (e) {
                    console.error('ERROR: Failed to parse API response:', e);
                    if (attempt < maxAttempts) {
                        selectFilm(useCache, attempt + 1);
                    } else {
                        console.warn('Failed to parse API response after ' + maxAttempts + ' attempts. Using fallback dataset.');
                        currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                        console.log('Fallback film:', currentFilm);
                        renderFilm();
                    }
                    return;
                }

                if (!data.results || data.results.length === 0) {
                    console.warn('No results in API response');
                    if (attempt < maxAttempts) {
                        selectFilm(useCache, attempt + 1);
                    } else {
                        console.warn('No results after ' + maxAttempts + ' attempts. Using fallback dataset.');
                        currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                        console.log('Fallback film:', currentFilm);
                        renderFilm();
                    }
                    return;
                }

                var movieIds = data.results.map(function(movie) { return movie.id; });
                console.log('Movie IDs:', movieIds);

                // Fetch details for a random movie
                var randomMovieId = movieIds[Math.floor(Math.random() * movieIds.length)];
                var detailsUrl = 'https://api.themoviedb.org/3/movie/' + randomMovieId +
                                 '?api_key=' + TMDB_API_KEY + '&language=en-US';
                var detailsXhr = new XMLHttpRequest();
                detailsXhr.open('GET', detailsUrl, true);
                detailsXhr.setRequestHeader('Authorization', 'Bearer ' + TMDB_ACCESS_TOKEN);
                detailsXhr.onreadystatechange = function() {
                    if (detailsXhr.readyState === 4) {
                        if (detailsXhr.status === 200) {
                            console.log('Details API response status: 200');
                            var movieDetails;
                            try {
                                movieDetails = JSON.parse(detailsXhr.responseText);
                                console.log('Movie details:', movieDetails);
                            } catch (e) {
                                console.error('ERROR: Failed to parse details API response:', e);
                                if (attempt < maxAttempts) {
                                    selectFilm(useCache, attempt + 1);
                                } else {
                                    console.warn('Failed to parse details after ' + maxAttempts + ' attempts. Using fallback dataset.');
                                    currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                                    console.log('Fallback film:', currentFilm);
                                    renderFilm();
                                }
                                return;
                            }

                            if (!movieDetails.revenue || movieDetails.revenue <= 0) {
                                console.warn('Movie ' + movieDetails.title + ' has no revenue');
                                if (attempt < maxAttempts) {
                                    selectFilm(useCache, attempt + 1);
                                } else {
                                    console.warn('No revenue after ' + maxAttempts + ' attempts. Using fallback dataset.');
                                    currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                                    console.log('Fallback film:', currentFilm);
                                    renderFilm();
                                }
                                return;
                            }

                            currentFilm = {
                                title: movieDetails.title,
                                releaseYear: movieDetails.release_date ? movieDetails.release_date.split('-')[0] : 'Unknown',
                                worldwideGross: movieDetails.revenue
                            };
                            console.log('Selected film from API:', currentFilm);

                            cachedMovies.push(currentFilm);
                            cachedMovies = cachedMovies.slice(-50);
                            localStorage.setItem('cachedMovies', JSON.stringify(cachedMovies));

                            renderFilm();
                        } else {
                            console.error('Details API error, status: ' + detailsXhr.status);
                            if (attempt < maxAttempts) {
                                selectFilm(useCache, attempt + 1);
                            } else {
                                console.warn('Details API failed after ' + maxAttempts + ' attempts. Using fallback dataset.');
                                currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                                console.log('Fallback film:', currentFilm);
                                renderFilm();
                            }
                        }
                    }
                };
                detailsXhr.send();
            } else {
                console.error('API error, status: ' + xhr.status);
                if (attempt < maxAttempts) {
                    selectFilm(useCache, attempt + 1);
                } else {
                    console.warn('API failed after ' + maxAttempts + ' attempts. Using fallback dataset.');
                    currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                    console.log('Fallback film:', currentFilm);
                    renderFilm();
                }
            }
        }
    };
    xhr.send();
}

function renderFilm() {
    console.log('Rendering film:', currentFilm);
    var filmInfo = document.getElementById('film-info');
    if (!filmInfo) {
        console.error('ERROR: Film info div not found');
        return;
    }
    filmInfo.innerHTML = '<h3>' + currentFilm.title + ' (' + currentFilm.releaseYear + ')</h3><p>Guess the worldwide box office gross!</p>';
    document.getElementById('result').innerHTML = '';
    var guessInputs = document.querySelectorAll('.guess-input');
    for (var i = 0; i < guessInputs.length; i++) {
        guessInputs[i].value = '';
    }
}

function parseGuess(input) {
    if (!input || typeof input !== 'string') {
        console.warn('Invalid guess input:', input);
        return { value: 0, error: 'Please enter a number (e.g., 20m for 20 million, 1.5b for 1.5 billion)' };
    }
    input = input.trim().toLowerCase();
    var match = input.match(/^(\d*\.?\d*)([mb])?$/i);
    if (!match) {
        console.warn('Invalid guess format:', input);
        return { value: 0, error: 'Invalid format: use numbers like 20m or 1.5b' };
    }
    var number = parseFloat(match[1]);
    if (isNaN(number)) {
        console.warn('Invalid number in guess:', input);
        return { value: 0, error: 'Invalid number: use numbers like 20m or 1.5b' };
    }
    var suffix = match[2] || '';
    var value;
    if (suffix === 'm') {
        value = number * 1000000;
    } else if (suffix === 'b') {
        value = number * 1000000000;
    } else {
        value = number;
    }
    console.log('Parsed guess:', input, '->', value);
    return { value: value, error: null };
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
        var allValid = true;
        var errorMessages = [];
        var guessInputs = document.querySelectorAll('.guess-input');
        for (var i = 0; i < guessInputs.length; i++) {
            var input = guessInputs[i];
            var player = input.dataset.player;
            var result = parseGuess(input.value);
            if (result.value === 0) {
                allValid = false;
                errorMessages.push(player + ': ' + result.error);
            }
            guesses.push({ player: player, guess: result.value, diff: Math.abs(currentFilm.worldwideGross - result.value) });
        }
        if (!allValid) {
            document.getElementById('result').innerHTML = '<p>' + errorMessages.join('<br>') + '</p>';
            return;
        }
        var minDiff = Math.min.apply(null, guesses.map(function(g) { return g.diff; }));
        var winners = guesses.filter(function(g) { return g.diff === minDiff; });
        for (var i = 0; i < winners.length; i++) {
            scores[winners[i].player] = (scores[winners[i].player] || 0) + 1;
        }
        localStorage.setItem('bobScores', JSON.stringify(scores));
        updateScoreboard();
        document.getElementById('result').innerHTML = [
            '<p><strong>Result:</strong> ' + currentFilm.title + ' made $' + currentFilm.worldwideGross.toLocaleString() + ' worldwide.</p>',
            guesses.map(function(g) {
                return '<p>' + g.player + ' guessed $' + g.guess.toLocaleString() + ' (off by $' + g.diff.toLocaleString() + ')</p>';
            }).join(''),
            '<p><strong>Winner' + (winners.length > 1 ? 's' : '') + ':</strong> ' + winners.map(function(w) { return w.player; }).join(', ') + '</p>'
        ].join('');
    });
}

function setupNextFilm() {
    console.log('Setting up next film');
    var nextFilmButton = document.getElementById('next-film');
    if (!nextFilmButton) {
        console.error('ERROR: Next Film button not found');
        return;
    }
    nextFilmButton.addEventListener('click', function() {
        console.log('Next Film button clicked');
        selectFilm(false); // Force API call for Next Film
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
        localStorage.removeItem('bobScores');
        localStorage.removeItem('cachedMovies');
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
    setupNextFilm();
    setupResetGame();
    updateRemoveButtons();
} catch (error) {
    console.error('ERROR: Failed to initialize script:', error);
}
console.log('Script loaded successfully');
