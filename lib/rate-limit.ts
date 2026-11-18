/**
 * Rate limiting utilities for API endpoints
 * Prevents brute force attacks and abuse
 */

import { LRUCache } from "lru-cache";

type RateLimitOptions = {
  uniqueTokenPerInterval?: number;
  interval?: number;
  maxAttempts?: number;
};

/**
 * In-memory rate limiter using LRU cache
 * For production, consider Redis-based rate limiting
 */
export function rateLimit(options?: RateLimitOptions) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000, // 1 minute default
  });

  return {
    check: (limit: number, token: string): { success: boolean; remaining: number; reset: number } => {
      const tokenCount = (tokenCache.get(token) as number[]) || [0];
      if (tokenCount[0] === 0) {
        tokenCache.set(token, tokenCount);
      }
      tokenCount[0] += 1;

      const currentUsage = tokenCount[0];
      const isRateLimited = currentUsage > limit;
      const remaining = Math.max(0, limit - currentUsage);
      const reset = Date.now() + (options?.interval || 60000);

      return {
        success: !isRateLimited,
        remaining,
        reset,
      };
    },
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Authentication endpoints: 5 attempts per minute per IP
export const authRateLimit = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
  maxAttempts: 5,
});

// General API endpoints: 100 requests per minute per user/IP
export const apiRateLimit = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
  maxAttempts: 100,
});

// Strict rate limit for password reset: 3 attempts per hour per IP
export const passwordResetRateLimit = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 1000,
  maxAttempts: 3,
});

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

/**
 * Middleware helper for Next.js API routes
 */
export async function withRateLimit<T>(
  request: Request,
  identifier: string,
  limiter: ReturnType<typeof rateLimit>,
  limit: number,
  handler: () => Promise<T>
): Promise<Response | T> {
  const result = limiter.check(limit, identifier);

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please try again later.",
        retryAfter: new Date(result.reset).toISOString(),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": result.reset.toString(),
          "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // Add rate limit headers to successful responses
  const response = await handler();
  
  if (response instanceof Response) {
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.reset.toString());
  }

  return response;
}
