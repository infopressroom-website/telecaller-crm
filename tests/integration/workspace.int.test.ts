/**
 * Workspace integration tests (need a real PostgreSQL database; see concurrency.int.test.ts for setup).
 *   TEST_DATABASE_URL=postgresql://…/telecaller_crm_test npm run test:integration
 * Requires `npm run db:seed` so the call dispositions exist. NOT YET RUN.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.TEST_DATABASE_URL;
if (URL) process.env.DATABASE_URL = URL;
const P = `itest-ws-${Date.now()}`;

describe.skipIf(!URL)("telecaller workspace", () => {
  let db: typeof import("@/lib/db").db;
  let alice: import("@/lib/auth/rbac").AuthUser;
  let bob: import("@/lib/auth/rbac").AuthUser;
  let leadId: string;
  let dnd: string;
  let callbackId: string;
  let noAnswerId: string;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    const { DEFAULT_ROLE_GRANTS } = await import("@/lib/permissions");
    const { permKey } = await import("@/lib/auth/rbac");
    const role = await db.role.findUniqueOrThrow({ where: { key: "TELECALLER" } });
    const perms = new Set<string>();
    for (const [r, acts] of Object.entries(DEFAULT_ROLE_GRANTS.TELECALLER)) for (const x of acts ?? []) perms.add(permKey(r, x));
    const mk = async (n: string) => {
      const u = await db.user.create({ data: { name: `${P}-${n}`, email: `${P}-${n}@crm.test`, passwordHash: "x", roleId: role.id, status: "ACTIVE" } });
      return { id: u.id, name: u.name, email: u.email, roleKey: "TELECALLER" as const, roleName: "Telecaller", teamId: null, sessionId: "t", permissions: perms };
    };
    alice = await mk("alice"); bob = await mk("bob");
    const l = await db.lead.create({ data: { leadCode: `${P}-1`, name: `${P}-lead`, primaryMobile: "919000000001", ownerId: alice.id, status: "ASSIGNED" } });
    const d = await db.lead.create({ data: { leadCode: `${P}-2`, name: `${P}-dnd`, primaryMobile: "919000000002", ownerId: alice.id, status: "DND" } });
    leadId = l.id; dnd = d.id;
    callbackId = (await db.callDisposition.findUniqueOrThrow({ where: { key: "CALLBACK_REQUESTED" } })).id;
    noAnswerId = (await db.callDisposition.findUniqueOrThrow({ where: { key: "NOT_ANSWERED" } })).id;
  });

  afterAll(async () => {
    if (!db) return;
    const ids = (await db.lead.findMany({ where: { leadCode: { startsWith: P } }, select: { id: true } })).map((l) => l.id);
    await db.followUp.deleteMany({ where: { leadId: { in: ids } } });
    await db.callLog.deleteMany({ where: { leadId: { in: ids } } });
    await db.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
    await db.lead.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { email: { startsWith: P } } });
    await db.$disconnect();
  });

  it("saving the same call twice at once creates one call and one follow-up", async () => {
    const { startCall, completeCall } = await import("@/services/workspace-service");
    const callRef = crypto.randomUUID();
    await startCall(alice, leadId, callRef);
    const followUpAt = new Date(Date.now() + 3_600_000).toISOString();
    const input = { leadId, callRef, dispositionId: callbackId, notes: "Call back after lunch", followUpAt, nextAction: "Send brochure" };
    const [a, b] = await Promise.all([completeCall(alice, input), completeCall(alice, input)]);
    expect([a.alreadySaved, b.alreadySaved].filter((x) => !x)).toHaveLength(1);
    expect(await db.callLog.count({ where: { leadId } })).toBe(1);
    expect(await db.followUp.count({ where: { leadId, status: "PENDING" } })).toBe(1);
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.status).toBe("FOLLOW_UP");
    expect(lead.nextFollowUpAt?.toISOString()).toBe(followUpAt);
  });

  it("starting a call twice returns the original start time", async () => {
    const { startCall } = await import("@/services/workspace-service");
    const ref = crypto.randomUUID();
    const first = await startCall(alice, leadId, ref);
    const second = await startCall(alice, leadId, ref);
    expect(second.startedAt).toBe(first.startedAt);
  });

  it("another agent cannot see, start or save calls on a lead they don't own", async () => {
    const { startCall, completeCall, getWorkspaceLead } = await import("@/services/workspace-service");
    await expect(getWorkspaceLead(bob, leadId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(startCall(bob, leadId, crypto.randomUUID())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(completeCall(bob, { leadId, callRef: crypto.randomUUID(), dispositionId: noAnswerId })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a call reference can't be reused to overwrite someone else's call", async () => {
    const { startCall } = await import("@/services/workspace-service");
    const ref = crypto.randomUUID();
    await startCall(alice, leadId, ref);
    await expect(startCall(bob, leadId, ref)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a callback outcome requires a time, and past times are refused", async () => {
    const { completeCall } = await import("@/services/workspace-service");
    await expect(completeCall(alice, { leadId, callRef: crypto.randomUUID(), dispositionId: callbackId })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(completeCall(alice, { leadId, callRef: crypto.randomUUID(), dispositionId: noAnswerId, followUpAt: new Date(Date.now() - 3_600_000).toISOString() })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("do-not-disturb leads cannot be called or logged", async () => {
    const { startCall, completeCall } = await import("@/services/workspace-service");
    await expect(startCall(alice, dnd, crypto.randomUUID())).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(completeCall(alice, { leadId: dnd, callRef: crypto.randomUUID(), dispositionId: noAnswerId })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
