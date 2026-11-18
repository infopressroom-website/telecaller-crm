/**
 * DEVELOPMENT DEMO DATA — fabricated leads, calls and follow-ups so the dashboard has something to show.
 * Run AFTER `npm run db:seed`. Refuses to run in production. Safe to re-run (skips if already present).
 * Every lead code starts with "DEV-" and every lead's notes say it is demo data.
 */
import { PrismaClient, type LeadStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261031);
const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)] as T;
const DAY = 86_400_000;

const OUTCOMES: { key: string; weight: number; status: LeadStatus }[] = [
  { key: "NOT_ANSWERED", weight: 28, status: "ATTEMPTED" },
  { key: "BUSY", weight: 8, status: "ATTEMPTED" },
  { key: "SWITCHED_OFF", weight: 6, status: "ATTEMPTED" },
  { key: "CONNECTED", weight: 14, status: "CONNECTED" },
  { key: "INTERESTED", weight: 14, status: "INTERESTED" },
  { key: "CALLBACK_REQUESTED", weight: 10, status: "FOLLOW_UP" },
  { key: "NOT_INTERESTED", weight: 9, status: "LOST" },
  { key: "WRONG_NUMBER", weight: 2, status: "INVALID" },
  { key: "DND", weight: 1, status: "DND" },
  { key: "CONVERTED", weight: 8, status: "CONVERTED" },
];
function weighted() {
  let r = rand() * OUTCOMES.reduce((n, o) => n + o.weight, 0);
  for (const o of OUTCOMES) if ((r -= o.weight) <= 0) return o;
  return OUTCOMES[0]!;
}

