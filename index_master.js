// Start an express server with websockets without socket.io
const express = require('express');
// load the configuration file
const config = require('./modules/config.js');
// load modules/authoriation.js
const auth = require('./modules/authorization.js');
// load modules/gameServer.js
const game = require('./modules/gameServer.js');

// Create a new express application
const app = express();

// WebSocket
require('./modules/chat.js')(app);

// set the express view engine to ejs
app.set('view engine', 'ejs');

// set express to use public for static files
app.use(express.static(__dirname + '/public'));

// read the body of the request
app.use(express.urlencoded({ extended: true }));

// make 'public' the static folder
app.use(express.static(__dirname + '/public'));

// use the session middleware in express
app.use(config.sessionMiddleware);

// This function is used to intercept page loads to check if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.token) next()
    else res.redirect('/login')
};

// Define a route handler for the default home page
app.get('/', (req, res) => {
    // make a list of game server ports
    let gamesList = [];
    if (req.session.token) {
        game.gameServers.forEach((server) => {
            gamesList.push(server.PORT);
        });
    }
    res.render('index', { this_url: config.THIS_URL + '/login', gamesList: gamesList, token: req.session.token });
});

// Handle account management endpoints
app.get('/login', auth.loginGET);
app.post('/login', auth.loginPOST);
app.get('/signup', auth.signupGET);
app.post('/signup', auth.signupPOST);
app.get('/logout', auth.logoutGET);
app.get('/verify', auth.verifyGET);

// game page
app.get('/newgame', isAuthenticated, game.spawnGameServer);

// Start the server on port 3000
app.listen(config.PORT, () => {
    console.info(`Server started on http://localhost:${config.PORT}`);
});