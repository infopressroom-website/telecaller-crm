import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { userScopeWhere } from "@/lib/auth/scope";
import { hashPassword } from "@/lib/auth/password";
import { revokeSessions } from "@/lib/auth/session";
import { AppError, notFound } from "@/lib/errors";
import { pageMeta, toPrismaPage } from "@/lib/pagination";
import type { RoleKey } from "@/lib/permissions";
import { assignableRoles, canManageRole } from "@/lib/team/roles";
import { generateTempPassword } from "@/lib/team/temp-password";
import type { EmployeeInput } from "@/validations/team";
import { audit } from "./audit-service";
import { resolveScope } from "./scope-service";

/** Admins and HR see everyone; managers and team leaders see their teams; everyone else only themselves. */
export async function directoryWhere(user: AuthUser): Promise<Prisma.UserWhereInput> {
  if (["SUPER_ADMIN", "ADMIN", "HR_OPERATIONS"].includes(user.roleKey)) return { archivedAt: null };
  return { AND: [userScopeWhere(await resolveScope(user)), { archivedAt: null }] };
}

const SELECT = {
  id: true, name: true, email: true, phone: true, employeeId: true, status: true, joinedAt: true, lastLoginAt: true, lockedUntil: true, mustChangePassword: true,
  role: { select: { key: true, name: true } }, team: { select: { id: true, name: true } }, reportingTo: { select: { id: true, name: true } }, teamId: true, reportingToId: true,
} satisfies Prisma.UserSelect;