// Daily call targets for the demo telecallers (there is no screen to set targets until Phase 10).
async function ensureTargets() {
  const users = await prisma.user.findMany({ where: { OR: [{ email: "telecaller@crm.test" }, { email: { startsWith: "dev.telecaller" } }] }, select: { id: true } });
  const startsOn = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  for (const u of users) {
    if (!(await prisma.target.findFirst({ where: { userId: u.id, metric: "CALL_ATTEMPTS", period: "DAILY" } }))) {
      await prisma.target.create({ data: { userId: u.id, metric: "CALL_ATTEMPTS", period: "DAILY", value: 40, startsOn } });
    }
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");
  const pw = process.env.SEED_DEV_PASSWORD;
  if (!pw) throw new Error("Set SEED_DEV_PASSWORD first (same as for db:seed).");
  if (await prisma.lead.findUnique({ where: { leadCode: "DEV-000001" } })) {
    await ensureTargets();
    console.log("Demo data already present; ensured demo call targets.");
    return;
  }

  const roles = await prisma.role.findMany();
  const roleId = (key: string) => roles.find((r) => r.key === key)?.id ?? (() => { throw new Error("Run `npm run db:seed` first."); })();
  const hash = await bcrypt.hash(pw, 12);

  const mgr = await prisma.user.findUniqueOrThrow({ where: { email: "manager@crm.test" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@crm.test" } });
  const tl1 = await prisma.user.findUniqueOrThrow({ where: { email: "team.leader@crm.test" } });
  const mkUser = (email: string, name: string, role: string) =>
    prisma.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash: hash, roleId: roleId(role), status: "ACTIVE" } });
  const tl2 = await mkUser("dev.leader2@crm.test", "Dev Team Leader 2", "TEAM_LEADER");

  const teamA = await prisma.team.upsert({ where: { name: "Dev Team A" }, update: {}, create: { name: "Dev Team A", leaderId: tl1.id } });
  const teamB = await prisma.team.upsert({ where: { name: "Dev Team B" }, update: {}, create: { name: "Dev Team B", leaderId: tl2.id } });
  // Team leaders report to the dev manager, so the manager's scope covers both teams.
  await prisma.user.update({ where: { id: tl1.id }, data: { teamId: teamA.id, reportingToId: mgr.id } });
  await prisma.user.update({ where: { id: tl2.id }, data: { teamId: teamB.id, reportingToId: mgr.id } });

  const base = await prisma.user.findUniqueOrThrow({ where: { email: "telecaller@crm.test" } });
  const baseUpdated = await prisma.user.update({ where: { id: base.id }, data: { teamId: teamA.id, reportingToId: tl1.id } });
  const agents = [baseUpdated];
  for (let i = 1; i <= 4; i++) {
    const team = i <= 2 ? teamA : teamB;
    const u = await mkUser(`dev.telecaller${i}@crm.test`, `Dev Telecaller ${i}`, "TELECALLER");
    const updated = await prisma.user.update({ where: { id: u.id }, data: { teamId: team.id, reportingToId: team === teamA ? tl1.id : tl2.id } });
    agents.push(updated);
  }

  const sources = await prisma.leadSource.findMany();
  const camp1 = await prisma.campaign.upsert({ where: { name: "Dev Sample Campaign" }, update: {}, create: { name: "Dev Sample Campaign" } });
  const camp2 = await prisma.campaign.upsert({ where: { name: "Dev Winter Campaign" }, update: {}, create: { name: "Dev Winter Campaign" } });
  const disp = new Map((await prisma.callDisposition.findMany()).map((d) => [d.key, d]));
  const now = Date.now();

  const leads: any[] = [], calls: any[] = [], assigns: any[] = [], follows: any[] = [];
  for (let i = 1; i <= 300; i++) {
    const id = `devlead${String(i).padStart(4, "0")}`;
    const createdAt = new Date(now - rand() * 40 * DAY);
    const owner = rand() < 0.85 ? pick(agents) : null;
    let status: LeadStatus = owner ? "ASSIGNED" : "NEW";
    let lastCall: Date | null = null;

    if (owner) {
      assigns.push({ leadId: id, toUserId: owner.id, actorId: admin.id, method: "ROUND_ROBIN", createdAt: new Date(createdAt.getTime() + 60_000) });
      const n = rand() < 0.75 ? 1 + Math.floor(rand() * 3) : 0;
      let t = createdAt.getTime() + 3_600_000;
      for (let c = 0; c < n && t < now; c++) {
        const o = weighted();
        const d = disp.get(o.key)!;
        const started = new Date(t);
        const dur = d.isConnected ? 30 + Math.floor(rand() * 370) : 0;
        calls.push({
          leadId: id, agentId: owner.id, direction: "OUTBOUND", dispositionId: d.id,
          status: d.isConnected ? "COMPLETED" : o.key === "BUSY" ? "BUSY" : "NOT_ANSWERED",
          startedAt: started, endedAt: new Date(t + dur * 1000), durationSec: dur, createdAt: started,
        });
        status = o.status;
        lastCall = started;
        t += (0.5 + rand() * 3) * DAY;
      }
      if (status === "FOLLOW_UP") {
        const due = new Date(now + (rand() * 10 - 5) * DAY);
        const past = due.getTime() < now;
        follows.push({
          leadId: id, ownerId: owner.id, dueAt: due, priority: "MEDIUM", createdAt: lastCall ?? createdAt,
          status: past ? pick(["COMPLETED", "COMPLETED", "MISSED", "PENDING"] as const) : "PENDING",
        });
      }
    }
    leads.push({
      id, leadCode: `DEV-${String(i).padStart(6, "0")}`, name: `Demo Lead ${i}`,
      primaryMobile: `919${String(Math.floor(rand() * 1e9)).padStart(9, "0")}`,
      city: pick(["Delhi", "Mumbai", "Pune", "Jaipur", "Lucknow"]), status,
      priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"] as const),
      sourceId: pick(sources).id, campaignId: rand() < 0.6 ? camp1.id : camp2.id,
      ownerId: owner?.id ?? null, teamId: owner?.teamId ?? null, lastContactedAt: lastCall,
      notes: "Development demo data — not a real customer.", createdAt,
    });
  }
  await prisma.lead.createMany({ data: leads });
  await prisma.leadAssignment.createMany({ data: assigns });
  await prisma.callLog.createMany({ data: calls });
  await prisma.followUp.createMany({ data: follows });
  await prisma.task.createMany({
    data: Array.from({ length: 12 }, (_, i) => ({
      title: `Demo task ${i + 1}`, ownerId: pick(agents).id, creatorId: admin.id,
      status: pick(["OPEN", "OPEN", "IN_PROGRESS", "DONE"] as const),
    })),
  });
  await prisma.notification.create({ data: { userId: admin.id, title: "Demo data loaded (development only)", channel: "IN_APP" } });
  await ensureTargets();
  console.log(`Demo data created: ${leads.length} leads, ${calls.length} calls, ${follows.length} follow-ups.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
