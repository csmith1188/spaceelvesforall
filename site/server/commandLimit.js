const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const EVENT_LIMITS = {
  tooltips: { max: 4, windowMs: 10000 },
  bgmVolume: { max: 8, windowMs: 10000 },
  chat: { max: 8, windowMs: 10000 },
  concede: { max: 2, windowMs: 10000 },
  leave: { max: 4, windowMs: 10000 },
  report: { max: 3, windowMs: 60000 },
  pause: { max: 8, windowMs: 10000 },
  startMatch: { max: 4, windowMs: 10000 },
};

function eventMax(fallback) {
  const fromEnv = Number(process.env.SOCKET_EVENT_LIMIT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return fallback;
}

export function allowSocketEvent(socket, name, now = Date.now()) {
  const spec = EVENT_LIMITS[name];
  if (!spec || !socket || !socket.data) return false;
  if (socket.data && BAD_KEYS.has(name)) return false;
  const max = eventMax(spec.max);
  if (!socket.data.eventBuckets) socket.data.eventBuckets = {};
  let bucket = socket.data.eventBuckets[name];
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + spec.windowMs };
    socket.data.eventBuckets[name] = bucket;
  }
  bucket.count += 1;
  return bucket.count <= max;
}
