import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { callScopeWhere } from "@/lib/auth/scope";
import { buildCallWhere } from "@/lib/calls/query";
import { telephonyFormSchema, telephonySettingsSchema } from "@/lib/telephony/config";
import { normalizeStatus, parseExotelCallDetails, parseExotelWebhook, parseProviderTime, WebhookParseError } from "@/lib/telephony/exotel-parse";
import { constantTimeEqual, ipAllowed, verifyHmac } from "@/lib/telephony/security";
import { isProviderFinal, isTerminal, shouldApplyStatus, toCallStatus } from "@/lib/telephony/status";
import { nextLeadStatus, requiresFollowUp } from "@/lib/workspace/status";
import { dispositionSchema } from "@/services/disposition-schema";
import { parseCallListQuery } from "@/validations/calls";

const JSON_BODY = JSON.stringify({
  CallSid: "abc123", Status: "completed", DateUpdated: "2026-10-31 15:30:45", StartTime: "2026-10-31 15:25:00", EndTime: "2026-10-31 15:30:45",
  Duration: "345", ConversationDuration: "320", Direction: "outbound-api", From: "+919876543210", To: "+919123456789", CustomField: "call_1",
  RecordingUrl: "https://recordings.example.com/abc.mp3", EventType: "terminal",
});
const NOW = new Date("2026-10-31T12:00:00Z");

describe("parseExotelWebhook", () => {
  it("parses a JSON terminal event", () => {
    const e = parseExotelWebhook(JSON_BODY, "application/json", 330, NOW);
    expect(e).toMatchObject({ provider: "exotel", providerCallId: "abc123", status: "completed", customField: "call_1", direction: "OUTBOUND", durationSec: 320 });
    expect(e.startedAt?.toISOString()).toBe("2026-10-31T09:55:00.000Z"); // 15:25 India time
    expect(e.endedAt?.toISOString()).toBe("2026-10-31T10:00:45.000Z");
    expect(e.recordingUrl).toBe("https://recordings.example.com/abc.mp3");
  });
  it("parses the same event when form-encoded", () => {
    const form = new URLSearchParams(Object.entries(JSON.parse(JSON_BODY) as Record<string, string>)).toString();
    const e = parseExotelWebhook(form, "application/x-www-form-urlencoded", 330, NOW);
    expect(e.providerCallId).toBe("abc123");
    expect(e.status).toBe("completed");
  });
  it("gives identical replays identical dedupe keys, and different events different ones", () => {
    const a = parseExotelWebhook(JSON_BODY, "application/json", 330, NOW);
    const b = parseExotelWebhook(JSON_BODY, "application/json", 330, new Date());
    const c = parseExotelWebhook(JSON_BODY.replace("completed", "failed"), "application/json", 330, NOW);
    expect(a.dedupeKey).toBe(b.dedupeKey);
    expect(a.dedupeKey).not.toBe(c.dedupeKey);
  });
  it("prefers talk time but falls back to total duration, and ignores nonsense", () => {
    const noTalk = parseExotelWebhook(JSON.stringify({ CallSid: "x1", Status: "completed", Duration: "45" }), "application/json");
    expect(noTalk.durationSec).toBe(45);
    expect(parseExotelWebhook(JSON.stringify({ CallSid: "x2", Status: "completed", Duration: "-5" }), "application/json").durationSec).toBeUndefined();
  });
  it("only keeps https recording links", () => {
    for (const url of ["http://x.com/a.mp3", "javascript:alert(1)", "data:text/html,hi", "not a url"]) {
      expect(parseExotelWebhook(JSON.stringify({ CallSid: "x3", Status: "completed", RecordingUrl: url }), "application/json").recordingUrl).toBeUndefined();
    }
  });
  it("detects inbound calls and reads CallFrom", () => {
    const e = parseExotelWebhook(JSON.stringify({ CallSid: "in1", Status: "completed", Direction: "inbound", CallFrom: "+919000000011" }), "application/json");
    expect(e.direction).toBe("INBOUND");
    expect(e.from).toBe("+919000000011");
  });
  it("rejects payloads without a safe CallSid or a readable body", () => {
    expect(() => parseExotelWebhook("{}", "application/json")).toThrow(WebhookParseError);
    expect(() => parseExotelWebhook(JSON.stringify({ CallSid: "a b;DROP" }), "application/json")).toThrow(WebhookParseError);
    expect(() => parseExotelWebhook("{broken", "application/json")).toThrow(WebhookParseError);
    expect(() => parseExotelWebhook("[1,2]", "application/json")).toThrow(WebhookParseError);
  });
});

