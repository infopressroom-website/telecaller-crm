import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

// Used by load balancers and Docker health checks. Reveals nothing sensitive.
export const GET = route(async () => {
  const t = Date.now();
  await db.$queryRaw`SELECT 1`;
  return ok({ status: "ok", database: "reachable", dbLatencyMs: Date.now() - t, version: process.env.APP_VERSION ?? "dev", time: new Date().toISOString() });
});
