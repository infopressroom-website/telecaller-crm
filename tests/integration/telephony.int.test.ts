/**
 * Telephony pipeline tests against a real PostgreSQL database. They use the SANDBOX provider and synthetic
 * webhook events: no network calls, no real calls. NOT YET RUN.
 *   TEST_DATABASE_URL=postgresql://…/telecaller_crm_test npm run test:integration   (needs `npm run db:seed` first)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.TEST_DATABASE_URL;
if (URL) process.env.DATABASE_URL = URL;
const P = `itest-tel-${Date.now()}`;

describe.skipIf(!URL)("telephony pipeline", () => {
  let db: typeof import("@/lib/db").db;
  let agent: import("@/lib/auth/rbac").AuthUser;
  let admin: import("@/lib/auth/rbac").AuthUser;
  let agentNoPhone: import("@/lib/auth/rbac").AuthUser;
  let leadId: string;
  const sandbox = async () => {
    const { SandboxProvider } = await import("@/lib/telephony/sandbox");
    return { mode: "sandbox" as const, provider: new SandboxProvider() };
  };
  const event = async (o: Record<string, unknown>) => ({
    provider: "exotel", providerCallId: `${P}-ex`, status: "completed" as const, rawStatus: "completed", direction: "OUTBOUND" as const,
    occurredAt: new Date(), dedupeKey: `${P}:${Math.random()}`, ...o,
  });

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    const { DEFAULT_ROLE_GRANTS } = await import("@/lib/permissions");
    const { permKey } = await import("@/lib/auth/rbac");
    const perms = (role: "TELECALLER" | "ADMIN") => {
      const s = new Set<string>();
      for (const [r, acts] of Object.entries(DEFAULT_ROLE_GRANTS[role])) for (const x of acts ?? []) s.add(permKey(r, x));
      return s;
    };
    const mk = async (n: string, roleKey: "TELECALLER" | "ADMIN", phone: string | null) => {
      const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
      const u = await db.user.create({ data: { name: `${P}-${n}`, email: `${P}-${n}@crm.test`, passwordHash: "x", roleId: role.id, status: "ACTIVE", phone } });
      return { id: u.id, name: u.name, email: u.email, roleKey, roleName: roleKey, teamId: null, sessionId: "t", permissions: perms(roleKey) };
    };
    agent = await mk("agent", "TELECALLER", "919000000010");
    agentNoPhone = await mk("nophone", "TELECALLER", null);
    admin = await mk("admin", "ADMIN", null);
    const l = await db.lead.create({ data: { leadCode: `${P}-1`, name: `${P}-lead`, primaryMobile: "919000000011", ownerId: agent.id, status: "ASSIGNED" } });
    leadId = l.id;
  });

  afterAll(async () => {
    if (!db) return;
    const leads = (await db.lead.findMany({ where: { OR: [{ leadCode: { startsWith: P } }, { name: { startsWith: P } }] }, select: { id: true } })).map((l) => l.id);
    await db.callEvent.deleteMany({ where: { OR: [{ dedupeKey: { startsWith: P } }, { providerCallId: { startsWith: P } }] } });
    await db.followUp.deleteMany({ where: { leadId: { in: leads } } });
    await db.callLog.deleteMany({ where: { leadId: { in: leads } } });
    await db.leadActivity.deleteMany({ where: { leadId: { in: leads } } });
    await db.lead.deleteMany({ where: { id: { in: leads } } });
    await db.auditLog.deleteMany({ where: { actor: { email: { startsWith: P } } } });
    await db.user.deleteMany({ where: { email: { startsWith: P } } });
    await db.$disconnect();
  });

  it("clicking Start twice at once creates one call (the customer is never dialled twice)", async () => {
    const { startProviderCall } = await import("@/services/call-service");
    const t = await sandbox();
    const ref = crypto.randomUUID();
    const [a, b] = await Promise.all([startProviderCall(agent, leadId, ref, t), startProviderCall(agent, leadId, ref, t)]);
    expect(a.callId).toBe(b.callId);
    expect(await db.callLog.count({ where: { clientRef: ref } })).toBe(1);
    const call = await db.callLog.findUniqueOrThrow({ where: { clientRef: ref } });
    expect(call.providerName).toBe("sandbox");
    expect(call.providerCallId).toMatch(/^sandbox-/);
  });

  it("refuses to start when the agent has no phone number, and for other agents' leads", async () => {
    const { startProviderCall } = await import("@/services/call-service");
    const t = await sandbox();
    await expect(startProviderCall(agent, leadId, crypto.randomUUID(), t)).resolves.toBeTruthy();
    await expect(startProviderCall(agentNoPhone, leadId, crypto.randomUUID(), t)).rejects.toMatchObject({ code: "NOT_FOUND" }); // not their lead
    const own = await db.lead.create({ data: { leadCode: `${P}-2`, name: `${P}-own`, primaryMobile: "919000000012", ownerId: agentNoPhone.id, status: "ASSIGNED" } });
    await expect(startProviderCall(agentNoPhone, own.id, crypto.randomUUID(), t)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("a webhook that arrives before the dial response is still matched, and replays are harmless", async () => {
    const { ingestWebhook } = await import("@/services/call-service");
    const call = await db.callLog.create({ data: { leadId, agentId: agent.id, direction: "OUTBOUND", status: "INITIATED", providerName: "exotel", clientRef: crypto.randomUUID(), startedAt: new Date() } });
    const ev = await event({ providerCallId: `${P}-ex1`, customField: call.id, durationSec: 30, recordingUrl: "https://recordings.example.com/r1.mp3", dedupeKey: `${P}:ex1:completed` });
    expect((await ingestWebhook(ev, { t: 1 })).duplicate).toBe(false);
    expect((await ingestWebhook(ev, { t: 1 })).duplicate).toBe(true);
    const after = await db.callLog.findUniqueOrThrow({ where: { id: call.id }, include: { recording: true } });
    expect(after.status).toBe("COMPLETED");
    expect(after.providerCallId).toBe(`${P}-ex1`);
    expect(after.durationSec).toBe(30);
    expect(after.recording?.providerUrl).toContain("r1.mp3");
    expect(await db.callEvent.count({ where: { dedupeKey: `${P}:ex1:completed` } })).toBe(1);
  });

  it("identical webhooks delivered at the same instant are applied once", async () => {
    const { ingestWebhook } = await import("@/services/call-service");
    const call = await db.callLog.create({ data: { leadId, agentId: agent.id, direction: "OUTBOUND", status: "RINGING", providerName: "exotel", providerCallId: `${P}-ex2`, clientRef: crypto.randomUUID() } });
    const ev = await event({ providerCallId: `${P}-ex2`, customField: call.id, recordingUrl: "https://recordings.example.com/r2.mp3", dedupeKey: `${P}:ex2:completed` });
    const results = await Promise.all(Array.from({ length: 5 }, () => ingestWebhook(ev, {})));
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(await db.callEvent.count({ where: { providerCallId: `${P}-ex2` } })).toBe(1);
    expect(await db.recording.count({ where: { callId: call.id } })).toBe(1);
  });

  it("late or out-of-order events never reopen a finished call", async () => {
    const { ingestWebhook } = await import("@/services/call-service");
    const call = await db.callLog.create({ data: { leadId, agentId: agent.id, direction: "OUTBOUND", status: "RINGING", providerName: "exotel", providerCallId: `${P}-ex3`, clientRef: crypto.randomUUID() } });
    await ingestWebhook(await event({ providerCallId: `${P}-ex3`, status: "no-answer", rawStatus: "no-answer", dedupeKey: `${P}:ex3:a` }), {});
    await ingestWebhook(await event({ providerCallId: `${P}-ex3`, status: "in-progress", rawStatus: "in-progress", dedupeKey: `${P}:ex3:b` }), {});
    await ingestWebhook(await event({ providerCallId: `${P}-ex3`, status: "completed", rawStatus: "completed", dedupeKey: `${P}:ex3:c` }), {});
    expect((await db.callLog.findUniqueOrThrow({ where: { id: call.id } })).status).toBe("NOT_ANSWERED"); // the first final report wins
  });

  it("the provider's final status overrides the agent's provisional one, but the agent's outcome is kept", async () => {
    const { startProviderCall, ingestWebhook } = await import("@/services/call-service");
    const { completeCall } = await import("@/services/workspace-service");
    const t = await sandbox();
    const ref = crypto.randomUUID();
    const started = await startProviderCall(agent, leadId, ref, t);
    const interested = await db.callDisposition.findUniqueOrThrow({ where: { key: "INTERESTED" } });
    await completeCall(agent, { leadId, callRef: ref, dispositionId: interested.id, notes: "Wants a quote" });
    const call = await db.callLog.findUniqueOrThrow({ where: { id: started.callId } });
    await ingestWebhook(await event({ provider: "sandbox", providerCallId: call.providerCallId!, customField: call.id, status: "no-answer", rawStatus: "no-answer", dedupeKey: `${P}:sb:${call.id}` }), {});
    const final = await db.callLog.findUniqueOrThrow({ where: { id: call.id } });
    expect(final.status).toBe("NOT_ANSWERED");
    expect(final.dispositionId).toBe(interested.id);
    expect(final.notes).toBe("Wants a quote");
  });

  it("inbound calls: unknown callers are logged as ignored, known callers are attributed to the lead's owner", async () => {
    const { ingestWebhook } = await import("@/services/call-service");
    await ingestWebhook(await event({ providerCallId: `${P}-in1`, direction: "INBOUND", from: "+919111111111", dedupeKey: `${P}:in1` }), {});
    expect((await db.callEvent.findUniqueOrThrow({ where: { dedupeKey: `${P}:in1` } })).status).toBe("IGNORED");
    expect(await db.callLog.count({ where: { providerCallId: `${P}-in1` } })).toBe(0);

    await ingestWebhook(await event({ providerCallId: `${P}-in2`, direction: "INBOUND", from: "+919000000011", dedupeKey: `${P}:in2` }), {});
    const c = await db.callLog.findFirstOrThrow({ where: { providerCallId: `${P}-in2` } });
    expect(c).toMatchObject({ direction: "INBOUND", agentId: agent.id, leadId });
    await ingestWebhook(await event({ providerCallId: `${P}-in2`, direction: "INBOUND", from: "+919000000011", dedupeKey: `${P}:in2b` }), {});
    expect(await db.callLog.count({ where: { providerCallId: `${P}-in2` } })).toBe(1);
  });

  it("events that failed to process can be retried without contacting the provider", async () => {
    const { retryFailedEvents } = await import("@/services/call-service");
    const call = await db.callLog.create({ data: { leadId, agentId: agent.id, direction: "OUTBOUND", status: "RINGING", providerName: "exotel", providerCallId: `${P}-ex4`, clientRef: crypto.randomUUID() } });
    const ev = await event({ providerCallId: `${P}-ex4`, dedupeKey: `${P}:ex4` });
    const row = await db.callEvent.create({ data: { provider: "exotel", providerCallId: `${P}-ex4`, eventType: "completed", dedupeKey: `${P}:ex4`, raw: {}, normalized: JSON.parse(JSON.stringify(ev)), status: "FAILED", attempts: 1, note: "simulated outage" } });
    await retryFailedEvents(admin);
    expect((await db.callEvent.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("PROCESSED");
    expect((await db.callLog.findUniqueOrThrow({ where: { id: call.id } })).status).toBe("COMPLETED");
  });

  it("only admins can run recovery tools", async () => {
    const { retryFailedEvents } = await import("@/services/call-service");
    await expect(retryFailedEvents(agent)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
