import { constantTimeEqual } from "@/lib/telephony/security";
import { log } from "@/lib/logger";
import { runTick } from "@/services/automation-service";

export const dynamic = "force-dynamic";

/**
 * Scheduler entry point. Call it every minute from any scheduler (system cron, hosting platform cron, uptime pinger):
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/automation
 * It is idempotent: running twice, or two schedulers at once, cannot send the same notification twice.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length < 24 || !constantTimeEqual(given, secret)) return new Response("Not found", { status: 404 });
  try {
    const r = await runTick();
    return Response.json({ ok: true, rules: r.rules.map(({ name, matches, processed, skipped, failed }) => ({ name, matches, processed, skipped, failed })), missedFollowUps: r.missedFollowUps });
  } catch (e) {
    log.error("Cron tick failed", e);
    return new Response("Error", { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
