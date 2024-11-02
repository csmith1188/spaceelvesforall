const path = require('path');
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
// import child process handler
const { spawn } = require('child_process');
// sqlite3 session store
const SQLiteStore = require('connect-sqlite3')(session);
// module for hashing passwords
const crypto = require("crypto");
// module for sending emails
const nodemailer = require('nodemailer');
// module for rendering html emails
const ejs = require('ejs');

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
const SS_SECRET = process.env.SS_SECRET || 'secret';

// The host, email and password for the email server
EMAIL_HOST = process.env.EMAIL_HOST;
EMAIL_USER = process.env.EMAIL_USER;
EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST, // Replace with your SMTP host
    port: 465, // Use 465 for secure, or 587 for STARTTLS
    secure: true, // true for port 465, false for other ports
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

function sendVerificationEmail(userEmail, username) {

    const token = jwt.sign({ email: userEmail }, SS_SECRET, { expiresIn: '1h' });
    const url = `${THIS_URL}/verify?token=${token}`;

    ejs.renderFile(__dirname + '/views/email.ejs', { username: username, url: url }, (err, renderedTemplate) => {
        console.log(renderedTemplate);

        if (err) {
            console.error('Error rendering template:', err);
        } else {
            // Prepare the email
            const mailOptions = {
                from: EMAIL_USER,
                to: userEmail,
                subject: 'Space Elves On Jetbikes Email Verification',
                text: `Hello, ${username}! Click this link to verify your email: ${url}`,
                html: renderedTemplate
            };

            // Send the email
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });
        }
    });
}

const app = express();

// set the express view engine to ejs
app.set('view engine', 'ejs');

// set express to use public for static files
app.use(express.static(__dirname + '/public'));

// read the body of the request
app.use(express.urlencoded({ extended: true }));

// create a session middleware with a secret key using in memory store
const sessionMiddleware = session({
    store: new SQLiteStore(),
    secret: SS_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

// use the session middleware in express
app.use(sessionMiddleware);

// use the express-ws module to add websockets to express
expressWs(app);

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
        gameServers.forEach((server) => {
            gamesList.push(server.PORT);
        });
    }
    res.render('index', { this_url: THIS_URL + '/login', gamesList: gamesList, token: req.session.token });
});

// game page
app.get('/newgame', isAuthenticated, (req, res) => {
    if (req.session.token.verified) {
        // Start another Node.js script with the port argument
        const child = spawn('node', [__dirname + '/game/index_game.js', '-p ' + gameServerCount]); // add { detached: true } to run in the background
        child.PORT = gameServerCount;

        // Listen for standard output (stdout) data from the child process
        child.stdout.on('data', (data) => {
            console.log(`Server Info ${child.PORT}: ${data}`);
        });

        // Listen for standard error (stderr) data from the child process
        child.stderr.on('data', (data) => {
            console.error(`Server Error ${child.PORT}: ${data}`);
        });

        // Listen for the child process to close (when it finishes or exits)
        child.on('close', (code) => {
            console.log(`Server ${child.PORT} exited with code ${code}`);
        });

        // Optional: Listen for exit events in case the process is terminated unexpectedly
        child.on('exit', (code, signal) => {
            if (signal) {
                console.log(`Server ${child.PORT} was killed with signal: ${signal}`);
            } else {
                console.log(`Server ${child.PORT} exited with code: ${code}`);
            }
        });

        res.redirect(`http://localhost:${child.PORT}/`);

        gameServers.push(child);
        gameServerCount++;

    } else {
        res.render('error', { error: "You must verify your email before creating a game." });
    }

});