export async function listEmployees(user: AuthUser, q: { q?: string; roleKey?: string; teamId?: string; status?: string; page: number; pageSize: number }) {
  assertCan(user, "user", "VIEW");
  const and: Prisma.UserWhereInput[] = [await directoryWhere(user)];
  if (q.q) and.push({ OR: [{ name: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { employeeId: { contains: q.q, mode: "insensitive" } }] });
  if (q.roleKey) and.push({ role: { key: q.roleKey } });
  if (q.teamId) and.push({ teamId: q.teamId });
  if (q.status) and.push({ status: q.status as "ACTIVE" });
  const where = { AND: and };
  const [total, rows] = await Promise.all([db.user.count({ where }), db.user.findMany({ where, orderBy: { name: "asc" }, ...toPrismaPage(q), select: SELECT })]);
  return { rows, meta: pageMeta(total, q), total };
}

export async function getEmployee(user: AuthUser, id: string) {
  assertCan(user, "user", "VIEW");
  const e = await db.user.findFirst({ where: { AND: [{ id }, await directoryWhere(user)] }, select: SELECT });
  if (!e) throw notFound("Employee");
  return e;
}

export async function getEmployeeFormOptions(user: AuthUser) {
  assertCan(user, "user", "VIEW");
  const [teams, managers, roles] = await Promise.all([
    db.team.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { status: "ACTIVE", archivedAt: null, role: { key: { in: ["MANAGER", "TEAM_LEADER", "ADMIN", "SUPER_ADMIN"] } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.role.findMany({ select: { key: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const allowed = new Set(assignableRoles(user.roleKey));
  return { teams, managers, roles: roles.filter((r) => allowed.has(r.key as RoleKey)) };
}

async function refs(input: EmployeeInput) {
  if (input.teamId && !(await db.team.findFirst({ where: { id: input.teamId, archivedAt: null } }))) throw new AppError("VALIDATION_ERROR", "Unknown team.");
  if (input.reportingToId && !(await db.user.findFirst({ where: { id: input.reportingToId, status: "ACTIVE" } }))) throw new AppError("VALIDATION_ERROR", "Unknown reporting manager.");
}

export async function createEmployee(user: AuthUser, input: EmployeeInput) {
  assertCan(user, "user", "CREATE");
  if (!assignableRoles(user.roleKey).includes(input.roleKey)) throw new AppError("FORBIDDEN", "You can't create users with that role.");
  await refs(input);
  const role = await db.role.findUniqueOrThrow({ where: { key: input.roleKey } });
  const temp = generateTempPassword();
  if (await db.user.findUnique({ where: { email: input.email } })) throw new AppError("CONFLICT", "A user with this email already exists.");
  if (input.employeeId && (await db.user.findUnique({ where: { employeeId: input.employeeId } }))) throw new AppError("CONFLICT", "That employee ID is already in use.");
  const created = await db.user.create({
    data: {
      name: input.name, email: input.email, phone: input.phone ?? null, employeeId: input.employeeId ?? null, roleId: role.id, teamId: input.teamId ?? null,
      reportingToId: input.reportingToId ?? null, joinedAt: input.joinedAt ? new Date(`${input.joinedAt}T00:00:00Z`) : null, status: "ACTIVE",
      passwordHash: await hashPassword(temp), mustChangePassword: true,
    },
  });
  await audit({ actorId: user.id, action: "employee.create", entityType: "User", entityId: created.id, after: { email: input.email, role: input.roleKey, teamId: input.teamId ?? null } });
  return { id: created.id, tempPassword: temp }; // shown once to the administrator; only a hash is stored
}

export async function updateEmployee(user: AuthUser, id: string, input: EmployeeInput) {
  assertCan(user, "user", "EDIT");
  const target = await db.user.findFirst({ where: { AND: [{ id }, await directoryWhere(user)] }, include: { role: true } });
  if (!target) throw notFound("Employee");
  const targetRole = target.role.key as RoleKey;
  if (target.id !== user.id && !canManageRole(user.roleKey, targetRole)) throw new AppError("FORBIDDEN", "You can't change this user.");
  if (target.id === user.id && (input.roleKey !== targetRole || input.status !== "ACTIVE")) throw new AppError("FORBIDDEN", "You can't change your own role or deactivate yourself.");
  if (input.roleKey !== targetRole && !assignableRoles(user.roleKey).includes(input.roleKey)) throw new AppError("FORBIDDEN", "You can't assign that role.");
  await refs(input);
  if (input.reportingToId === id) throw new AppError("VALIDATION_ERROR", "A person can't report to themselves.");
  const clash = await db.user.findFirst({ where: { OR: [{ email: input.email }, ...(input.employeeId ? [{ employeeId: input.employeeId }] : [])], NOT: { id } } });
  if (clash) throw new AppError("CONFLICT", "Another user already has that email or employee ID.");

  const role = await db.role.findUniqueOrThrow({ where: { key: input.roleKey } });
  const data = { name: input.name, email: input.email, phone: input.phone ?? null, employeeId: input.employeeId ?? null, roleId: role.id, teamId: input.teamId ?? null, reportingToId: input.reportingToId ?? null, joinedAt: input.joinedAt ? new Date(`${input.joinedAt}T00:00:00Z`) : null, status: input.status };
  await db.user.update({ where: { id }, data });
  if (input.status !== "ACTIVE" || input.roleKey !== targetRole) await revokeSessions(id); // takes effect immediately
  await audit({ actorId: user.id, action: "employee.update", entityType: "User", entityId: id, before: { role: targetRole, status: target.status, teamId: target.teamId }, after: { role: input.roleKey, status: input.status, teamId: input.teamId ?? null } });
}

async function managedTarget(user: AuthUser, id: string) {
  assertCan(user, "user", "EDIT");
  const t = await db.user.findFirst({ where: { AND: [{ id }, await directoryWhere(user)] }, include: { role: true } });
  if (!t) throw notFound("Employee");
  if (t.id !== user.id && !canManageRole(user.roleKey, t.role.key as RoleKey)) throw new AppError("FORBIDDEN", "You can't change this user.");
  return t;
}

export async function resetEmployeePassword(user: AuthUser, id: string) {
  const t = await managedTarget(user, id);
  const temp = generateTempPassword();
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(temp), mustChangePassword: true, failedLogins: 0, lockedUntil: null } });
  await revokeSessions(id);
  await audit({ actorId: user.id, action: "employee.reset_password", entityType: "User", entityId: t.id });
  return { tempPassword: temp };
}

export async function unlockEmployee(user: AuthUser, id: string) {
  const t = await managedTarget(user, id);
  await db.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null } });
  await audit({ actorId: user.id, action: "employee.unlock", entityType: "User", entityId: t.id });
}

// ───────────── teams ─────────────

export async function listTeams(user: AuthUser) {
  assertCan(user, "team", "VIEW");
  const scope = await resolveScope(user);
  const where: Prisma.TeamWhereInput = { archivedAt: null, ...(scope.kind === "TEAMS" ? { id: { in: scope.teamIds } } : scope.kind === "ALL" ? {} : { id: { in: [] } }) };
  const teams = await db.team.findMany({ where, orderBy: { name: "asc" }, select: { id: true, name: true, leader: { select: { id: true, name: true } }, leaderId: true, _count: { select: { members: true } } } });
  return teams;
}

export async function saveTeam(user: AuthUser, id: string | null, input: { name: string; leaderId?: string }) {
  assertCan(user, "team", id ? "EDIT" : "CREATE");
  if (input.leaderId && !(await db.user.findFirst({ where: { id: input.leaderId, status: "ACTIVE" } }))) throw new AppError("VALIDATION_ERROR", "Unknown team leader.");
  try {
    const t = id ? await db.team.update({ where: { id }, data: { name: input.name, leaderId: input.leaderId ?? null } }) : await db.team.create({ data: { name: input.name, leaderId: input.leaderId ?? null } });
    await audit({ actorId: user.id, action: id ? "team.update" : "team.create", entityType: "Team", entityId: t.id, after: { name: input.name, leaderId: input.leaderId ?? null } });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") throw new AppError("CONFLICT", "A team with that name already exists.");
    throw e;
  }
}
