// load the configuration file
const config = require('./config.js');
// load the database module
const { db } = require('./database.js');
// load the jsonwebtoken module
const jwt = require('jsonwebtoken');
// load the crypto module
const crypto = require('crypto');
// module for sending emails
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: config.EMAIL_HOST, // Replace with your SMTP host
    port: 465, // Use 465 for secure, or 587 for STARTTLS
    secure: true, // true for port 465, false for other ports
    auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS
    }
});

function sendVerificationEmail(userEmail, username) {

    const token = jwt.sign({ email: userEmail }, config.SS_SECRET, { expiresIn: '1h' });
    const url = `${config.THIS_URL}/verify?token=${token}`;

    ejs.renderFile(__dirname + '/views/email.ejs', { username: username, url: url }, (err, renderedTemplate) => {
        if (err) {
            console.error('Error rendering template:', err);
        } else {
            // Prepare the email
            const mailOptions = {
                from: config.EMAIL_USER,
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

// login page
exports.loginGET = (req, res) => {
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
                        console.info(`New user ${req.session.token.username} created`);
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
            res.redirect(`${config.AUTH_URL}?redirectURL=${config.THIS_URL + '/login'}`);
        } else {
            //render local login page
            res.render('login', { this_url: config.THIS_URL + '/login' });
        }
    };
}


exports.loginPOST = (req, res) => {
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
                            console.info("Incorrect password");
                            res.render('error', { error: "Incorrect password" });
                        }
                    }
                });
            }
        });
    } else {
        console.info("No username and password provided");
        res.render('error', { error: "No username and password provided" });
    }
}

// Define a route handler for logging out
exports.logoutGET = (req, res) => {
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
}

exports.signupGET = (req, res) => {
    res.render('signup', { this_url: config.THIS_URL + '/login' });
}

exports.signupPOST = (req, res) => {
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
                                console.info(`New user ${req.body.username} created`);
                                sendVerificationEmail(req.body.email, req.body.username);
                                res.redirect('/');
                            }
                        });
                    }
                });
            }
        });
    }
}

exports.verifyGET = (req, res) => {
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
}