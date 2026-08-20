'use strict';

/**
 * Node 21+ removed `buffer.SlowBuffer`. Older transitive deps (buffer-equal-constant-time,
 * pulled in by jsonwebtoken → jws → jwa) still reference it. Alias before loading JWT code.
 */
const buf = require('buffer');
if (!buf.SlowBuffer) {
    buf.SlowBuffer = buf.Buffer;
}
