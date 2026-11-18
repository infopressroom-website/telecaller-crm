/**
 * DEVELOPMENT SEED DATA — clearly not real customer data.
 * Refuses to run in production (use `npm run db:bootstrap` there). Idempotent (safe to re-run).
 */
import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_KEYS } from "../lib/permissions";
import { ROLE_NAMES, ensureStarterRules, syncDispositions, syncPermissionsAndRoles } from "./reference-data";

const prisma = new PrismaClient();
const SOURCES = ["Website", "Facebook Ads", "Google Ads", "Referral", "Walk-in", "Bulk Upload"];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed development data in production. Use `npm run db:bootstrap` instead.");
  }
  const devPassword = process.env.SEED_DEV_PASSWORD;
  if (!devPassword || devPassword.length < 8) {
    throw new Error("Set SEED_DEV_PASSWORD (min 8 chars) in .env before seeding.");
  }

  const roleIds = await syncPermissionsAndRoles(prisma);
  await syncDispositions(prisma);
  for (const name of SOURCES) await prisma.leadSource.upsert({ where: { name }, update: {}, create: { name } });
  await prisma.campaign.upsert({ where: { name: "Dev Sample Campaign" }, update: {}, create: { name: "Dev Sample Campaign" } });
  await prisma.shift.upsert({
    where: { name: "General (10:00–19:00)" }, update: {},
    create: { name: "General (10:00–19:00)", startTime: "10:00", endTime: "19:00" },
  });

  // Dev accounts — one per role. Emails use the reserved .test TLD.
  const passwordHash = await bcrypt.hash(devPassword, 12);
  for (const key of ROLE_KEYS) {
    const email = `${key.toLowerCase().replace(/_/g, ".")}@crm.test`;
    await prisma.user.upsert({
      where: { email }, update: {},
      create: { name: `Dev ${ROLE_NAMES[key]}`, email, passwordHash, roleId: roleIds[key], status: UserStatus.ACTIVE, employeeId: `DEV-${key}`, joinedAt: new Date() },
    });
  }
  await ensureStarterRules(prisma);

  console.log("Seed complete (development data only).");
  console.log("Dev logins: <role>@crm.test, e.g. telecaller@crm.test — password from SEED_DEV_PASSWORD.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
