const express = require('express');
const router = express.Router();

// GET endpoint: Fetch all users
router.get('/status', (req, res) => {
    //make a list of pack()ed players
    let players = [];
    for (let player of game.players) {
        players.push({
            displayName: player.token.displayName
        });
    }
    //make a list of pack()ed characters
    let characters = [];
    for (let character of game.match.characters) {
        characters.push(character.pack());
    }
    res.json({ players: players, characters: characters });
});

router.get('/statusall', (req, res) => {
    //make a list of pack()ed players
    let players = [];
    for (let player of game.players) {
        players.push({
            displayName: player.token.displayName
        });
    }
    //make a list of pack()ed characters
    let characters = [];
    for (let character of game.match.characters) {
        characters.push(character.fullPack());
    }
    res.json({ players: players, characters: characters });
});

module.exports = router;
