var currentMovie = null;
var hints = [];
var revealedHints = 1;
var guessesLeft = 3;
var score = parseInt(localStorage.getItem('mrScore') || '0', 10);
var isRoundLoading = false;

var fallbackMovies = [
    {
        title: 'The Shawshank Redemption',
        genre: 'Drama',
        year: '1994',
        actor: 'Tim Robbins',
        tagline: 'Fear can hold you prisoner. Hope can set you free.'
    },
    {
        title: 'The Dark Knight',
        genre: 'Action',
        year: '2008',
        actor: 'Christian Bale',
        tagline: 'Why So Serious?'
    },
    {
        title: 'Inception',
        genre: 'Science Fiction',
        year: '2010',
        actor: 'Leonardo DiCaprio',
        tagline: 'Your mind is the scene of the crime.'
    }
];

function initializeGame() {
    document.getElementById('score').textContent = score;

    document.getElementById('submit-guess').addEventListener('click', handleGuess);
    document.getElementById('new-round').addEventListener('click', startRound);
    document.getElementById('guess-input').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            handleGuess();
        }
    });

    startRound();
}

async function startRound() {
    isRoundLoading = true;
    document.getElementById('result').textContent = '';
    document.getElementById('result').className = '';
    document.getElementById('guess-input').value = '';
    document.getElementById('guess-input').disabled = true;
    document.getElementById('submit-guess').disabled = true;
    document.getElementById('new-round').style.display = 'none';
    document.getElementById('result').textContent = 'Loading movie...';

    guessesLeft = 3;
    revealedHints = 1;
    updateAttemptsText();

    try {
        currentMovie = await fetchRandomPopularMovie();
    } catch (error) {
        console.warn('TMDB fetch failed, using fallback movie.', error);
        currentMovie = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
    } finally {
        isRoundLoading = false;
    }

    hints = [
        'Genre: ' + currentMovie.genre,
        'Release Year: ' + currentMovie.year,
        'Actor: ' + currentMovie.actor + (currentMovie.tagline ? ' | Tagline: "' + currentMovie.tagline + '"' : '')
    ];

    renderHints();
    document.getElementById('result').textContent = 'Round ready. Start guessing!';
    document.getElementById('guess-input').disabled = false;
    document.getElementById('submit-guess').disabled = false;
    document.getElementById('guess-input').focus();
}

async function fetchRandomPopularMovie() {
    var randomPage = Math.floor(Math.random() * 10) + 1;
    var popularUrl = 'https://api.themoviedb.org/3/movie/popular?api_key=' + TMDB_API_KEY + '&language=en-US&page=' + randomPage;
    var popularResponse = await fetchWithAuth(popularUrl);

    if (!popularResponse.ok) {
        throw new Error('Failed to fetch popular movies');
    }

    var popularData = await popularResponse.json();
    var movies = popularData.results || [];
    if (movies.length === 0) {
        throw new Error('No popular movies returned');
    }

    var randomMovie = movies[Math.floor(Math.random() * movies.length)];
    var detailUrl = 'https://api.themoviedb.org/3/movie/' + randomMovie.id + '?api_key=' + TMDB_API_KEY + '&language=en-US';
    var creditsUrl = 'https://api.themoviedb.org/3/movie/' + randomMovie.id + '/credits?api_key=' + TMDB_API_KEY + '&language=en-US';

    var detailResponse = await fetchWithAuth(detailUrl);
    var creditsResponse = await fetchWithAuth(creditsUrl);

    if (!detailResponse.ok || !creditsResponse.ok) {
        throw new Error('Failed to fetch movie metadata');
    }

    var detailData = await detailResponse.json();
    var creditsData = await creditsResponse.json();

    return {
        title: detailData.title || randomMovie.title,
        genre: detailData.genres && detailData.genres.length ? detailData.genres[0].name : 'Unknown',
        year: detailData.release_date ? detailData.release_date.split('-')[0] : 'Unknown',
        actor: creditsData.cast && creditsData.cast.length ? creditsData.cast[0].name : 'Unknown',
        tagline: detailData.tagline || ''
    };
}

function fetchWithAuth(url) {
    var headers = {};
    if (typeof TMDB_ACCESS_TOKEN !== 'undefined' && TMDB_ACCESS_TOKEN) {
        headers.Authorization = 'Bearer ' + TMDB_ACCESS_TOKEN;
    }

    return fetch(url, { headers: headers });
}

function renderHints() {
    var hintList = document.getElementById('hint-list');
    hintList.innerHTML = '';

    for (var i = 0; i < revealedHints; i++) {
        var li = document.createElement('li');
        li.textContent = hints[i];
        hintList.appendChild(li);
    }
}

function handleGuess() {
    if (isRoundLoading || !currentMovie || guessesLeft <= 0) {
        return;
    }

    var guessInput = document.getElementById('guess-input');
    var guess = guessInput.value.trim();
    if (!guess) {
        document.getElementById('result').textContent = 'Please enter a movie title before submitting.';
        document.getElementById('result').className = 'incorrect';
        return;
    }

    if (isCorrectGuess(guess, currentMovie.title)) {
        score += 1;
        localStorage.setItem('mrScore', String(score));
        document.getElementById('score').textContent = score;
        endRound('Correct! The answer was "' + currentMovie.title + '".', true);
        return;
    }

    guessesLeft -= 1;
    updateAttemptsText();

    if (guessesLeft > 0) {
        revealedHints = Math.min(revealedHints + 1, hints.length);
        renderHints();
        document.getElementById('result').textContent = 'Not quite. Try again!';
        document.getElementById('result').className = 'incorrect';
    } else {
        endRound('Out of guesses! The correct answer was "' + currentMovie.title + '".', false);
    }

    guessInput.value = '';
    guessInput.focus();
}

function endRound(message, isCorrect) {
    document.getElementById('result').textContent = message;
    document.getElementById('result').className = isCorrect ? 'correct' : 'incorrect';
    document.getElementById('guess-input').disabled = true;
    document.getElementById('submit-guess').disabled = true;
    document.getElementById('new-round').style.display = 'inline-block';
}

function updateAttemptsText() {
    document.getElementById('attempts-left').textContent = 'Guesses left: ' + guessesLeft;
}

function isCorrectGuess(guess, answer) {
    return normalizeTitle(guess) === normalizeTitle(answer);
}

function normalizeTitle(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

document.addEventListener('DOMContentLoaded', initializeGame);
