const jwt = require('jsonwebtoken');
const config = require('./config.js');
const { db } = require('./database.js');

function sessionFromFormbarToken(tokenData) {
    if (!tokenData || typeof tokenData !== 'object') return null;
    const displayName = tokenData.displayName || tokenData.name || tokenData.username;
    if (!displayName) return null;
    return {
        ...tokenData,
        displayName,
        verified: true
    };
}

/**
 * Formbar OAuth callback: GET /login?token=… — align with formbarboilerplate session shape.
 */
exports.loginGET = (req, res) => {
    if (req.query.token) {
        const raw = jwt.decode(req.query.token);
        const normalized = sessionFromFormbarToken(raw);
        if (!normalized) {
            return res.status(400).render('error', { error: 'Invalid or incomplete login token.' });
        }

        req.session.token = normalized;
        req.session.user = normalized.displayName;

        const uid = normalized.id != null ? String(normalized.id) : '';
        db.get('SELECT * FROM users WHERE fb_displayName=? OR displayName=?;', [normalized.displayName, normalized.displayName], (err, row) => {
            if (err) {
                console.error(err);
                return res.render('error', { error: `Database error: ${err.message}` });
            }
            if (!row) {
                db.run(
                    'INSERT INTO users (displayName, fb_id, fb_displayName, validated) VALUES (?, ?, ?, ?);',
                    [normalized.displayName, uid, normalized.displayName, 1],
                    (insertErr) => {
                        if (insertErr) {
                            console.error(insertErr);
                            return res.render('error', { error: `Database error: ${insertErr.message}` });
                        }
                        console.info(`New user ${normalized.displayName} created (Formbar)`);
                        res.redirect('/');
                    }
                );
            } else {
                res.redirect('/');
            }
        });
        return;
    }

    const returnUrl = config.buildThisUrl('/login');
    res.redirect(config.buildFormbarOAuthRedirect(returnUrl));
};

exports.logoutGET = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).send('Could not log out.');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
};
