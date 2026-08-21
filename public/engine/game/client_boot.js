/**
 * Browser entry: bind DOM canvases to Game and start the client loop.
 * Loaded last from client.ejs so Match / Player / Socket globals already exist.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['Game'], factory);
    } else if (typeof module === 'object' && module.exports) {
        const Games = require('./game.js');
        module.exports = factory(Games.Game || Games);
    } else {
        const exports = factory(root.Game);
        for (const key in exports) {
            if (Object.prototype.hasOwnProperty.call(exports, key)) {
                root[key] = exports[key];
            }
        }
    }
}(typeof self !== 'undefined' ? self : this, function (Game) {
    function bootClientGame(options) {
        if (typeof document === 'undefined' || typeof Game !== 'function') {
            return null;
        }
        const opts = options || {};
        const game = new Game(Object.assign({ client: true }, opts.gameOptions || {}));
        game.bindClientDisplay(opts.elements || {});
        game.startClientLoop();
        if (typeof window !== 'undefined') {
            window.game = game;
            // Apply players / newMatch that arrived before Game existed (WS opens early).
            if (typeof window.flushPendingGameMessages === 'function') {
                window.flushPendingGameMessages();
            }
        }
        return game;
    }

    // Auto-start when included as a browser script after the page body.
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
        const start = function () {
            if (window.game) return;
            bootClientGame();
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    return { bootClientGame };
}));
