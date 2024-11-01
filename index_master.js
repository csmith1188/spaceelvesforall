// Start an express server with websockets without socket.io
const express = require('express');
// import express session module
const session = require('express-session');
// import the websockets module
const WebSocket = require('ws');
// import the express-ws module
const expressWs = require('express-ws')
// import sqlite3 database module
const sqlite3 = require('sqlite3').verbose();
// import local environment variables
require('dotenv').config();
// import webtoken module
const jwt = require('jsonwebtoken');

// Load the settings from the environment variables
// To set your own, make a file called ".env",
// and add lines like this: PORT=3000
// The port to run this on
const PORT = process.env.PORT || 3000;
// The URL for the Formbar authentication server
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:420/oauth';
// The URL for this server for the oauth callback
const THIS_URL = process.env.THIS_URL || 'http://localhost:3000/login';
// The secret for the session data
const FB_SECRET = process.env.FB_SECRET || 'secret';

const app = express();

// set the express view engine to ejs
app.set('view engine', 'ejs');

// set express to use public for static files
app.use(express.static(__dirname + '/public'));

// create a session middleware with a secret key
const sessionMiddleware = session({
    secret: FB_SECRET,
    resave: false,
    saveUninitialized: true,
    // Add a store if needed, like Redis for scalability
});
// use the session middleware in express
app.use(sessionMiddleware);

// use the express-ws module to add websockets to express
expressWs(app);

// This function is used to intercept page loads to check if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) next()
    else res.redirect('/login')
};

// Define a route handler for the default home page
app.get('/', (req, res) => {

});

// game page
app.get('/game', (req, res) => {
});

// login page
app.get('/login', (req, res) => {
    // if there is a session user
    if (req.query.token) {
        // decode the token and set the session token and user
        let tokenData = jwt.decode(req.query.token);
        req.session.token = tokenData;
        req.session.user = { name: tokenData.username, fbid: tokenData.id };
        // redirect to the home page
        res.redirect('/');
    } else {
        // send them to the Formbar login page
        res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
    };
});

app.ws('/chat', (ws, req) => {
    // send the client their id when they connect
    // ws.send(JSON.stringify({ id: ws.id }));
    console.log(`Client connected, ${new Date()}`);

    ws.on('message', (message) => {
        message = JSON.parse(message);
        if (message.press) {

        }


        if (message.release) {

        }

        if (message.resize) {

        }

    });

    // listen for disconnects
    ws.on('close', () => {

    });
});

// Start the server on port 3000
app.listen(PORT, () => {
    log(`Server started on http://localhost:${PORT}`);
});

// open the database file
let db = new sqlite3.Database('data/database.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the database.');
    }
});

var gameServers = [];