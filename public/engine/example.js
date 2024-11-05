(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['Characters', 'Utils'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        const Characters = require('./character'); // Adjust path if needed
        const Utils = require('../../utils'); // Adjust path if needed
        module.exports = factory(Characters, Utils);
    } else {
        // Browser globals: attach each export directly to the global scope
        const exports = factory(root.Characters, root.Utils);
        for (let key in exports) {
            if (exports.hasOwnProperty(key)) {
                root[key] = exports[key];
            }
        }
    }
}(typeof self !== 'undefined' ? self : this, function (Characters, Utils) {

    class Thing {
        constructor() {
            
        }
    }

    return { Thing };
}));