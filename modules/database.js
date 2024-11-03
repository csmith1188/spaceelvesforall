// import sqlite3
const sqlite3 = require('sqlite3').verbose();

// open the database file
exports.db = new sqlite3.Database('data/database.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to user database.');
    }
});