describe("status handling", () => {
  it("normalises provider status text", () => {
    expect(normalizeStatus("no_answer").status).toBe("no-answer");
    expect(normalizeStatus("Cancelled").status).toBe("canceled");
    expect(normalizeStatus("weird").status).toBe("unknown");
    expect(normalizeStatus(undefined).status).toBe("unknown");
  });
  it("maps to call statuses", () => {
    expect(toCallStatus("no-answer")).toBe("NOT_ANSWERED");
    expect(toCallStatus("in-progress")).toBe("IN_PROGRESS");
    expect(toCallStatus("unknown")).toBeNull();
    expect(isTerminal("BUSY")).toBe(true);
    expect(isTerminal("RINGING")).toBe(false);
  });
  it("never lets a call go backwards", () => {
    expect(shouldApplyStatus("INITIATED", "RINGING", false)).toBe(true);
    expect(shouldApplyStatus("RINGING", "COMPLETED", false)).toBe(true);
    expect(shouldApplyStatus("COMPLETED", "IN_PROGRESS", false)).toBe(false);
    expect(shouldApplyStatus("IN_PROGRESS", "RINGING", false)).toBe(false);
  });
  it("the first provider-reported final status beats an agent-guessed one, and later ones don't flip it", () => {
    expect(shouldApplyStatus("COMPLETED", "NOT_ANSWERED", false)).toBe(true);
    expect(shouldApplyStatus("NOT_ANSWERED", "COMPLETED", true)).toBe(false);
  });
  it("recognises the provider's own final statuses", () => {
    expect(isProviderFinal("no-answer")).toBe(true);
    expect(isProviderFinal("Completed")).toBe(true);
    expect(isProviderFinal("in-progress")).toBe(false);
    expect(isProviderFinal(null)).toBe(false);
  });
});

