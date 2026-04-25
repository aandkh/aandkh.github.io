var players = [];
var currentFilm = null;
var scores = JSON.parse(localStorage.getItem('bobScores')) || {};

var fallbackMovies = [
    { title: "Titanic", releaseYear: "1997", worldwideGross: 2208208395, posterPath: null },
    { title: "Avengers: Endgame", releaseYear: "2019", worldwideGross: 2797800564, posterPath: null },
    { title: "Avatar", releaseYear: "2009", worldwideGross: 2847246203, posterPath: null },
    { title: "Star Wars: The Force Awakens", releaseYear: "2015", worldwideGross: 2068223624, posterPath: null },
    { title: "Jurassic World", releaseYear: "2015", worldwideGross: 1671713208, posterPath: null },
    { title: "The Lion King (2019)", releaseYear: "2019", worldwideGross: 1656943394, posterPath: null },
    { title: "The Avengers", releaseYear: "2012", worldwideGross: 1518812988, posterPath: null },
    { title: "Furious 7", releaseYear: "2015", worldwideGross: 1516045911, posterPath: null },
    { title: "Frozen II", releaseYear: "2019", worldwideGross: 1450026933, posterPath: null },
    { title: "Spider-Man: Far From Home", releaseYear: "2019", worldwideGross: 1131927996, posterPath: null }
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

function formatFinancialValue(value) {
    if (value >= 1000000000) {
        return '$' + (value / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    return '$' + (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

function updateSliderFill(input) {
    var min = Number(input.min) || 0;
    var max = Number(input.max) || 100;
    var value = Number(input.value);
    var percent = ((value - min) * 100) / (max - min);
    input.style.setProperty('--fill-percent', percent + '%');
}

function getGuessFromControls(wrapper) {
    var billions = Number(wrapper.querySelector('.billions-slider').value);
    var millions = Number(wrapper.querySelector('.millions-slider').value);
    var thousands = Number(wrapper.querySelector('.thousands-slider').value);

    return (billions * 1000000000) +
           (millions * 1000000) +
           (thousands * 1000);
}

function updateFinancialDisplay(wrapper) {
    var maxGuess = 3999999000;
    var currentTotal = getGuessFromControls(wrapper);
    var display = wrapper.querySelector('.money-readout');
    var previousTotal = Number(display.dataset.lastValue || 0);
    var intensity = Math.min(currentTotal / maxGuess, 1);

    display.textContent = formatFinancialValue(currentTotal);
    display.style.setProperty('--guess-intensity', intensity.toFixed(4));

    if (currentTotal > previousTotal) {
        display.classList.remove('decrease');
        display.classList.add('increase');
    } else if (currentTotal < previousTotal) {
        display.classList.remove('increase');
        display.classList.add('decrease');
    }

    display.dataset.lastValue = currentTotal;
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
        div.className = 'guess-card';
        div.dataset.player = player;
        div.innerHTML = [
            '<h4 class="player-title">' + player + '</h4>',
            '<div class="money-readout" data-last-value="0">$0M</div>',
            '<div class="slider-group">',
            '  <label>Billions <span class="slider-value billions-value">0</span></label>',
            '  <input type="range" class="finance-slider billions-slider" min="0" max="3" step="1" value="0">',
            '</div>',
            '<div class="slider-group">',
            '  <label>Millions <span class="slider-value millions-value">0</span></label>',
            '  <input type="range" class="finance-slider millions-slider" min="0" max="999" step="1" value="0">',
            '</div>',
            '<div class="slider-group">',
            '  <label>Thousands <span class="slider-value thousands-value">0</span></label>',
            '  <input type="range" class="finance-slider thousands-slider" min="0" max="999" step="1" value="0">',
            '</div>'
        ].join('');

        inputsDiv.appendChild(div);

        var sliders = div.querySelectorAll('.finance-slider');
        for (var j = 0; j < sliders.length; j++) {
            updateSliderFill(sliders[j]);
            sliders[j].addEventListener('input', function() {
                var card = this.closest('.guess-card');
                card.querySelector('.billions-value').textContent = card.querySelector('.billions-slider').value;
                card.querySelector('.millions-value').textContent = card.querySelector('.millions-slider').value;
                card.querySelector('.thousands-value').textContent = card.querySelector('.thousands-slider').value;
                updateSliderFill(this);
                updateFinancialDisplay(card);
            });
        }

        updateFinancialDisplay(div);
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

    var page = Math.floor(Math.random() * 10) + 1;
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
                        renderFilm();
                    }
                    return;
                }

                var movieIds = data.results.map(function(movie) { return movie.id; });
                var randomMovieId = movieIds[Math.floor(Math.random() * movieIds.length)];
                var detailsUrl = 'https://api.themoviedb.org/3/movie/' + randomMovieId +
                                 '?api_key=' + TMDB_API_KEY + '&language=en-US';
                var detailsXhr = new XMLHttpRequest();
                detailsXhr.open('GET', detailsUrl, true);
                detailsXhr.setRequestHeader('Authorization', 'Bearer ' + TMDB_ACCESS_TOKEN);
                detailsXhr.onreadystatechange = function() {
                    if (detailsXhr.readyState === 4) {
                        if (detailsXhr.status === 200) {
                            var movieDetails;
                            try {
                                movieDetails = JSON.parse(detailsXhr.responseText);
                            } catch (e) {
                                console.error('ERROR: Failed to parse details API response:', e);
                                if (attempt < maxAttempts) {
                                    selectFilm(useCache, attempt + 1);
                                } else {
                                    currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                                    renderFilm();
                                }
                                return;
                            }

                            if (!movieDetails.revenue || movieDetails.revenue <= 0) {
                                console.warn('Movie ' + movieDetails.title + ' has no revenue');
                                if (attempt < maxAttempts) {
                                    selectFilm(useCache, attempt + 1);
                                } else {
                                    currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                                    renderFilm();
                                }
                                return;
                            }

                            currentFilm = {
                                title: movieDetails.title,
                                releaseYear: movieDetails.release_date ? movieDetails.release_date.split('-')[0] : 'Unknown',
                                worldwideGross: movieDetails.revenue,
                                posterPath: movieDetails.poster_path || null
                            };

                            cachedMovies.push(currentFilm);
                            cachedMovies = cachedMovies.slice(-50);
                            localStorage.setItem('cachedMovies', JSON.stringify(cachedMovies));

                            renderFilm();
                        } else {
                            console.error('Details API error, status: ' + detailsXhr.status);
                            if (attempt < maxAttempts) {
                                selectFilm(useCache, attempt + 1);
                            } else {
                                currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
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
                    currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
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

    var posterHtml;
    if (currentFilm.posterPath) {
        posterHtml = '<img class="movie-poster" src="https://image.tmdb.org/t/p/w500' + currentFilm.posterPath + '" alt="' + currentFilm.title + ' poster">';
    } else {
        posterHtml = '<div class="movie-poster poster-fallback">No Poster Available</div>';
    }

    filmInfo.innerHTML = [
        '<div class="film-panel">',
        posterHtml,
        '<div class="film-meta">',
        '<h3>' + currentFilm.title + ' (' + currentFilm.releaseYear + ')</h3>',
        '<p>Set your worldwide box office estimate with the market sliders.</p>',
        '</div>',
        '</div>'
    ].join('');

    document.getElementById('result').innerHTML = '';

    var guessCards = document.querySelectorAll('.guess-card');
    for (var i = 0; i < guessCards.length; i++) {
        var sliders = guessCards[i].querySelectorAll('.finance-slider');
        for (var j = 0; j < sliders.length; j++) {
            sliders[j].value = 0;
            updateSliderFill(sliders[j]);
        }
        guessCards[i].querySelector('.billions-value').textContent = '0';
        guessCards[i].querySelector('.millions-value').textContent = '0';
        guessCards[i].querySelector('.thousands-value').textContent = '0';
        guessCards[i].querySelector('.money-readout').dataset.lastValue = '0';
        updateFinancialDisplay(guessCards[i]);
    }
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
        var guessCards = document.querySelectorAll('.guess-card');

        for (var i = 0; i < guessCards.length; i++) {
            var card = guessCards[i];
            var player = card.dataset.player;
            var value = getGuessFromControls(card);
            guesses.push({
                player: player,
                guess: value,
                diff: Math.abs(currentFilm.worldwideGross - value)
            });
        }

        var minDiff = Math.min.apply(null, guesses.map(function(g) { return g.diff; }));
        var winners = guesses.filter(function(g) { return g.diff === minDiff; });

        for (var j = 0; j < winners.length; j++) {
            scores[winners[j].player] = (scores[winners[j].player] || 0) + 1;
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
        selectFilm(false);
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
