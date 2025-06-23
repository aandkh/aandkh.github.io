var players = [];
var currentFilm = null;
var scores = JSON.parse(localStorage.getItem('bobScores')) || {};

// Fallback static dataset
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

// Player Setup
function setupEventListeners() {
    var addPlayerButton = document.getElementById('add-player');
    if (!addPlayerButton) {
        console.error('Add Player button not found!');
        return;
    }
    addPlayerButton.addEventListener('click', function() {
        console.log('Add Player clicked');
        var playerList = document.getElementById('player-list');
        var entry = document.createElement('div');
        entry.className = 'player-entry';
        entry.innerHTML = [
            '<input type="text" class="player-name" placeholder="Player Name">',
            '<button class="remove-player">Remove</button>'
        ].join('');
        playerList.appendChild(entry);
        updateRemoveButtons();
    });

    var startGameButton = document.getElementById('start-game');
    if (!startGameButton) {
        console.error('Start Game button not found!');
        return;
    }
    startGameButton.addEventListener('click', function() {
        console.log('Start Game clicked');
        var playerNames = document.querySelectorAll('.player-name');
        players = Array.from(playerNames)
            .map(function(input) { return input.value.trim(); })
            .filter(function(name) { return name !== ''; });
        
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
    var removeButtons = document.querySelectorAll('.remove-player');
    removeButtons.forEach(function(button) {
        button.onclick = function() {
            console.log('Remove Player clicked');
            button.parentElement.remove();
        };
    });
}

// Initialize Game
function initializeGame() {
    selectFilm();
    updateScoreboard();
    renderGuessInputs();
}

function updateScoreboard() {
    var scoresList = document.getElementById('scores');
    if (!scoresList) {
        console.error('Scores list not found!');
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
    var inputsDiv = document.getElementById('player-inputs');
    if (!inputsDiv) {
        console.error('Player inputs div not found!');
        return;
    }
    inputsDiv.innerHTML = '';
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        var div = document.createElement('div');
        div.innerHTML = [
            '<label>' + player + ': ',
            '<input type="number" class="guess-input" data-player="' + player + '" placeholder="Guess ($)" min="0">',
            '</label>'
        ].join('');
        inputsDiv.appendChild(div);
    }
}

// Select Film (using fallback dataset)
function selectFilm() {
    console.log('Selecting film from fallback dataset');
    currentFilm = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
    renderFilm();
}

function renderFilm() {
    console.log('Rendering film:', currentFilm);
    var filmInfo = document.getElementById('film-info');
    if (!filmInfo) {
        console.error('Film info div not found!');
        return;
    }
    filmInfo.innerHTML = [
        '<h3>' + currentFilm.title + ' (' + currentFilm.releaseYear + ')</h3>',
        '<p>Guess the worldwide box office gross!</p>'
    ].join('');
    document.getElementById('result').innerHTML = '';
    var guessInputs = document.querySelectorAll('.guess-input');
    for (var i = 0; i < guessInputs.length; i++) {
        guessInputs[i].value = '';
    }
}

// Submit Guesses
function setupSubmitGuesses() {
    var submitButton = document.getElementById('submit-guesses');
    if (!submitButton) {
        console.error('Submit Guesses button not found!');
        return;
    }
    submitButton.addEventListener('click', function() {
        console.log('Submit Guesses clicked');
        var guesses = [];
        var allGuessed = true;

        var guessInputs = document.querySelectorAll('.guess-input');
        guessInputs.forEach(function(input) {
            var player = input.dataset.player;
            var guess = parseInt(input.value) || 0;
            if (!guess) allGuessed = false;
            guesses.push({ player: player, guess: guess, diff: Math.abs(currentFilm.worldwideGross - guess) });
        });

        if (!allGuessed) {
            document.getElementById('result').innerHTML = '<p>Please enter guesses for all players.</p>';
            return;
        }

        var minDiff = Math.min.apply(null, guesses.map(function(g) { return g.diff; }));
        var winners = guesses.filter(function(g) { return g.diff === minDiff; });
        winners.forEach(function(w) {
            scores[w.player] = (scores[w.player] || 0) + 1;
        });

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

// Next Film
function setupNextFilm() {
    var nextFilmButton = document.getElementById('next-film');
    if (!nextFilmButton) {
        console.error('Next Film button not found!');
        return;
    }
    nextFilmButton.addEventListener('click', function() {
        console.log('Next Film clicked');
        selectFilm();
    });
}

// Reset Game (New Game)
function setupResetGame() {
    var resetButton = document.getElementById('reset-game');
    if (!resetButton) {
        console.error('Reset Game button not found!');
        return;
    }
    resetButton.addEventListener('click', function() {
        console.log('Reset Game clicked');
        players = [];
        scores = {};
        localStorage.removeItem('bobScores');
        localStorage.removeItem('cachedMovies');
        document.getElementById('player-setup').style.display = 'block';
        document.getElementById('game-area').style.display = 'none';
        document.getElementById('player-list').innerHTML = [
            '<div class="player-entry">',
            '<input type="text" class="player-name" placeholder="Player Name">',
            '<button class="remove-player">Remove</button>',
            '</div>'
        ].join('');
        updateRemoveButtons();
    });
}

// Initialize Event Listeners
try {
    console.log('Setting up event listeners...');
    setupEventListeners();
    setupSubmitGuesses();
    setupNextFilm();
    setupResetGame();
    updateRemoveButtons();
} catch (error) {
    console.error('Error setting up event listeners:', error);
}

console.log('Script loaded');
