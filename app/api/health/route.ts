/**
 * Health check endpoint
 * Returns application status and optional service availability
 */

import { NextResponse } from "next/server";
import { isRedisAvailable } from "@/lib/redis";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  
  // Check database connectivity
  let dbStatus = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }
  
  const responseTime = Date.now() - start;
  
  return NextResponse.json({
    status: dbStatus === "ok" ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: isRedisAvailable() ? "connected" : "unavailable",
    },
    responseTime: `${responseTime}ms`,
  });
}