describe("provider timestamps", () => {
  it("applies the configured offset", () => {
    expect(parseProviderTime("2026-01-01 05:30:00", 330)?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(parseProviderTime("2026-01-01 05:30:00", 0)?.toISOString()).toBe("2026-01-01T05:30:00.000Z");
    expect(parseProviderTime("garbage", 330)).toBeUndefined();
    expect(parseProviderTime("", 330)).toBeUndefined();
  });
});

describe("parseExotelCallDetails", () => {
  it("reads JSON and XML responses", () => {
    expect(parseExotelCallDetails(JSON.stringify({ Call: { Sid: "s1", Status: "completed", Duration: "10", Direction: "outbound-api" } }))?.providerCallId).toBe("s1");
    expect(parseExotelCallDetails("<TwilioResponse><Call><Sid>s2</Sid><Status>busy</Status></Call></TwilioResponse>")).toMatchObject({ providerCallId: "s2", status: "busy" });
  });
  it("returns null when there is no call ID", () => {
    expect(parseExotelCallDetails("{}")).toBeNull();
    expect(parseExotelCallDetails("nope")).toBeNull();
  });
});

describe("webhook security helpers", () => {
  it("compares secrets in constant time and rejects length mismatches", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
  it("IP allow-list", () => {
    expect(ipAllowed(null, [])).toBe(true);
    expect(ipAllowed(null, ["1.2.3.4"])).toBe(false);
    expect(ipAllowed("1.2.3.4", ["1.2.3.4"])).toBe(true);
    expect(ipAllowed("::ffff:1.2.3.4", ["1.2.3.4"])).toBe(true);
    expect(ipAllowed("203.0.113.77", ["203.0.113.0/24"])).toBe(true);
    expect(ipAllowed("203.0.114.1", ["203.0.113.0/24"])).toBe(false);
    expect(ipAllowed("9.9.9.9", ["0.0.0.0/0"])).toBe(true);
    expect(ipAllowed("1.2.3.4", ["garbage/99"])).toBe(false);
  });
  it("verifies HMAC signatures in both encodings", () => {
    const body = '{"CallSid":"x"}';
    expect(verifyHmac(body, createHmac("sha256", "tok").update(body).digest("base64"), "tok", "base64")).toBe(true);
    expect(verifyHmac(body, createHmac("sha256", "tok").update(body).digest("hex"), "tok", "hex")).toBe(true);
    expect(verifyHmac(body, "wrong", "tok", "base64")).toBe(false);
    expect(verifyHmac(body, null, "tok", "base64")).toBe(false);
    expect(verifyHmac(body, createHmac("sha256", "tok").update("other").digest("base64"), "tok", "base64")).toBe(false);
  });
});

describe("telephony settings", () => {
  it("falls back to safe defaults when stored data is missing or corrupt", () => {
    expect(telephonySettingsSchema.parse({})).toMatchObject({ provider: "none", record: true, signatureEnabled: false, utcOffsetMinutes: 330 });
    expect(telephonySettingsSchema.parse({ provider: "evil" }).provider).toBe("none");
  });
  it("the form schema is strict", () => {
    const ok = { provider: "exotel", region: "mumbai", callerId: "08012345678", record: true, allowedIps: ["203.0.113.0/24"], signatureEnabled: false, signatureHeader: "X-Exotel-Signature", signatureEncoding: "base64", utcOffsetMinutes: "330" };
    expect(telephonyFormSchema.safeParse(ok).success).toBe(true);
    expect(telephonyFormSchema.safeParse({ ...ok, callerId: "call me" }).success).toBe(false);
    expect(telephonyFormSchema.safeParse({ ...ok, allowedIps: ["<script>"] }).success).toBe(false);
    expect(telephonyFormSchema.safeParse({ ...ok, provider: "other" }).success).toBe(false);
  });
});

describe("call history filters", () => {
  it("falls back on junk input", () => {
    const q = parseCallListQuery({ status: "BOGUS", direction: "SIDEWAYS", disposition: "bad key!", page: "0", from: "yesterday" });
    expect([q.status, q.direction, q.disposition, q.from]).toEqual([undefined, undefined, undefined, undefined]);
    expect(q.page).toBe(1);
  });
  it("starts from the role scope and only narrows it", () => {
    const own = { kind: "OWN", userId: "u1" } as const;
    const w = buildCallWhere(own, parseCallListQuery({ disposition: "INTERESTED", direction: "INBOUND" })) as { AND: unknown[] };
    expect(w.AND[0]).toEqual(callScopeWhere(own));
    expect(JSON.stringify(w)).toContain("INTERESTED");
  });
  it("includes the whole 'to' day in India time", () => {
    expect(JSON.stringify(buildCallWhere({ kind: "ALL" }, parseCallListQuery({ to: "2026-10-05" })))).toContain("2026-10-05T18:30:00.000Z");
  });
});

describe("configurable outcomes", () => {
  it("a custom outcome can name the status it sets", () => {
    expect(nextLeadStatus("ASSIGNED", "SEND_BROCHURE", "INTERESTED")).toBe("INTERESTED");
    expect(nextLeadStatus("INTERESTED", "REFUSED_OFFER", "LOST")).toBe("LOST");
    expect(nextLeadStatus("ASSIGNED", "NO_OVERRIDE", null)).toBeNull();
    expect(nextLeadStatus("ASSIGNED", "NOT_ANSWERED", null)).toBe("ATTEMPTED");
  });
  it("requires a follow-up for callbacks and for outcomes flagged by an admin", () => {
    expect(requiresFollowUp({ key: "CALLBACK_REQUESTED" })).toBe(true);
    expect(requiresFollowUp({ key: "SEND_QUOTE", requiresFollowUp: true })).toBe(true);
    expect(requiresFollowUp({ key: "BUSY", requiresFollowUp: false })).toBe(false);
  });
  it("validates outcome keys and names", () => {
    expect(dispositionSchema.parse({ key: "send_brochure", label: "Send brochure" }).key).toBe("SEND_BROCHURE");
    expect(dispositionSchema.safeParse({ key: "1bad", label: "Bad" }).success).toBe(false);
    expect(dispositionSchema.safeParse({ key: "OK_KEY", label: "x" }).success).toBe(false);
  });
});
