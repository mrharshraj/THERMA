// Tiny TTL cache keyed by string.
const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + (ttlMs || 15 * 60 * 1000) });
  return value;
}

function memoized(make, key, ttlMs) {
  const cached = get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  return Promise.resolve(make()).then((value) => {
    set(key, value, ttlMs);
    return value;
  });
}

function clear() {
  store.clear();
}

module.exports = { get, set, memoized, clear };