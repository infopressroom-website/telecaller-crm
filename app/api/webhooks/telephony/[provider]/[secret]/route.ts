import { constantTimeEqual, ipAllowed, verifyHmac } from "@/lib/telephony/security";
import { parseExotelWebhook, WebhookParseError } from "@/lib/telephony/exotel-parse";
import { ingestWebhook } from "@/services/call-service";
import { getTelephonySettings } from "@/services/telephony-settings-service";

export const dynamic = "force-dynamic";
const MAX_BYTES = 100_000;
const plain = (status: number, text = "") => new Response(text, { status });

/**
 * Provider → CRM call events.
 * Layers: (1) a secret in the URL path, compared in constant time; (2) optional IP allow-list; (3) optional HMAC
 * signature (off by default until the exact scheme is confirmed with the provider); (4) strict payload parsing;
 * (5) the event is stored before it is processed, and identical replays are acknowledged and ignored.
 * Nothing about WHY a request was refused is revealed to the caller.
 */
export async function POST(req: Request, { params }: { params: { provider: string; secret: string } }) {
  if (params.provider !== "exotel") return plain(404);
  const expected = process.env.EXOTEL_WEBHOOK_SECRET ?? "";
  if (expected.length < 24 || !constantTimeEqual(params.secret, expected)) return plain(404);

  try {
    const settings = await getTelephonySettings();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
    if (!ipAllowed(ip, settings.allowedIps)) return plain(403);

    if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return plain(413);
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return plain(413);

    if (settings.signatureEnabled && !verifyHmac(raw, req.headers.get(settings.signatureHeader), process.env.EXOTEL_API_TOKEN ?? "", settings.signatureEncoding)) return plain(401);

    const contentType = req.headers.get("content-type") ?? "";
    let event;
    try {
      event = parseExotelWebhook(raw, contentType, settings.utcOffsetMinutes);
    } catch (e) {
      if (e instanceof WebhookParseError) return plain(400, "Bad payload");
      throw e;
    }
    const r = await ingestWebhook(event, { contentType, body: raw.slice(0, 20_000) });
    return Response.json({ ok: true, duplicate: r.duplicate });
  } catch (e) {
    console.error("Telephony webhook error", e instanceof Error ? e.message : "unknown");
    return plain(500); // storing the event failed: a 5xx lets the provider retry
  }
}
