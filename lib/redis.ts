/**
 * Redis client for caching and session storage
 * Gracefully falls back to in-memory if Redis is not available
 */

import { Redis } from 'ioredis';
import { env } from './env';

let redis: Redis | null = null;
let redisAvailable = false;

// Initialize Redis client
if (env.REDIS_URL) {
  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some(targetError => err.message.includes(targetError));
      },
    });

    redis.on('connect', () => {
      redisAvailable = true;
      console.log('✓ Redis connected');
    });

    redis.on('error', (err) => {
      redisAvailable = false;
      console.error('Redis error:', err.message);
    });

    redis.on('close', () => {
      redisAvailable = false;
      console.warn('Redis connection closed');
    });
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    redis = null;
  }
}

/**
 * In-memory cache fallback
 * Simple LRU cache for when Redis is not available
 */
const memoryCache = new Map<string, { value: string; expiresAt: number }>();
const MAX_MEMORY_CACHE_SIZE = 1000;

function cleanMemoryCache() {
  const now = Date.now();
  const entries = Array.from(memoryCache.entries());
  
  // Remove expired entries
  for (const [key, entry] of entries) {
    if (entry.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
  
  // If still too large, remove oldest entries
  if (memoryCache.size > MAX_MEMORY_CACHE_SIZE) {
    const toRemove = memoryCache.size - MAX_MEMORY_CACHE_SIZE;
    const keys = Array.from(memoryCache.keys());
    for (let i = 0; i < toRemove; i++) {
      memoryCache.delete(keys[i]!);
    }
  }
}

// Clean memory cache every minute
setInterval(cleanMemoryCache, 60000);

/**
 * Get value from cache
 */
export async function cacheGet(key: string): Promise<string | null> {
  if (redis && redisAvailable) {
    try {
      return await redis.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
    }
  }
  
  // Fallback to memory
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }
  
  memoryCache.delete(key);
  return null;
}

/**
 * Set value in cache with TTL (seconds)
 */
export async function cacheSet(
  key: string,
  value: string,
  ttl: number
): Promise<boolean> {
  if (redis && redisAvailable) {
    try {
      await redis.setex(key, ttl, value);
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }
  
  // Fallback to memory
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttl * 1000,
  });
  
  return true;
}

/**
 * Delete value from cache
 */
export async function cacheDel(key: string): Promise<boolean> {
  if (redis && redisAvailable) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }
  
  memoryCache.delete(key);
  return true;
}

/**
 * Delete multiple keys matching pattern
 */
export async function cacheDelPattern(pattern: string): Promise<number> {
  if (redis && redisAvailable) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error('Redis del pattern error:', error);
    }
  }
  
  // Fallback to memory
  let count = 0;
  const regex = new RegExp(pattern.replace('*', '.*'));
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
      count++;
    }
  }
  
  return count;
}

/**
 * Check if key exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  if (redis && redisAvailable) {
    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
    }
  }
  
  const entry = memoryCache.get(key);
  return entry !== undefined && entry.expiresAt > Date.now();
}

/**
 * Increment counter
 */
export async function cacheIncr(key: string, ttl?: number): Promise<number> {
  if (redis && redisAvailable) {
    try {
      const value = await redis.incr(key);
      if (ttl) {
        await redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      console.error('Redis incr error:', error);
    }
  }
  
  // Fallback to memory
  const entry = memoryCache.get(key);
  const currentValue = entry ? parseInt(entry.value) || 0 : 0;
  const newValue = currentValue + 1;
  
  memoryCache.set(key, {
    value: String(newValue),
    expiresAt: ttl ? Date.now() + ttl * 1000 : Date.now() + 3600000,
  });
  
  return newValue;
}

/**
 * Get Redis client (for advanced operations)
 * Returns null if Redis is not available
 */
export function getRedisClient(): Redis | null {
  return redis && redisAvailable ? redis : null;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisAvailable;
}

/**
 * Graceful shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
  }
}
