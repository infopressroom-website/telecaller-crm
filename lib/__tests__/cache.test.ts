/**
 * Tests for caching utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cached, invalidate, CacheKeys, CacheTTL } from '../cache';
import * as redis from '../redis';

// Mock Redis module
vi.mock('../redis', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
  cacheDelPattern: vi.fn(),
}));

describe('Cache utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('cached', () => {
    it('should call fetcher and cache result on cache miss', async () => {
      const mockData = { id: '1', name: 'Test' };
      const fetcher = vi.fn().mockResolvedValue(mockData);
      
      vi.mocked(redis.cacheGet).mockResolvedValue(null);
      vi.mocked(redis.cacheSet).mockResolvedValue(true);
      
      const result = await cached('test-key', 300, fetcher);
      
      expect(fetcher).toHaveBeenCalledOnce();
      expect(redis.cacheGet).toHaveBeenCalledWith('test-key');
      expect(redis.cacheSet).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(mockData),
        300
      );
      expect(result).toEqual(mockData);
    });
    
    it('should return cached data without calling fetcher on cache hit', async () => {
      const mockData = { id: '1', name: 'Cached' };
      const fetcher = vi.fn().mockResolvedValue({ id: '2', name: 'Fresh' });
      
      vi.mocked(redis.cacheGet).mockResolvedValue(JSON.stringify(mockData));
      
      const result = await cached('test-key', 300, fetcher);
      
      expect(fetcher).not.toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });
    
    it('should handle cache serialization errors gracefully', async () => {
      const fetcher = vi.fn().mockResolvedValue({ id: '1' });
      
      vi.mocked(redis.cacheGet).mockResolvedValue('invalid-json');
      vi.mocked(redis.cacheDel).mockResolvedValue(true);
      
      const result = await cached('test-key', 300, fetcher);
      
      expect(redis.cacheDel).toHaveBeenCalledWith('test-key');
      expect(fetcher).toHaveBeenCalledOnce();
    });
  });
  
  describe('invalidate', () => {
    it('should delete cache key', async () => {
      vi.mocked(redis.cacheDel).mockResolvedValue(true);
      
      await invalidate('test-key');
      
      expect(redis.cacheDel).toHaveBeenCalledWith('test-key');
    });
  });
  
  describe('CacheKeys', () => {
    it('should generate correct cache keys', () => {
      expect(CacheKeys.dashboardMetrics('user-123')).toBe('dashboard:metrics:user-123');
      expect(CacheKeys.leadDetails('lead-456')).toBe('leads:lead-456');
      expect(CacheKeys.user('user-789')).toBe('user:user-789');
    });
  });
  
  describe('CacheTTL', () => {
    it('should have correct TTL values', () => {
      expect(CacheTTL.SHORT).toBe(60);
      expect(CacheTTL.MEDIUM).toBe(300);
      expect(CacheTTL.LONG).toBe(3600);
      expect(CacheTTL.DASHBOARD).toBe(300);
    });
  });
});
