var players = [];
var currentFilm = null;
var currentActorIndex = 0; // Start with 5th actor (1 point) revealed
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

function selectFilm(useCache, attempt) {
    if (!attempt) attempt = 1;
    var maxAttempts = 5;
    console.log('Selecting film, attempt ' + attempt + ' of ' + maxAttempts + ', useCache: ' + useCache);

    var cachedMovies = JSON.parse(localStorage.getItem('aaCachedMovies')) || [];
    console.log('Cache size:', cachedMovies.length, 'Used film IDs:', usedFilmIds);

    if (useCache && cachedMovies.length > 0) {
        var availableMovies = cachedMovies.filter(function(movie) {
            return !usedFilmIds.includes(movie.id);
        });
        console.log('Available cached movies:', availableMovies.length);
        if (availableMovies.length > 0) {
            console.log('Using cached movie');
            currentFilm = availableMovies[Math.floor(Math.random() * availableMovies.length)];
            usedFilmIds.push(currentFilm.id);
            currentActorIndex = 0; // Start with 5th actor revealed
            console.log('Selected cached film:', currentFilm);
            renderFilm();
            return;
        }
    }

    var filmInfo = document.getElementById('film-info');
    filmInfo.innerHTML = '<p>Loading film...</p>';

    var page = Math.floor(Math.random() * 10) + 1;
    var url = 'https://api.twitter.com/1.x/discover/movie?api_key=' + TMDB_API_KEY +
              '&primary_release_date.gte=1980-01-01&sort_by=popularity.desc&language=en-US&page=' + page;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + TMDB_ACCESS_TOKEN);
    // ... (rest of the function remains unchanged until currentFilm is set)
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                // ... existing code ...
                currentFilm = {
                    id: movieDetails.id,
                    title: movieDetails.title,
                    releaseYear: movieDetails.release_date ? movieDetails.release_date.split('-')[0] : 'Unknown',
                    genres: movieDetails.genres.map(function(genre) { return genre.name; }),
                    actors: topActors
                };
                usedFilmIds.push(currentFilm.id);
                currentActorIndex = 0; // Reset to show only 5th actor
                console.log('Selected film from API:', currentFilm);
                console.log('Actor order:', currentFilm.actors);

                cachedMovies.push(currentFilm);
                cachedMovies = cachedMovies.slice(-50);
                localStorage.setItem('aiCachedMovies', JSON.stringify(cachedMovies));

                renderFilm();
            } else {
                // ... error handling ...
                currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                currentFilm.id = currentFilm.title + currentFilm.releaseYear;
                usedFilmIds.push(currentFilm.id);
                currentActorIndex = 0; // Reset for fallback
                console.log('Fallback film:', currentFilm);
                renderFilm();
            }
        }
    };
    xhr.send();
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
                        setTimeout(function() { selectFilm(useCache, attempt + 1); }, 1000);
                    } else {
                        console.warn('Failed to parse API response after ' + maxAttempts + ' attempts. Using fallback dataset.');
                        currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                        currentFilm.id = currentFilm.title + currentFilm.releaseYear;
                        usedFilmIds.push(currentFilm.id);
                        currentActorIndex = 4;
                        console.log('Fallback film:', currentFilm);
                        renderFilm();
                    }
                    return;
                }

                if (!data.results || data.results.length === 0) {
                    console.warn('No results in API response');
                    if (attempt < maxAttempts) {
                        setTimeout(function() { selectFilm(useCache, attempt + 1); }, 1000);
                    } else {
                        console.warn('No results after ' + maxAttempts + ' attempts. Using fallback dataset.');
                        currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                        currentFilm.id = currentFilm.title + currentFilm.releaseYear;
                        usedFilmIds.push(currentFilm.id);
                        currentActorIndex = 4;
                        console.log('Fallback film:', currentFilm);
                        renderFilm();
                    }
                    return;
                }

                var movieIds = data.results.map(function(movie) { return movie.id; });
                console.log('Movie IDs:', movieIds);

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
                                    setTimeout(function() { selectFilm(useCache, attempt + 1); }, 1000);
                                } else {
                                    console.warn('Failed to parse details after ' + maxAttempts + ' attempts. Using fallback dataset.');
                                    currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                                    currentFilm.id = currentFilm.title + currentFilm.releaseYear;
                                    usedFilmIds.push(currentFilm.id);
                                    currentActorIndex = 4;
                                    console.log('Fallback film:', currentFilm);
                                    renderFilm();
                                }
                                return;
                            }

                            var creditsUrl = 'https://api.themoviedb.org/3/movie/' + randomMovieId +
                                             '/credits?api_key=' + TMDB_API_KEY + '&language=en-US';
                            var creditsXhr = new XMLHttpRequest();
                            creditsXhr.open('GET', creditsUrl, true);
                            creditsXhr.setRequestHeader('Authorization', 'Bearer ' + TMDB_ACCESS_TOKEN);
                            creditsXhr.onreadystatechange = function() {
                                if (creditsXhr.readyState === 4) {
                                    if (creditsXhr.status === 200) {
                                        console.log('Credits API response status: 200');
                                        var credits;
                                        try {
                                            credits = JSON.parse(creditsXhr.responseText);
                                            console.log('Credits:', credits);
                                        } catch (e) {
                                            console.error('ERROR: Failed to parse credits API response:', e);
                                            if (attempt < maxAttempts) {
                                                setTimeout(function() { selectFilm(useCache, attempt + 1); }, 1000);
                                            } else {
                                                console.warn('Failed to parse credits after ' + maxAttempts + ' attempts. Using fallback dataset.');
                                                currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                                                currentFilm.id = currentFilm.title + currentFilm.releaseYear;
                                                usedFilmIds.push(currentFilm.id);
                                                currentActorIndex = 4;
                                                console.log('Fallback film:', currentFilm);
                                                renderFilm();
                                            }
                                            return;
                                        }

                                        var topActors = credits.cast
                                            .filter(function(actor) { return actor.order < 5; })
                                            .sort(function(a, b) { return a.order - b.order; })
                                            .map(function(actor) { return actor.name; });

                                        if (topActors.length < 5) {
                                            console.warn('Movie ' + movieDetails.title + ' has fewer than 5 actors');
                                            if (attempt < maxAttempts) {
                                                setTimeout(function() { selectFilm(useCache, attempt + 1); }, 1000);
                                            } else {
                                                console.warn('No 5+ actors after ' + maxAttempts + ' attempts. Using fallback dataset.');
                                                currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                                                currentFilm.id = currentFilm.title + currentFilm.releaseYear;
                                                usedFilmIds.push(currentFilm.id);
                                                currentActorIndex = 4;
                                                console.log('Fallback film:', currentFilm);
                                                renderFilm();
                                            }
                                            return;
                                        }

                                        currentFilm = {
                                            id: movieDetails.id,
                                            title: movieDetails.title,
                                            releaseYear: movieDetails.release_date ? movieDetails.release_date.split('-')[0] : 'Unknown',
                                            genres: movieDetails.genres.map(function(genre) { return genre.name; }),
                                            actors: topActors
                                        };
                                        usedFilmIds.push(currentFilm.id);
                                        currentActorIndex = 4;
                                        console.log('Selected film from API:', currentFilm);
                                        console.log('Actor order:', currentFilm.actors);

                                        cachedMovies.push(currentFilm);
                                        cachedMovies = cachedMovies.slice(-50);
                                        localStorage.setItem('aaCachedMovies', JSON.stringify(cachedMovies));

                                        renderFilm();
                                    } else {
                                        console.error('Credits API error, status: ' + creditsXhr.status);
                                        if (attempt < maxAttempts) {
                                            setTimeout(function() { selectFilm(useCache, attempt + 1); }, 1000);
                                        } else {
                                            console.warn('Credits API failed after ' + maxAttempts + ' attempts. Using fallback dataset.');
                                            currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                                            currentFilm.id = currentFilm.title + currentFilm.releaseYear;
                                            usedFilmIds.push(currentFilm.id);
                                            currentActorIndex = 4;
                                            console.log('Fallback film:', currentFilm);
                                            renderFilm();
                                        }
                                    }
                                }
                            };
                            creditsXhr.send();
                        } else {
                            console.error('Details API error, status: ' + detailsXhr.status);
                            if (attempt < maxAttempts) {
                                setTimeout(function() { selectFilm(useCache, attempt + 1); }, 1000);
                            } else {
                                console.warn('Details API failed after ' + maxAttempts + ' attempts. Using fallback dataset.');
                                currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                                currentFilm.id = currentFilm.title + currentFilm.releaseYear;
                                usedFilmIds.push(currentFilm.id);
                                currentActorIndex = 4;
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
                    setTimeout(function() { selectFilm(useCache, attempt + 1); }, 1000);
                } else {
                    console.warn('API failed after ' + maxAttempts + ' attempts. Using fallback dataset.');
                    currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                    currentFilm.id = currentFilm.title + currentFilm.releaseYear;
                    usedFilmIds.push(currentFilm.id);
                    currentActorIndex = 4;
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
    console.log('Current actor index:', currentActorIndex);
    var filmInfo = document.getElementById('film-info');
    var actorInfo = document.getElementById('actor-info');
    if (!filmInfo || !actorInfo) {
        console.error('ERROR: Film or actor info div not found');
        return;
    }
    filmInfo.innerHTML = '<h3>' + currentFilm.genres.join(', ') + ' (' + currentFilm.releaseYear + ')</h3>';

    // Build the actor list (1 to 5), showing only revealed actors
    var actorListHTML = '<ul>';
    for (var i = 0; i < 5; i++) {
        var actorPosition = i + 1; // Display as 1st, 2nd, ..., 5th
        var actorIndex = 4 - i; // Map to array index (4 is 5th actor, 0 is 1st actor)
        var points = 5 - actorIndex; // 5th actor = 1 point, 1st actor = 5 points
        var actorText = (currentActorIndex > i) ?
            currentFilm.actors[actorIndex] + ' (' + points + ' point' + (points > 1 ? 's' : '') + ')' :
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
        var points = currentActorIndex + 1; // 1 point for 5th actor, 2 points for 5th+4th, etc.
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
                    return '<p>' + g.player + ' guessed "' + g.guess + '" (' + (g.isCorrect ? 'Correct' : 'Incorrect') + ')</p>';
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
                        return '<p>' + g.player + ' guessed "' + g.guess + '" (Incorrect)</p>';
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
        selectFilm(false);
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
