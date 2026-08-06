// ============================================================
// lib/cache.js — Redis cache layer
// Used to cache public GET endpoints (products, categories,
// content) so high traffic never hits Postgres for hot reads.
//
// Design for 1M+ monthly traffic:
//   • short TTL (default 5 min) keeps data fresh
//   • keys are namespaced so invalidation is trivial
//   • graceful degradation — if Redis is down/unconfigured we
//     skip the cache entirely and serve from Postgres (no crash).
//
// Railway: Redis is OPTIONAL. If REDIS_URL is empty/absent the
// cache is disabled and every helper is a no-op — the app still
// boots and serves. Add a Railway Redis Plugin and set REDIS_URL
// to re-enable caching with zero code changes.
// ============================================================
const Redis = require('ioredis');
const config = require('../config');

let redis = null;

// Only attempt a connection when a Redis URL is actually configured.
if (config.redis.url) {
  try {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy(times) {
        // Back off and give up quietly after ~15 attempts.
        if (times > 15) return null;
        return Math.min(times * 200, 2000);
      },
    });
    redis.on('error', (err) => {
      console.warn('[cache] Redis unavailable — serving without cache:', err.message);
    });
    redis.on('ready', () => {
      console.log('[cache] Redis connected ✔');
    });
  } catch (err) {
    console.warn('[cache] Redis init failed — cache disabled:', err.message);
    redis = null;
  }
} else {
  console.log('[cache] REDIS_URL not set — cache disabled (graceful).');
}

const PREFIX = 'peo:';

async function get(key) {
  if (!redis) return null;
  try {
    const raw = await redis.get(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function set(key, value, ttlSeconds) {
  if (!redis) return;
  try {
    await redis.set(PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds || config.redis.cacheTtl);
  } catch {
    /* non-fatal */
  }
}

async function del(key) {
  if (!redis) return;
  try {
    await redis.del(PREFIX + key);
  } catch {
    /* non-fatal */
  }
}

/** Delete all keys matching a pattern (e.g. 'products:*'). */
async function delByPattern(pattern) {
  if (!redis) return;
  try {
    const keys = await redis.keys(PREFIX + pattern);
    if (keys.length) await redis.del(...keys);
  } catch {
    /* non-fatal */
  }
}

module.exports = { redis, get, set, del, delByPattern, PREFIX };
