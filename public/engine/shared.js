(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        module.exports = factory();
    } else {
        // Browser globals: attach each export directly to the global scope
        const exports = factory();
        for (let key in exports) {
            if (exports.hasOwnProperty(key)) {
                root[key] = exports[key];
            }
        }
    }
}(typeof self !== 'undefined' ? self : this, function () {
    function greet(name) {
        return `Hello, ${name}!`;
    }

    var testString = "This is a test string";

    return { greet, testString };
}));