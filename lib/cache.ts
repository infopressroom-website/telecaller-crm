/**
 * High-level caching utilities
 * Provides easy-to-use caching with automatic serialization
 */

import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from './redis';

/**
 * Cache a function result with automatic serialization
 * 
 * @example
 * const users = await cached('users:list', 300, async () => {
 *   return await db.user.findMany();
 * });
 */
export async function cached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Try to get from cache
  const cached = await cacheGet(key);
  
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch (error) {
      // If JSON parse fails, invalidate cache and refetch
      await cacheDel(key);
    }
  }
  
  // Fetch fresh data
  const fresh = await fetcher();
  
  // Store in cache
  try {
    await cacheSet(key, JSON.stringify(fresh), ttl);
  } catch (error) {
    // If serialization fails, just log and return the data
    console.error('Cache serialization error:', error);
  }
  
  return fresh;
}

/**
 * Invalidate cache by key
 */
export async function invalidate(key: string): Promise<void> {
  await cacheDel(key);
}

/**
 * Invalidate multiple cache keys by pattern
 * 
 * @example
 * await invalidatePattern('leads:*');
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  await cacheDelPattern(pattern);
}

/**
 * Cache keys for common queries
 */
export const CacheKeys = {
  // Dashboard
  dashboardMetrics: (userId: string) => `dashboard:metrics:${userId}`,
  dashboardActivity: (userId: string) => `dashboard:activity:${userId}`,
  
  // Leads
  leadList: (filters: string) => `leads:list:${filters}`,
  leadDetails: (id: string) => `leads:${id}`,
  leadCount: (filters: string) => `leads:count:${filters}`,
  
  // Users
  user: (id: string) => `user:${id}`,
  userPermissions: (id: string) => `user:${id}:permissions`,
  userTeam: (id: string) => `user:${id}:team`,
  
  // Teams
  team: (id: string) => `team:${id}`,
  teamMembers: (id: string) => `team:${id}:members`,
  
  // Performance
  performance: (userId: string, period: string) => `performance:${userId}:${period}`,
  targets: (userId: string) => `targets:${userId}`,
  
  // Reports
  report: (type: string, filters: string) => `report:${type}:${filters}`,
  
  // Call logs
  callLogs: (filters: string) => `calls:list:${filters}`,
  
  // Follow-ups
  followUps: (userId: string, status: string) => `followups:${userId}:${status}`,
  
  // Settings
  dispositions: () => 'settings:dispositions',
  leadSources: () => 'settings:sources',
  campaigns: () => 'settings:campaigns',
} as const;

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 3600,          // 1 hour
  VERY_LONG: 86400,    // 24 hours
  
  // Specific use cases
  DASHBOARD: 300,      // 5 minutes
  LIST: 60,            // 1 minute
  DETAILS: 300,        // 5 minutes
  PERMISSIONS: 600,    // 10 minutes
  SETTINGS: 3600,      // 1 hour
  REPORT: 3600,        // 1 hour
} as const;

/**
 * Memoize function results in-memory (for single request)
 * Use this for expensive computations within a single request
 */
const requestCache = new Map<string, any>();

export function memoize<T>(
  key: string,
  fn: () => T
): T {
  if (requestCache.has(key)) {
    return requestCache.get(key) as T;
  }
  
  const result = fn();
  requestCache.set(key, result);
  
  // Clear after request (5 seconds)
  setTimeout(() => requestCache.delete(key), 5000);
  
  return result;
}

/**
 * Clear all memoized values (call at end of request)
 */
export function clearMemoized(): void {
  requestCache.clear();
}

/**
 * Batch cache operations for efficiency
 */
export class CacheBatch {
  private operations: Array<() => Promise<void>> = [];
  
  set<T>(key: string, value: T, ttl: number): this {
    this.operations.push(async () => {
      await cacheSet(key, JSON.stringify(value), ttl);
    });
    return this;
  }
  
  del(key: string): this {
    this.operations.push(async () => {
      await cacheDel(key);
    });
    return this;
  }
  
  async execute(): Promise<void> {
    await Promise.all(this.operations.map(op => op()));
    this.operations = [];
  }
}

/**
 * Create a new cache batch
 * 
 * @example
 * await batch()
 *   .set('key1', value1, 300)
 *   .set('key2', value2, 300)
 *   .del('key3')
 *   .execute();
 */
export function batch(): CacheBatch {
  return new CacheBatch();
}
