/**
 * Concurrency tests for distribution and imports. They need a REAL PostgreSQL database.
 *
 *   TEST_DATABASE_URL=postgresql://…/telecaller_crm_test npm run test:integration
 *
 * Use a throwaway database that has had `prisma migrate deploy` applied (and `npm run db:seed`).
 * The tests create rows prefixed "itest-" and delete them afterwards. They are skipped when TEST_DATABASE_URL is unset.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.TEST_DATABASE_URL;
if (URL) process.env.DATABASE_URL = URL;

const P = `itest-${Date.now()}`;

describe.skipIf(!URL)("concurrent assignment and import", () => {
  let db: typeof import("@/lib/db").db;
  let actor: import("@/lib/auth/rbac").AuthUser;
  let agentIds: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    const { ROLE_KEYS, DEFAULT_ROLE_GRANTS } = await import("@/lib/permissions");
    const { permKey } = await import("@/lib/auth/rbac");
    const telecaller = await db.role.findUniqueOrThrow({ where: { key: "TELECALLER" } });
    const admin = await db.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
    void ROLE_KEYS;
    const a = await db.user.create({ data: { name: `${P}-admin`, email: `${P}-admin@crm.test`, passwordHash: "x", roleId: admin.id, status: "ACTIVE" } });
    for (let i = 1; i <= 3; i++) {
      const u = await db.user.create({ data: { name: `${P}-agent${i}`, email: `${P}-agent${i}@crm.test`, passwordHash: "x", roleId: telecaller.id, status: "ACTIVE" } });
      agentIds.push(u.id);
    }
    const perms = new Set<string>();
    for (const [r, acts] of Object.entries(DEFAULT_ROLE_GRANTS.ADMIN)) for (const x of acts ?? []) perms.add(permKey(r, x));
    actor = { id: a.id, name: a.name, email: a.email, roleKey: "ADMIN", roleName: "Admin", teamId: null, sessionId: "t", permissions: perms };
    await db.distributionRule.create({ data: { name: `${P}-rule`, method: "WORKLOAD_BASED", agents: { create: agentIds.map((userId) => ({ userId })) } } });
  });

  afterAll(async () => {
    if (!db) return;
    const leads = await db.lead.findMany({ where: { name: { startsWith: P } }, select: { id: true } });
    const ids = leads.map((l) => l.id);
    await db.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
    await db.leadAssignment.deleteMany({ where: { leadId: { in: ids } } });
    await db.lead.deleteMany({ where: { id: { in: ids } } });
    await db.importBatch.deleteMany({ where: { fileName: { startsWith: P } } });
    await db.distributionRule.deleteMany({ where: { name: { startsWith: P } } });
    await db.distributionRun.deleteMany({ where: { actorId: actor.id } });
    await db.auditLog.deleteMany({ where: { actorId: actor.id } });
    await db.user.deleteMany({ where: { email: { startsWith: P } } });
    await db.$disconnect();
  });

  it("several simultaneous runs never assign a lead twice", async () => {
    const { applyDistribution } = await import("@/services/distribution-service");
    const { nextLeadCodes } = await import("@/services/lead-code");
    await db.$transaction(async (tx) => {
      const codes = await nextLeadCodes(tx, 30);
      await tx.lead.createMany({ data: codes.map((c, i) => ({ leadCode: c, name: `${P}-lead${i}`, primaryMobile: `9199${String(100000 + i)}`, status: "NEW" as const })) });
    });
    const runs = await Promise.all(Array.from({ length: 5 }, () => applyDistribution(actor, crypto.randomUUID(), "UNASSIGNED")));

    const mine = await db.lead.findMany({ where: { name: { startsWith: P } }, select: { id: true, ownerId: true } });
    const assignments = await db.leadAssignment.findMany({ where: { leadId: { in: mine.map((l) => l.id) } } });
    expect(mine.every((l) => l.ownerId !== null)).toBe(true);
    expect(assignments).toHaveLength(30); // exactly one assignment event per lead
    expect(new Set(assignments.map((a) => a.leadId)).size).toBe(30);
    expect(runs.reduce((n, r) => n + r.assigned, 0)).toBeGreaterThanOrEqual(30);
  });

  it("submitting the same run twice at once applies it once", async () => {
    const { applyDistribution } = await import("@/services/distribution-service");
    const { nextLeadCodes } = await import("@/services/lead-code");
    await db.$transaction(async (tx) => {
      const codes = await nextLeadCodes(tx, 10);
      await tx.lead.createMany({ data: codes.map((c, i) => ({ leadCode: c, name: `${P}-dbl${i}`, primaryMobile: `9188${String(100000 + i)}`, status: "NEW" as const })) });
    });
    const id = crypto.randomUUID();
    const [a, b] = await Promise.all([applyDistribution(actor, id, "UNASSIGNED"), applyDistribution(actor, id, "UNASSIGNED")]);
    expect([a.alreadyApplied, b.alreadyApplied].filter(Boolean)).toHaveLength(1);
    expect(await db.distributionRun.count({ where: { id } })).toBe(1);
    const dbl = await db.lead.findMany({ where: { name: { startsWith: `${P}-dbl` } }, select: { id: true } });
    expect(await db.leadAssignment.count({ where: { leadId: { in: dbl.map((l) => l.id) } } })).toBe(10);
  });

  it("simultaneous imports never produce duplicate lead codes", async () => {
    const { createBatch, validateBatch, runImport } = await import("@/services/import-service");
    const make = (offset: number) => ({
      headers: ["Name", "Mobile"],
      rows: Array.from({ length: 40 }, (_, i) => ({ rowNumber: i + 2, values: { Name: `${P}-imp${offset + i}`, Mobile: `9${String(777000000 + offset + i)}` } })),
    });
    const mapping = { Name: "name", Mobile: "primaryMobile" } as const;
    const ids = await Promise.all([0, 100].map((o) => createBatch(actor, { name: `${P}-f${o}.csv`, size: 1 }, make(o), {})));
    await Promise.all(ids.map((id) => validateBatch(actor, id, { ...mapping })));
    await Promise.all(ids.map((id) => runImport(actor, id, "SKIP")));

    const leads = await db.lead.findMany({ where: { name: { startsWith: `${P}-imp` } }, select: { leadCode: true } });
    expect(leads).toHaveLength(80);
    expect(new Set(leads.map((l) => l.leadCode)).size).toBe(80);
  });

  it("running the same import twice at once only runs it once", async () => {
    const { createBatch, validateBatch, runImport } = await import("@/services/import-service");
    const id = await createBatch(actor, { name: `${P}-once.csv`, size: 1 }, { headers: ["Name", "Mobile"], rows: [{ rowNumber: 2, values: { Name: `${P}-once`, Mobile: "9666000001" } }] }, {});
    await validateBatch(actor, id, { Name: "name", Mobile: "primaryMobile" });
    const results = await Promise.allSettled([runImport(actor, id, "SKIP"), runImport(actor, id, "SKIP")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.lead.count({ where: { name: `${P}-once` } })).toBe(1);
  });
});
