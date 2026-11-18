import "server-only";
import { Prisma, type CallStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, can, type AuthUser } from "@/lib/auth/rbac";
import { callScopeWhere } from "@/lib/auth/scope";
import { AppError, notFound } from "@/lib/errors";
import { buildCallWhere } from "@/lib/calls/query";
import { toE164 } from "@/lib/telephony/config";
import { ProviderError, type NormalizedCallEvent } from "@/lib/telephony/provider";
import { type ResolvedTelephony } from "@/lib/telephony/registry";
import { isProviderFinal, shouldApplyStatus, toCallStatus } from "@/lib/telephony/status";
import { pageMeta, toPrismaPage } from "@/lib/pagination";
import { normalizeMobile } from "@/validations/common";
import type { CallListQuery } from "@/validations/calls";
import { updateLeadScore } from "@/lib/lead-scoring-trigger";
import { audit } from "./audit-service";
import { getAccessibleLead, resolveScope } from "./scope-service";
import { getActiveTelephony, getTelephonySettings, statusCallbackUrl } from "./telephony-settings-service";

const OPEN: CallStatus[] = ["INITIATED", "RINGING", "IN_PROGRESS"];

/** Recordings are sensitive: only quality/oversight roles may open them. */
export const canViewRecordings = (user: AuthUser) => can(user, "qa", "VIEW") || can(user, "call", "MANAGE");

// ───────────── history ─────────────

export async function listCalls(user: AuthUser, q: CallListQuery) {
  assertCan(user, "call", "VIEW");
  const scope = await resolveScope(user);
  const where = buildCallWhere(scope, q);
  const [total, rows] = await Promise.all([
    db.callLog.count({ where }),
    db.callLog.findMany({
      where, orderBy: { createdAt: "desc" }, ...toPrismaPage(q),
      select: {
        id: true, createdAt: true, startedAt: true, durationSec: true, direction: true, status: true, externalStatus: true, providerName: true,
        lead: { select: { id: true, name: true, leadCode: true } }, agent: { select: { name: true, team: { select: { name: true } } } },
        disposition: { select: { label: true } }, recording: { select: { id: true } },
      },
    }),
  ]);
  return { rows, total, meta: pageMeta(total, q) };
}

