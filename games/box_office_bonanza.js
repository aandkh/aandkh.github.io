let players = [];
let currentFilm = null;
let scores = JSON.parse(localStorage.getItem('bobScores')) || {};

// Player Setup
document.getElementById('add-player').addEventListener('click', () => {
    const playerList = document.getElementById('player-list');
    const entry = document.createElement('div');
    entry.className = 'player-entry';
    entry.innerHTML = `
        <input type="text" class="player-name" placeholder="Player Name">
        <button class="remove-player">Remove</button>
    `;
    playerList.appendChild(entry);
    updateRemoveButtons();
});

function updateRemoveButtons() {
    const removeButtons = document.querySelectorAll('.remove-player');
    removeButtons.forEach(button => {
        button.onclick = () => button.parentElement.remove();
    });
}

document.getElementById('start-game').addEventListener('click', () => {
    const playerNames = document.querySelectorAll('.player-name');
    players = Array.from(playerNames)
        .map(input => input.value.trim())
        .filter(name => name !== '');
    
    if (players.length < 1) {
        alert('Please add at least one player.');
        return;
    }

    document.getElementById('player-setup').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
    initializeGame();
});

// Initialize Game
function initializeGame() {
    selectFilm();
    updateScoreboard();
    renderGuessInputs();
}

function updateScoreboard() {
    const scoresList = document.getElementById('scores');
    scoresList.innerHTML = '';
    for (const player of players) {
        const li = document.createElement('li');
        li.textContent = `${player}: ${scores[player] || 0} points`;
        scoresList.appendChild(li);
    }
}

function renderGuessInputs() {
    const inputsDiv = document.getElementById('player-inputs');
    inputsDiv.innerHTML = '';
    players.forEach(player => {
        const div = document.createElement('div');
        div.innerHTML = `
            <label>${player}: <input type="number" class="guess-input" data-player="${player}" placeholder="Guess ($)" min="0"></label>
        `;
        inputsDiv.appendChild(div);
    });
}

// Fetch Film from TMDb
async function selectFilm() {
    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&sort_by=revenue.desc&primary_release_date.gte=1980-01-01`,
            {
                headers: {
                    Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`
                }
            }
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const movies = data.results.filter(movie => movie.revenue > 0);
        if (movies.length === 0) throw new Error('No movies with revenue found.');

        const randomMovie = movies[Math.floor(Math.random() * movies.length)];
        const detailsResponse = await fetch(
            `https://api.themoviedb.org/3/movie/${randomMovie.id}?api_key=${TMDB_API_KEY}&language=en-US`,
            {
                headers: {
                    Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`
                }
            }
        );
        if (!detailsResponse.ok) throw new Error(`HTTP error! status: ${detailsResponse.status}`);
        const movieDetails = await detailsResponse.json();

        currentFilm = {
            title: movieDetails.title,
            releaseYear: movieDetails.release_date ? movieDetails.release_date.split('-')[0] : 'Unknown',
            worldwideGross: movieDetails.revenue
        };

        document.getElementById('film-info').innerHTML = `
            <h3>${currentFilm.title} (${currentFilm.releaseYear})</h3>
            <p>Guess the worldwide box office gross!</p>
        `;
        document.getElementById('result').innerHTML = '';
        document.querySelectorAll('.guess-input').forEach(input => input.value = '');
    } catch (error) {
        console.error('Error fetching film:', error);
        document.getElementById('film-info').innerHTML = `
            <p>Error loading film: ${error.message}. Please try again.</p>
            <button onclick="selectFilm()">Retry</button>
        `;
    }
}

// Submit Guesses
document.getElementById('submit-guesses').addEventListener('click', () => {
    const guesses = [];
    let allGuessed = true;

    document.querySelectorAll('.guess-input').forEach(input => {
        const player = input.dataset.player;
        const guess = parseInt(input.value) || 0;
        if (!guess) allGuessed = false;
        guesses.push({ player, guess, diff: Math.abs(currentFilm.worldwideGross - guess) });
    });

    if (!allGuessed) {
        document.getElementById('result').innerHTML = '<p>Please enter guesses for all players.</p>';
        return;
    }

    const minDiff = Math.min(...guesses.map(g => g.diff));
    const winners = guesses.filter(g => g.diff === minDiff);
    winners.forEach(w => {
        scores[w.player] = (scores[w.player] || 0) + 1;
    });

    localStorage.setItem('bobScores', JSON.stringify(scores));
    updateScoreboard();

    document.getElementById('result').innerHTML = `
        <p><strong>Result:</strong> ${currentFilm.title} made $${currentFilm.worldwideGross.toLocaleString()} worldwide.</p>
        ${guesses.map(g => `<p>${g.player} guessed $${g.guess.toLocaleString()} (off by $${g.diff.toLocaleString()})</p>`).join('')}
        <p><strong>Winner${winners.length > 1 ? 's' : ''}:</strong> ${winners.map(w => w.player).join(', ')}</p>
    `;
});

// Next Film
document.getElementById('next-film').addEventListener('click', selectFilm);

// Reset Game (New Game)
document.getElementById('reset-game').addEventListener('click', () => {
    players = [];
    scores = {};
    localStorage.removeItem('bobScores');
    document.getElementById('player-setup').style.display = 'block';
    document.getElementById('game-area').style.display = 'none';
    document.getElementById('player-list').innerHTML = `
        <div class="player-entry">
            <input type="text" class="player-name" placeholder="Player Name">
            <button class="remove-player">Remove</button>
        </div>
    `;
    updateRemoveButtons();
});

// Initial Setup
updateRemoveButtons();