// login page
app.get('/login', (req, res) => {
    // if there is a session user
    if (req.query.token) {
        // decode the token and set the session token and user
        let tokenData = jwt.decode(req.query.token);
        req.session.token = tokenData;
        db.get("SELECT * FROM users WHERE fb_username=?;", req.session.token.username, (err, row) => {
            if (err) {
                console.error(err);
                res.render('error', { error: `Database error: ${err}` });
            } else if (!row) {
                db.run("INSERT INTO users (username, fb_id, fb_username, validated) VALUES (?, ?, ?, ?);", [req.session.token.username, req.session.token.id, req.session.token.username, 1], (err) => {
                    if (err) {
                        console.error(err);
                        res.render('error', { error: `Database error: ${err}` });
                    } else {
                        console.log(`New user ${req.session.token.username} created`);
                        res.redirect('/');
                    }
                });
            } else {
                res.redirect("/");
            }
        });
    } else {
        if (req.query.formbar == 'true') {
            // send them to the Formbar login page
            res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL + '/login'}`);
        } else {
            //redner local login page
            res.render('login', { this_url: THIS_URL + '/login' });
        }
    };
});

// Define a route handler for logging out
app.get('/logout', isAuthenticated, (req, res) => {
    // Destroy the session
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).send('Could not log out.');
        }
        // Optionally, clear the session cookie
        res.clearCookie('connect.sid'); // Adjust the cookie name if different
        // Redirect the user to the home page or login page
        res.redirect('/');
    });
});

app.post("/login", (req, res) => {
    if (req.body.username && req.body.password) {
        db.get("SELECT * FROM users WHERE username=?;", req.body.username, (err, row) => {
            if (err) {
                console.error(err);
                res.render('error', { error: `Database error: ${err}` });
            } else if (!row) {
                console.error("User not found");
                res.render('error', { error: "User not found. You must <a href='/signup'>make an account</a> first." });
            } else {
                // Compare stored password with provided password
                crypto.pbkdf2(req.body.password, row.salt, 1000, 64, "sha512", (err, derivedKey) => {
                    if (err) {
                        console.error(err);
                        res.render('error', { error: `Error hashing password: ${err}` });
                    } else {
                        const hashedPassword = derivedKey.toString("hex");
                        if (row.hash === hashedPassword) {
                            req.session.token = {
                                username: row.username || row.fb_username,
                                verified: row.validated
                            }
                            res.redirect("/");
                        } else {
                            console.log("Incorrect password");
                            res.render('error', { error: "Incorrect password" });
                        }
                    }
                });
            }
        });
    } else {
        console.log("No username and password provided");
        res.render('error', { error: "No username and password provided" });
    }
});

app.get('/signup', (req, res) => {
    res.render('signup', { this_url: THIS_URL + '/login' });
});

app.post('/signup', (req, res) => {
    if (!req.body.username || !req.body.password || !req.body.email) {
        console.error("The username, password, or email is missing");
        res.render('error', { error: "The username, password, or email is missing" });
    } else {
        // Check to see if a user with that username already exists
        db.get("SELECT * FROM users WHERE username=? OR email=?;", req.body.username, req.body.email, (err, row) => {
            if (err) {
                console.error(err);
                res.render('error', { error: `Database error: ${err}` });
            } else if (row) {
                console.error("A user with that username or email already exists");
                res.render('error', { error: "A user with that username or email already exists" });
            } else {
                // Create a new salt for this user
                const salt = crypto.randomBytes(16).toString("hex");

                // Use this salt to "hash" the password
                crypto.pbkdf2(req.body.password, salt, 1000, 64, "sha512", (err, derivedKey) => {
                    if (err) {
                        console.error(err);
                        res.render('error', { error: `Error hashing password: ${err}` });
                    } else {
                        const hashedPassword = derivedKey.toString("hex");
                        db.run("INSERT INTO users (username, email, hash, salt, validated) VALUES (?, ?, ?, ?, ?);", [req.body.username, req.body.email, hashedPassword, salt, 0], (err) => {
                            if (err) {
                                console.error(err);
                                res.render('error', { error: `Database error: ${err}` });
                            } else {
                                req.session.token = {
                                    username: req.body.username,
                                    verified: false
                                }
                                console.log(`New user ${req.body.username} created`);
                                sendVerificationEmail(req.body.email, req.body.username);
                                res.redirect('/');
                            }
                        });
                    }
                });
            }
        });
    }
});

app.get('/verify', (req, res) => {
    if (req.query.token) {
        jwt.verify(req.query.token, SS_SECRET, (err, decoded) => {
            if (err) {
                console.error(err);
                res.render('error', { error: `Error verifying token: ${err}` });
            } else {
                db.run("UPDATE users SET validated=1 WHERE email=?;", decoded.email, (err) => {
                    if (err) {
                        console.error(err);
                        res.render('error', { error: `Database error: ${err}` });
                    } else {
                        if (req.session.token) {
                            req.session.token.verified = true;
                        }
                        res.render('verified', { email: decoded.email });
                    }
                });
            }
        });
    } else {
        res.render('error', { error: "No token provided" });
    }
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
    console.log(`Server started on http://localhost:${PORT}`);
});

// open the database file
let db = new sqlite3.Database('data/database.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to user database.');
    }
});

var gameServerCount = 11100;
var gameServers = [];