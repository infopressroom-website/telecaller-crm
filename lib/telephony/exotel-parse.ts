import type { NormalizedCallEvent, ProviderCallStatus } from "./provider";

// Parses Exotel StatusCallback payloads (JSON or form-encoded) per Exotel's public documentation.
// ASSUMPTIONS TO CONFIRM against a real account: the timezone of Exotel's timestamps (default IST, configurable)
// and exactly which extra fields arrive for your account's call flow. See docs/TELEPHONY.md.

export class WebhookParseError extends Error {}

const text = (v: unknown, max = 200): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s.slice(0, max) : undefined;
};

export function normalizeStatus(v: unknown): { status: ProviderCallStatus; raw: string } {
  const raw = text(v, 40) ?? "";
  const s = raw.toLowerCase().replace(/_/g, "-").replace("cancelled", "canceled");
  const known: ProviderCallStatus[] = ["in-progress", "completed", "failed", "busy", "no-answer", "canceled"];
  return { status: (known as string[]).includes(s) ? (s as ProviderCallStatus) : "unknown", raw };
}

/** "YYYY-MM-DD HH:mm:ss" in the provider's local time (offset minutes from UTC), or an ISO string. */
export function parseProviderTime(v: unknown, utcOffsetMinutes: number): Date | undefined {
  const s = text(v, 40);
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(s);
  const d = m
    ? new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!) - utcOffsetMinutes * 60_000)
    : new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const seconds = (v: unknown): number | undefined => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 86_400) : undefined;
};

const safeUrl = (v: unknown): string | undefined => {
  const s = text(v, 2000);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : undefined; // never store javascript:, data: or plain-http links
  } catch {
    return undefined;
  }
};

function flatten(raw: string, contentType: string): Record<string, unknown> {
  try {
    if (contentType.toLowerCase().includes("json") || raw.trimStart().startsWith("{")) {
      const j = JSON.parse(raw);
      if (j && typeof j === "object" && !Array.isArray(j)) return j as Record<string, unknown>;
      throw new Error("not an object");
    }
    return Object.fromEntries(new URLSearchParams(raw));
  } catch {
    throw new WebhookParseError("Unreadable webhook body");
  }
}

export function parseExotelWebhook(raw: string, contentType: string, utcOffsetMinutes = 330, now = new Date()): NormalizedCallEvent {
  const f = flatten(raw, contentType);
  const callSid = text(f.CallSid, 100);
  if (!callSid || !/^[A-Za-z0-9_-]+$/.test(callSid)) throw new WebhookParseError("Missing or invalid CallSid");

  const { status, raw: rawStatus } = normalizeStatus(f.Status);
  const eventType = text(f.EventType, 30) ?? "";
  const updated = text(f.DateUpdated, 40) ?? text(f.EndTime, 40) ?? "";
  const talk = seconds(f.ConversationDuration);
  const total = seconds(f.Duration);

  return {
    provider: "exotel",
    providerCallId: callSid,
    customField: text(f.CustomField, 128),
    status,
    rawStatus,
    direction: String(f.Direction ?? "").toLowerCase().startsWith("inbound") ? "INBOUND" : "OUTBOUND",
    from: text(f.From ?? f.CallFrom, 30),
    to: text(f.To ?? f.CallTo, 30),
    startedAt: parseProviderTime(f.StartTime, utcOffsetMinutes),
    endedAt: parseProviderTime(f.EndTime, utcOffsetMinutes),
    durationSec: talk ?? total,
    recordingUrl: safeUrl(f.RecordingUrl),
    occurredAt: parseProviderTime(f.DateUpdated ?? f.EndTime, utcOffsetMinutes) ?? now,
    dedupeKey: `exotel:${callSid}:${status}:${eventType}:${updated}`,
  };
}

/** Parses the Call object returned by Exotel's Call Details API (JSON or the XML fallback). */
export function parseExotelCallDetails(body: string, utcOffsetMinutes = 330, now = new Date()): NormalizedCallEvent | null {
  const trimmed = body.trim();
  let f: Record<string, unknown> | null = null;
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed) as Record<string, unknown>;
      f = (j.Call ?? j.call ?? j) as Record<string, unknown>;
    } catch { return null; }
  } else if (trimmed.startsWith("<")) {
    const tag = (n: string) => new RegExp(`<${n}>([^<]*)</${n}>`).exec(trimmed)?.[1];
    f = { Sid: tag("Sid"), Status: tag("Status"), StartTime: tag("StartTime"), EndTime: tag("EndTime"), Duration: tag("Duration"), Direction: tag("Direction"), RecordingUrl: tag("RecordingUrl") };
  }
  if (!f) return null;
  const sid = text(f.Sid ?? f.CallSid, 100);
  if (!sid) return null;
  const { status, raw } = normalizeStatus(f.Status);
  return {
    provider: "exotel", providerCallId: sid, status, rawStatus: raw,
    direction: String(f.Direction ?? "").toLowerCase().startsWith("inbound") ? "INBOUND" : "OUTBOUND",
    startedAt: parseProviderTime(f.StartTime, utcOffsetMinutes), endedAt: parseProviderTime(f.EndTime, utcOffsetMinutes),
    durationSec: seconds(f.ConversationDuration) ?? seconds(f.Duration), recordingUrl: safeUrl(f.RecordingUrl),
    occurredAt: parseProviderTime(f.EndTime, utcOffsetMinutes) ?? now,
    dedupeKey: `exotel:${sid}:${status}:details:${text(f.EndTime, 40) ?? ""}`,
  };
}