export async function getCallFilterOptions(user: AuthUser) {
  const scope = await resolveScope(user);
  const [dispositions, agents, teams] = await Promise.all([
    db.callDisposition.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, label: true } }),
    scope.kind === "ALL" || scope.kind === "TEAMS"
      ? db.user.findMany({ where: { role: { key: { in: ["TELECALLER", "TEAM_LEADER"] } }, ...(scope.kind === "TEAMS" ? { OR: [{ id: user.id }, { teamId: { in: scope.teamIds } }] } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 })
      : Promise.resolve([]),
    scope.kind === "ALL" || scope.kind === "TEAMS"
      ? db.team.findMany({ where: { archivedAt: null, ...(scope.kind === "TEAMS" ? { id: { in: scope.teamIds } } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  return { dispositions, agents, teams };
}

export async function getCall(user: AuthUser, id: string) {
  assertCan(user, "call", "VIEW");
  const scope = await resolveScope(user);
  const call = await db.callLog.findFirst({
    where: { AND: [{ id }, callScopeWhere(scope)] },
    include: {
      lead: { select: { id: true, name: true, leadCode: true, primaryMobile: true } }, agent: { select: { name: true, team: { select: { name: true } } } },
      disposition: { select: { label: true } }, recording: true,
    },
  });
  if (!call) throw notFound("Call");
  const events = can(user, "settings", "MANAGE")
    ? await db.callEvent.findMany({ where: { callId: id }, orderBy: { receivedAt: "asc" }, take: 50, select: { id: true, eventType: true, status: true, note: true, receivedAt: true } })
    : [];
  return { call, events, canPlayRecording: canViewRecordings(user) && !!call.recording?.providerUrl };
}

/** Returns the recording link after checking permission and scope. Every access is audited. */
export async function recordingUrlFor(user: AuthUser, id: string, ip: string | null): Promise<string> {
  assertCan(user, "call", "VIEW");
  if (!canViewRecordings(user)) throw new AppError("FORBIDDEN", "You do not have permission to listen to recordings.");
  const { call } = await getCall(user, id);
  const url = call.recording?.providerUrl;
  if (!url) throw notFound("Recording");
  await audit({ actorId: user.id, action: "call.recording_access", entityType: "CallLog", entityId: id, ipAddress: ip });
  return url;
}

// ───────────── click-to-call ─────────────

/**
 * Places a call through the provider: the agent's phone rings first, then the customer is connected.
 * The CallLog row is created BEFORE dialling, keyed by the browser's callRef, so a double click or retry can never
 * dial twice. Our CallLog id travels to the provider as CustomField and comes back on every webhook.
 */
export async function startProviderCall(user: AuthUser, leadId: string, callRef: string, t: ResolvedTelephony) {
  if (!t.provider || t.mode === "manual") throw new AppError("INTERNAL_ERROR", "Calling isn't available.");
  assertCan(user, "call", "CREATE");
  const lead = await getAccessibleLead(user, leadId);
  if (lead.status === "DND") throw new AppError("CONFLICT", "This customer is marked Do Not Disturb. Ask a manager to review before calling.");

  const find = () => db.callLog.findUnique({ where: { clientRef: callRef } });
  const shape = (c: NonNullable<Awaited<ReturnType<typeof find>>>) => {
    if (c.agentId !== user.id || c.leadId !== leadId) throw notFound("Call");
    return { mode: t.mode, startedAt: (c.startedAt ?? c.createdAt).toISOString(), callId: c.id };
  };
  const existing = await find();
  if (existing) return shape(existing);

  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true } });
  if (!me.phone) throw new AppError("VALIDATION_ERROR", "Your phone number isn't set, so the system can't ring you. Ask an administrator to add it in Settings → Telephony.");
  const settings = await getTelephonySettings();

  let call;
  try {
    call = await db.callLog.create({ data: { leadId, agentId: user.id, direction: "OUTBOUND", status: "INITIATED", providerName: t.provider.key, clientRef: callRef, startedAt: new Date() } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return shape((await find())!);
    throw e;
  }

  try {
    const placed = await t.provider.placeCall({
      agentNumber: toE164(me.phone), customerNumber: toE164(lead.primaryMobile), callerId: settings.callerId, record: settings.record, customField: call.id,
      statusCallbackUrl: t.mode === "sandbox" ? "sandbox://none" : statusCallbackUrl(),
    });
    await db.callLog.update({ where: { id: call.id }, data: { providerCallId: placed.providerCallId, status: "RINGING" } });
    return { mode: t.mode, startedAt: call.startedAt!.toISOString(), callId: call.id };
  } catch (e) {
    const unsure = e instanceof ProviderError && e.kind === "unreachable";
    // "Unreachable" is ambiguous: the provider may or may not have placed the call. Keep the record open and say so.
    await db.callLog.update({ where: { id: call.id }, data: { status: unsure ? "INITIATED" : "FAILED", externalStatus: unsure ? "dial_result_unknown" : "dial_rejected" } });
    await db.callEvent.create({ data: { provider: t.provider.key, eventType: "dial_failed", dedupeKey: `dial:${call.id}`, raw: { error: e instanceof Error ? e.message : "unknown" }, status: "IGNORED", note: e instanceof Error ? e.message.slice(0, 300) : "unknown", callId: call.id, processedAt: new Date() } });
    if (e instanceof ProviderError) {
      throw new AppError("CONFLICT", unsure ? `${e.message} We can't tell whether the call was placed, so check your phone before trying again.` : `Couldn't place the call: ${e.message}`);
    }
    throw e;
  }
}

// ───────────── webhooks: store first, then process ─────────────

const toJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
function revive(j: unknown): NormalizedCallEvent {
  const e = j as Record<string, unknown>;
  const d = (v: unknown) => (typeof v === "string" ? new Date(v) : undefined);
  return { ...(e as unknown as NormalizedCallEvent), startedAt: d(e.startedAt), endedAt: d(e.endedAt), occurredAt: d(e.occurredAt) ?? new Date() };
}

/** Durably records the event, then applies it. Replays of the same event are acknowledged and ignored. */
export async function ingestWebhook(event: NormalizedCallEvent, raw: unknown): Promise<{ duplicate: boolean }> {
  let row;
  try {
    row = await db.callEvent.create({ data: { provider: event.provider, providerCallId: event.providerCallId, eventType: event.status, dedupeKey: event.dedupeKey, raw: toJson(raw), normalized: toJson(event) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { duplicate: true };
    throw e; // the database is the problem: let the provider retry
  }
  await processEvent(row.id);
  return { duplicate: false };
}

export async function processEvent(id: string) {
  const row = await db.callEvent.findUnique({ where: { id } });
  if (!row || row.status === "PROCESSED" || row.status === "IGNORED" || !row.normalized) return;
  try {
    const r = await applyEvent(revive(row.normalized));
    await db.callEvent.update({ where: { id }, data: { status: r.outcome === "processed" ? "PROCESSED" : "IGNORED", note: r.note ?? null, callId: r.callId ?? null, processedAt: new Date(), attempts: { increment: 1 } } });
    
    // Auto-recalculate lead score after call is processed
    if (r.outcome === "processed" && r.callId) {
      const call = await db.callLog.findUnique({ where: { id: r.callId }, select: { leadId: true } });
      if (call?.leadId) {
        updateLeadScore(call.leadId).catch(console.error);
      }
    }
  } catch (e) {
    console.error("Webhook processing failed", e);
    await db.callEvent.update({ where: { id }, data: { status: "FAILED", note: (e instanceof Error ? e.message : "error").slice(0, 300), attempts: { increment: 1 } } });
  }
}

type Applied = { outcome: "processed" | "ignored"; callId?: string; note?: string };

async function applyEvent(ev: NormalizedCallEvent): Promise<Applied> {
  return db.$transaction(async (tx) => {
    let call = await tx.callLog.findUnique({ where: { providerName_providerCallId: { providerName: ev.provider, providerCallId: ev.providerCallId } } });
    if (!call && ev.customField) call = await tx.callLog.findFirst({ where: { id: ev.customField, providerName: ev.provider } }); // webhook beat the dial response

    if (!call) {
      if (ev.direction === "INBOUND") return createInbound(tx, ev);
      return { outcome: "ignored", note: ev.customField?.startsWith("test:") ? "Integration test call" : "No matching call in the CRM" };
    }

    const incoming = toCallStatus(ev.status);
    const applyStatus = !!incoming && shouldApplyStatus(call.status, incoming, isProviderFinal(call.externalStatus));
    const data: Prisma.CallLogUpdateInput = {};
    if (!call.providerCallId) data.providerCallId = ev.providerCallId;
    if (applyStatus && incoming) {
      data.status = incoming;
      data.externalStatus = ev.rawStatus;
      if (ev.endedAt) data.endedAt = ev.endedAt;
      if (ev.durationSec !== undefined) data.durationSec = ev.durationSec;
    } else {
      if (ev.durationSec !== undefined && call.durationSec === null) data.durationSec = ev.durationSec; // fill blanks only
      if (ev.endedAt && !call.endedAt) data.endedAt = ev.endedAt;
    }
    if (Object.keys(data).length) await tx.callLog.update({ where: { id: call.id }, data });
    if (ev.recordingUrl) {
      await tx.recording.upsert({ where: { callId: call.id }, create: { callId: call.id, providerUrl: ev.recordingUrl, durationSec: ev.durationSec ?? null }, update: { providerUrl: ev.recordingUrl, durationSec: ev.durationSec ?? undefined } });
    }
    return { outcome: "processed", callId: call.id };
  });
}

async function createInbound(tx: Prisma.TransactionClient, ev: NormalizedCallEvent): Promise<Applied> {
  const number = ev.from ? normalizeMobile(ev.from) : null;
  if (!number) return { outcome: "ignored", note: "Inbound call without a caller number" };
  const lead = await tx.lead.findFirst({ where: { archivedAt: null, OR: [{ primaryMobile: number }, { alternateMobile: number }] }, orderBy: { updatedAt: "desc" }, select: { id: true, ownerId: true } });
  if (!lead) return { outcome: "ignored", note: "Unknown caller: no lead has this number" };
  if (!lead.ownerId) return { outcome: "ignored", note: "The caller's lead has no owner to attribute the call to" };
  const call = await tx.callLog.create({
    data: {
      leadId: lead.id, agentId: lead.ownerId, direction: "INBOUND", status: toCallStatus(ev.status) ?? "COMPLETED", providerName: ev.provider, providerCallId: ev.providerCallId,
      externalStatus: ev.rawStatus, startedAt: ev.startedAt ?? null, endedAt: ev.endedAt ?? null, durationSec: ev.durationSec ?? null,
    },
  });
  if (ev.recordingUrl) await tx.recording.create({ data: { callId: call.id, providerUrl: ev.recordingUrl, durationSec: ev.durationSec ?? null } });
  
  // Auto-recalculate lead score after inbound call is created
  updateLeadScore(lead.id).catch(console.error);
  
  return { outcome: "processed", callId: call.id };
}

// ───────────── recovery ─────────────

/** Re-processes events that were stored but not applied (a bug or outage on our side). Does not contact the provider. */
export async function retryFailedEvents(user: AuthUser) {
  assertCan(user, "settings", "MANAGE");
  const rows = await db.callEvent.findMany({ where: { OR: [{ status: "FAILED", attempts: { lt: 5 } }, { status: "RECEIVED", receivedAt: { lt: new Date(Date.now() - 60_000) } }] }, orderBy: { receivedAt: "asc" }, take: 100, select: { id: true } });
  for (const r of rows) await processEvent(r.id);
  const left = await db.callEvent.count({ where: { id: { in: rows.map((r) => r.id) }, status: { in: ["FAILED", "RECEIVED"] } } });
  await audit({ actorId: user.id, action: "telephony.retry_events", entityType: "CallEvent", after: { tried: rows.length, stillFailing: left } });
  return { tried: rows.length, stillFailing: left };
}

/** Asks the provider about calls that should have finished but never reported (missed webhooks). */
export async function reconcileCalls(user: AuthUser) {
  assertCan(user, "settings", "MANAGE");
  const t = await getActiveTelephony();
  if (t.mode !== "live" || !t.provider) throw new AppError("VALIDATION_ERROR", "Reconciliation needs live calling to be enabled.");
  const calls = await db.callLog.findMany({
    where: { providerName: t.provider.key, providerCallId: { not: null }, status: { in: OPEN }, createdAt: { lt: new Date(Date.now() - 10 * 60_000), gt: new Date(Date.now() - 3 * 86_400_000) } },
    take: 25, select: { providerCallId: true },
  });
  let updated = 0, unknown = 0;
  for (const c of calls) {
    const ev = await t.provider.getCallDetails(c.providerCallId!);
    if (!ev) { unknown++; continue; }
    const r = await ingestWebhook(ev, { reconciled: true, providerCallId: ev.providerCallId });
    if (!r.duplicate) updated++;
  }
  await audit({ actorId: user.id, action: "telephony.reconcile", entityType: "CallLog", after: { checked: calls.length, updated, unknown } });
  return { checked: calls.length, updated, unknown };
}

/** Development only: lets an admin push a status into a sandbox call to exercise the webhook pipeline. */
export async function simulateSandboxEvent(user: AuthUser, callId: string, status: "completed" | "no-answer" | "busy" | "failed") {
  assertCan(user, "settings", "MANAGE");
  if (process.env.NODE_ENV === "production") throw new AppError("FORBIDDEN", "Not available in production.");
  const call = await db.callLog.findUnique({ where: { id: callId } });
  if (!call || call.providerName !== "sandbox" || !call.providerCallId) throw new AppError("VALIDATION_ERROR", "Only sandbox calls can be simulated.");
  const now = new Date();
  await ingestWebhook(
    { provider: "sandbox", providerCallId: call.providerCallId, customField: call.id, status, rawStatus: status, direction: "OUTBOUND", endedAt: now, durationSec: status === "completed" ? 42 : 0, occurredAt: now, dedupeKey: `sandbox:${call.id}:${status}:${now.getTime()}` },
    { simulated: true },
  );
}
