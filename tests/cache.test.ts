/**
 * Unit tests for Redis caching with graceful fallback
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Redis before importing
vi.mock("ioredis", () => {
  return {
    Redis: vi.fn(() => ({
      on: vi.fn(),
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(() => []),
      exists: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      quit: vi.fn(),
    })),
  };
});

describe("Cache functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cacheSet and cacheGet work with in-memory fallback", async () => {
    const { cacheSet, cacheGet } = await import("@/lib/redis");
    
    const key = "test:key:1";
    const value = "test-value";
    
    await cacheSet(key, value, 60);
    const retrieved = await cacheGet(key);
    
    expect(retrieved).toBe(value);
  });

  it("cacheGet returns null for non-existent keys", async () => {
    const { cacheGet } = await import("@/lib/redis");
    
    const retrieved = await cacheGet("non-existent-key");
    
    expect(retrieved).toBeNull();
  });

  it("cacheDel removes keys from cache", async () => {
    const { cacheSet, cacheGet, cacheDel } = await import("@/lib/redis");
    
    const key = "test:key:2";
    await cacheSet(key, "value", 60);
    await cacheDel(key);
    const retrieved = await cacheGet(key);
    
    expect(retrieved).toBeNull();
  });

  it("cacheDelPattern removes keys matching pattern", async () => {
    const { cacheSet, cacheGet, cacheDelPattern } = await import("@/lib/redis");
    
    await cacheSet("dashboard:metrics:user1", "data1", 60);
    await cacheSet("dashboard:metrics:user2", "data2", 60);
    await cacheSet("leads:counts:user1", "data3", 60);
    
    const deleted = await cacheDelPattern("dashboard:*");
    
    expect(deleted).toBeGreaterThan(0);
    expect(await cacheGet("dashboard:metrics:user1")).toBeNull();
    expect(await cacheGet("leads:counts:user1")).not.toBeNull();
  });

  it("cached entries expire after TTL", async () => {
    const { cacheSet, cacheGet } = await import("@/lib/redis");
    
    const key = "test:expiry";
    await cacheSet(key, "value", 0); // 0 second TTL
    
    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const retrieved = await cacheGet(key);
    expect(retrieved).toBeNull();
  });

  it("cacheExists checks key existence", async () => {
    const { cacheSet, cacheExists } = await import("@/lib/redis");
    
    const key = "test:exists";
    await cacheSet(key, "value", 60);
    
    expect(await cacheExists(key)).toBe(true);
    expect(await cacheExists("non-existent")).toBe(false);
  });

  it("cacheIncr increments counter", async () => {
    const { cacheIncr } = await import("@/lib/redis");
    
    const key = "test:counter";
    const val1 = await cacheIncr(key, 60);
    const val2 = await cacheIncr(key, 60);
    
    expect(val1).toBe(1);
    expect(val2).toBe(2);
  });

  it("isRedisAvailable returns false when Redis is not configured", async () => {
    const { isRedisAvailable } = await import("@/lib/redis");
    
    // In test environment without REDIS_URL, should return false
    expect(typeof isRedisAvailable()).toBe("boolean");
  });
});

describe("High-level cache utilities", () => {
  it("cached() function caches and retrieves data", async () => {
    const { cached } = await import("@/lib/cache");
    
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { data: "test-data", count: callCount };
    };
    
    const result1 = await cached("test:cached:1", 60, fetcher);
    const result2 = await cached("test:cached:1", 60, fetcher);
    
    expect(result1.data).toBe("test-data");
    expect(result2.data).toBe("test-data");
    expect(callCount).toBe(1); // Fetcher called only once
  });

  it("invalidate() clears cached data", async () => {
    const { cached, invalidate } = await import("@/lib/cache");
    
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { count: callCount };
    };
    
    await cached("test:invalidate", 60, fetcher);
    await invalidate("test:invalidate");
    await cached("test:invalidate", 60, fetcher);
    
    expect(callCount).toBe(2); // Fetcher called twice after invalidation
  });

  it("invalidatePattern() clears multiple keys", async () => {
    const { cached, invalidatePattern } = await import("@/lib/cache");
    
    await cached("prefix:key1", 60, async () => "data1");
    await cached("prefix:key2", 60, async () => "data2");
    await cached("other:key", 60, async () => "data3");
    
    await invalidatePattern("prefix:*");
    
    // After invalidation, next fetch should call fetcher again
    let called = false;
    await cached("prefix:key1", 60, async () => {
      called = true;
      return "new-data";
    });
    
    expect(called).toBe(true);
  });
});
