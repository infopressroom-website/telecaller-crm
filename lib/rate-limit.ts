/**
 * Rate limiting utilities for API endpoints
 * Prevents brute force attacks and abuse
 * 
 * In-memory implementation using Map with sliding window
 * For production, consider Redis-based rate limiting
 */

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const store = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter with sliding window
 * @param key - Unique identifier for the rate limit (e.g., "login:ip:127.0.0.1")
 * @param limit - Maximum number of attempts allowed in the window
 * @param windowMs - Time window in milliseconds
 * @param now - Optional timestamp for testing (defaults to Date.now())
 * @returns {ok: boolean, retryAfterSec?: number}
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): { ok: boolean; retryAfterSec?: number } {
  const entry = store.get(key);
  
  // No entry yet or window has expired - allow and start new window
  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }
  
  // Within window - check if under limit
  if (entry.count < limit) {
    entry.count++;
    return { ok: true };
  }
  
  // Over limit - calculate retry time
  const windowEnd = entry.windowStart + windowMs;
  const retryAfterSec = Math.ceil((windowEnd - now) / 1000);
  
  return { ok: false, retryAfterSec };
}

/**
 * Reset all rate limits (for testing only)
 */
export function resetRateLimits(): void {
  store.clear();
}

/**
 * Helper to get a unique identifier for rate limiting
 * Uses IP address or user ID
 */
export function getRateLimitIdentifier(
  request: Request,
  userId?: string
): string {
  // Prefer user ID if authenticated
  if (userId) return `user:${userId}`;

  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : 
    request.headers.get("x-real-ip") || "unknown";

  return `ip:${ip}`;
}
