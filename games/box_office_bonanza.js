let players = [];
let scores = JSON.parse(localStorage.getItem('movies')) || [];
let currentGame = null;

// Fallback static dataset
const fallbackMovies = [
    { title: "Titanic", releaseYear: "1997", worldwideGross: 2208208395 },
    { title: "Avengers: Endgame", releaseYear: "2019", worldwideGross: 2797800564 },
    { title: "Avatar", releaseYear: "2009", worldwideGross: 2847246203 },
    { title: "Star Wars: The Force Awakens", releaseYear: "2015", worldwideGross: 2068223624 },
    { title: "Jurassic World", releaseYear: "2015", worldwideGross: 1671713208 },
    { title: "The Lion King (2019)", releaseYear: "2019", worldwideGross: 1656943394 },
    { title: "The Avengers", releaseYear: "2012", worldwideGross: 1518812988 },
    { title: "Furious 7", releaseYear: "2015", worldwideGross: 1516045911 },
    { title: "Frozen II", releaseYear: "2019", worldwideGross: 1450026933 },
    { title: "Spider-Man: Far From Home", releaseYear: "2019", worldwideGross: 1131927996 },
];

// Player Setup
document.getElementById('add-player').addEventListener('click', function() => {
    const playerList = document.querySelector('#player-list');
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

// Fetch Film from TMDb with Retry and Fallback
async function selectFilm(attempt = 1, maxAttempts = 3) {
    const cachedMovies = JSON.parse(localStorage.getItem('cachedMovies')) || [];
    
    // Use cached movie if available
    if (cachedMovies.length > 0) {
        currentFilm = cachedMovies[Math.floor(Math.random() * cachedMovies.length)];
        renderFilm();
        return;
    }

    try {
        // Adjust query based on attempt
        const queryParams = attempt === 1 
            ? 'sort_by=revenue.desc&primary_release_date.gte=1980-01-01'
            : 'primary_release_date.gte=1980-01-01&sort_by=popularity.desc';
        
        const response = await fetch(
            `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&${queryParams}&page=${Math.floor(Math.random() * 10) + 1}`,
            {
                headers: {
                    Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`
                }
            }
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const movies = data.results.filter(movie => movie.revenue > 0);
        
        if (movies.length === 0 && attempt < maxAttempts) {
            console.warn(`No movies with revenue found on attempt ${attempt}. Retrying...`);
            return selectFilm(attempt + 1, maxAttempts);
        }
        
        if (movies.length === 0) {
            console.warn('No movies with revenue found after max attempts. Using fallback.');
            currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
            renderFilm();
            return;
        }

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
        if (!movieDetails.revenue || movieDetails.revenue <= 0) {
            if (attempt < maxAttempts) {
                console.warn(`Movie ${movieDetails.title} has no revenue. Retrying...`);
                return selectFilm(attempt + 1, maxAttempts);
            } else {
                console.warn(`Movie ${movieDetails.title} has no revenue. Using fallback.`);
                currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
                renderFilm();
                return;
            }
        }

        currentFilm = {
            title: movieDetails.title,
            releaseYear: movieDetails.release_date ? movieDetails.release_date.split('-')[0] : 'Unknown',
            worldwideGross: movieDetails.revenue
        };

        // Cache valid movie
        cachedMovies.push(currentFilm);
        localStorage.setItem('cachedMovies', JSON.stringify(cachedMovies.slice(-50))); // Keep last 50 movies
        
        renderFilm();
    } catch (error) {
        console.error('Error fetching film:', error);
        if (attempt < maxAttempts) {
            console.warn(`API error on attempt ${attempt}. Retrying...`);
            return selectFilm(attempt + 1, maxAttempts);
        }
        // Fallback to static dataset
        console.warn('API failed after max attempts. Using fallback.');
        currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
        renderFilm();
    }
}

function renderFilm() {
    document.getElementById('film-info').innerHTML = `
        <h3>${currentFilm.title} (${currentFilm.releaseYear})</h3>
        <p>Guess the worldwide box office gross!</p>
    `;
    document.getElementById('result').innerHTML = '';
    document.querySelectorAll('.guess-input').forEach(input => input.value = '');
}

// Submit Guesses
document.getElementById('submit-guesses').addEventListener('click', () => {
    const guesses = [];
    let allGuessed = true;

    document.querySelectorAll('.guess-input').forEach(input =>
