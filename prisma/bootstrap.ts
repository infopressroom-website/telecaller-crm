/**
 * PRODUCTION BOOTSTRAP — safe to run in production, safe to re-run.
 *
 * Creates the data the application cannot run without: permissions, roles with their default grants, the built-in
 * call outcomes and the starter automation rules (switched OFF). It also creates the FIRST Super Admin, but only if
 * no active Super Admin exists yet. It never creates demo data or sample accounts.
 *
 *   BOOTSTRAP_ADMIN_EMAIL=owner@yourcompany.com BOOTSTRAP_ADMIN_NAME="Owner Name" npm run db:bootstrap
 *
 * A one-time temporary password is generated and printed ONCE; the admin must change it at first sign-in.
 * Run it somewhere private (not in a CI log that others can read) and clear the terminal afterwards.
 * Note: role grants are defined in code (lib/permissions.ts) and are re-applied on every run.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateTempPassword } from "../lib/team/temp-password";
import { ensureStarterRules, syncDispositions, syncPermissionsAndRoles } from "./reference-data";

const prisma = new PrismaClient();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function main() {
  const roleIds = await syncPermissionsAndRoles(prisma);
  await syncDispositions(prisma);
  await ensureStarterRules(prisma);
  console.log("Reference data is in place (roles, permissions, call outcomes, starter rules).");

  const existing = await prisma.user.count({ where: { role: { key: "SUPER_ADMIN" }, status: "ACTIVE", archivedAt: null } });
  if (existing > 0) {
    console.log(`An active Super Admin already exists (${existing}); no new account was created.`);
    return;
  }

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.BOOTSTRAP_ADMIN_NAME ?? "Administrator").trim().slice(0, 100) || "Administrator";
  if (!EMAIL.test(email)) {
    throw new Error("No Super Admin exists yet. Set BOOTSTRAP_ADMIN_EMAIL to a real email address and run again.");
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error(`A user with ${email} already exists but is not an active Super Admin. Use a different email or fix that user in the database.`);
  }

  const temp = generateTempPassword();
  await prisma.user.create({
    data: {
      name, email, roleId: roleIds.SUPER_ADMIN, status: "ACTIVE", passwordHash: await bcrypt.hash(temp, 12),
      mustChangePassword: true, joinedAt: new Date(),
    },
  });
  await prisma.auditLog.create({ data: { action: "bootstrap.create_super_admin", entityType: "User", after: { email } } });

  console.log("\n==================================================");
  console.log(` First Super Admin created: ${email}`);
  console.log(` Temporary password (shown ONCE): ${temp}`);
  console.log(" They must choose a new password at first sign-in.");
  console.log("==================================================\n");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
