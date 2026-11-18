import "server-only";
import { Prisma, type AttendanceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { breakMinutes, isLateArrival, workedMinutes } from "@/lib/attendance/calc";
import { addDays, dayKeyIST } from "@/lib/date-range";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "./audit-service";
import { directoryWhere } from "./employee-service";

const dateOf = (key: string) => new Date(`${key}T00:00:00Z`);
const todayKey = (now = new Date()) => dayKeyIST(now);

// Attendance is its own record. It is never inferred from calls, page visits or browser activity.

export async function getMyToday(user: AuthUser) {
  assertCan(user, "attendance", "VIEW");
  const now = new Date();
  const row = await db.attendance.findUnique({ where: { userId_date: { userId: user.id, date: dateOf(todayKey(now)) } }, include: { breaks: { orderBy: { startedAt: "asc" } } } });
  const shift = await currentShift(user.id, now);
  return {
    row, shift,
    clockedIn: !!row?.clockInAt, clockedOut: !!row?.clockOutAt, onBreak: !!row?.breaks.some((b) => !b.endedAt),
    workedMin: row ? workedMinutes(row.clockInAt, row.clockOutAt, row.breaks, now) : 0,
    breakMin: row ? breakMinutes(row.breaks, row.clockOutAt ?? now) : 0,
  };
}

async function currentShift(userId: string, now: Date) {
  const us = await db.userShift.findFirst({ where: { userId, validFrom: { lte: now } }, orderBy: { validFrom: "desc" }, include: { shift: true } });
  return us?.shift ?? null;
}

export async function clockIn(user: AuthUser) {
  assertCan(user, "attendance", "CREATE");
  const now = new Date();
  const date = dateOf(todayKey(now));
  const shift = await currentShift(user.id, now);
  const late = shift ? isLateArrival(now, shift.startTime, shift.graceMinutes) : false;
  try {
    await db.$transaction(async (tx) => {
      const ex = await tx.attendance.findUnique({ where: { userId_date: { userId: user.id, date } } });
      if (ex?.clockInAt) throw new AppError("CONFLICT", "You're already clocked in today.");
      if (ex?.status === "ON_LEAVE" || ex?.status === "HOLIDAY") throw new AppError("CONFLICT", `You're marked ${ex.status === "ON_LEAVE" ? "on leave" : "on a holiday"} today. Ask HR if that's wrong.`);
      if (ex) await tx.attendance.update({ where: { id: ex.id }, data: { status: "PRESENT", clockInAt: now, isLate: late } });
      else await tx.attendance.create({ data: { userId: user.id, date, status: "PRESENT", clockInAt: now, isLate: late } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError("CONFLICT", "You're already clocked in today.");
    throw e;
  }
}

async function openRow(userId: string) {
  const row = await db.attendance.findUnique({ where: { userId_date: { userId, date: dateOf(todayKey()) } }, include: { breaks: true } });
  if (!row?.clockInAt) throw new AppError("CONFLICT", "Clock in first.");
  if (row.clockOutAt) throw new AppError("CONFLICT", "You've already clocked out today.");
  return row;
}

export async function clockOut(user: AuthUser) {
  assertCan(user, "attendance", "CREATE");
  const row = await openRow(user.id);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.attendanceBreak.updateMany({ where: { attendanceId: row.id, endedAt: null }, data: { endedAt: now } }); // an open break ends with the day
    const breaks = await tx.attendanceBreak.findMany({ where: { attendanceId: row.id } });
    const won = await tx.attendance.updateMany({ where: { id: row.id, clockOutAt: null }, data: { clockOutAt: now, breakMinutes: breakMinutes(breaks, now) } });
    if (won.count !== 1) throw new AppError("CONFLICT", "You've already clocked out today.");
  });
}

export async function startBreak(user: AuthUser) {
  assertCan(user, "attendance", "CREATE");
  const row = await openRow(user.id);
  if (row.breaks.some((b) => !b.endedAt)) throw new AppError("CONFLICT", "You're already on a break.");
  await db.attendanceBreak.create({ data: { attendanceId: row.id } });
}

export async function endBreak(user: AuthUser) {
  assertCan(user, "attendance", "CREATE");
  const row = await openRow(user.id);
  const open = row.breaks.find((b) => !b.endedAt);
  if (!open) throw new AppError("CONFLICT", "You're not on a break.");
  const now = new Date();
  await db.attendanceBreak.updateMany({ where: { id: open.id, endedAt: null }, data: { endedAt: now } });
  const breaks = await db.attendanceBreak.findMany({ where: { attendanceId: row.id } });
  await db.attendance.update({ where: { id: row.id }, data: { breakMinutes: breakMinutes(breaks, now) } });
}

export async function myHistory(user: AuthUser, days = 31) {
  assertCan(user, "attendance", "VIEW");
  const rows = await db.attendance.findMany({ where: { userId: user.id, date: { gte: dateOf(dayKeyIST(addDays(new Date(), -days))) } }, orderBy: { date: "desc" }, include: { breaks: true } });
  const now = new Date();
  return rows.map((r) => ({ ...r, workedMin: workedMinutes(r.clockInAt, r.clockOutAt, r.breaks, now) }));
}

// ───────────── HR / manager views ─────────────

const TRACKED = ["TELECALLER", "TEAM_LEADER"];

export async function listDaily(user: AuthUser, dayKey: string) {
  assertCan(user, "attendance", "VIEW");
  if (user.roleKey === "TELECALLER") return [];
  const people = await db.user.findMany({ where: { AND: [await directoryWhere(user), { status: "ACTIVE", role: { key: { in: TRACKED } } }] }, select: { id: true, name: true, team: { select: { name: true } } }, orderBy: { name: "asc" }, take: 500 });
  const rows = await db.attendance.findMany({ where: { date: dateOf(dayKey), userId: { in: people.map((p) => p.id) } }, include: { breaks: true } });
  const by = new Map(rows.map((r) => [r.userId, r]));
  const now = new Date();
  return people.map((p) => {
    const r = by.get(p.id);
    return { userId: p.id, name: p.name, team: p.team?.name ?? null, status: r?.status ?? null, clockInAt: r?.clockInAt ?? null, clockOutAt: r?.clockOutAt ?? null, isLate: r?.isLate ?? false, workedMin: r ? workedMinutes(r.clockInAt, r.clockOutAt, r.breaks, now) : 0, notes: r?.notes ?? null };
  });
}

export async function markRange(user: AuthUser, input: { userId: string; status: "ON_LEAVE" | "ABSENT" | "HOLIDAY" | "HALF_DAY"; from: string; to: string; notes?: string }) {
  assertCan(user, "attendance", "MANAGE");
  const person = await db.user.findFirst({ where: { AND: [{ id: input.userId }, await directoryWhere(user)] } });
  if (!person) throw notFound("Employee");
  const start = dateOf(input.from), end = dateOf(input.to);
  if (end < start) throw new AppError("VALIDATION_ERROR", "The end date must be on or after the start date.");
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > 31) throw new AppError("VALIDATION_ERROR", "Mark at most 31 days at a time.");
  let changed = 0, kept = 0;
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * 86_400_000);
    const ex = await db.attendance.findUnique({ where: { userId_date: { userId: input.userId, date } } });
    if (ex?.clockInAt) { kept++; continue; } // a real clock-in is never overwritten
    if (ex) await db.attendance.update({ where: { id: ex.id }, data: { status: input.status as AttendanceStatus, notes: input.notes ?? ex.notes } });
    else await db.attendance.create({ data: { userId: input.userId, date, status: input.status as AttendanceStatus, notes: input.notes ?? null } });
    changed++;
  }
  await audit({ actorId: user.id, action: "attendance.mark", entityType: "User", entityId: input.userId, after: { status: input.status, from: input.from, to: input.to, changed, kept } });
  return { changed, kept };
}

export async function monthlyReport(user: AuthUser, month: string) {
  assertCan(user, "attendance", "VIEW");
  const [y, m] = month.split("-").map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - 1, 1)), end = new Date(Date.UTC(y, m, 1));
  const where = { AND: [await directoryWhere(user), { status: "ACTIVE" as const, role: { key: { in: TRACKED } } }] };
  const people = user.roleKey === "TELECALLER" ? [{ id: user.id, name: user.name }] : await db.user.findMany({ where, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 });
  const rows = await db.attendance.findMany({ where: { userId: { in: people.map((p) => p.id) }, date: { gte: start, lt: end } }, include: { breaks: true } });
  const now = new Date();
  return people.map((p) => {
    const mine = rows.filter((r) => r.userId === p.id);
    return {
      name: p.name,
      present: mine.filter((r) => r.status === "PRESENT").length, halfDay: mine.filter((r) => r.status === "HALF_DAY").length,
      absent: mine.filter((r) => r.status === "ABSENT").length, leave: mine.filter((r) => r.status === "ON_LEAVE").length,
      late: mine.filter((r) => r.isLate).length,
      workedMin: mine.reduce((n, r) => n + (r.clockOutAt ? workedMinutes(r.clockInAt, r.clockOutAt, r.breaks, now) : 0), 0),
    };
  });
}

// ───────────── shifts ─────────────

export async function listShifts(user: AuthUser) {
  assertCan(user, "attendance", "VIEW");
  return db.shift.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } });
}

export async function saveShift(user: AuthUser, input: { name: string; startTime: string; endTime: string; graceMinutes: number }, id?: string) {
  assertCan(user, "attendance", "MANAGE");
  try {
    const s = id ? await db.shift.update({ where: { id }, data: input }) : await db.shift.create({ data: input });
    await audit({ actorId: user.id, action: id ? "shift.update" : "shift.create", entityType: "Shift", entityId: s.id, after: input });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError("CONFLICT", "A shift with that name already exists.");
    throw e;
  }
}

export async function assignShift(user: AuthUser, userId: string, shiftId: string) {
  assertCan(user, "attendance", "MANAGE");
  const [person, shift] = await Promise.all([db.user.findFirst({ where: { AND: [{ id: userId }, await directoryWhere(user)] } }), db.shift.findUnique({ where: { id: shiftId } })]);
  if (!person || !shift) throw notFound("Employee or shift");
  await db.userShift.create({ data: { userId, shiftId } });
  await audit({ actorId: user.id, action: "shift.assign", entityType: "User", entityId: userId, after: { shiftId } });
}

export async function shiftFormOptions(user: AuthUser) {
  assertCan(user, "attendance", "VIEW");
  const [people, shifts] = await Promise.all([
    db.user.findMany({ where: { AND: [await directoryWhere(user), { status: "ACTIVE", role: { key: { in: TRACKED } } }] }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    db.shift.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { people, shifts };
}

// ───────────── live status ─────────────

export async function liveStatus(user: AuthUser) {
  assertCan(user, "attendance", "VIEW");
  const { deriveLiveStatus } = await import("@/lib/team/status");
  const people = await db.user.findMany({ where: { AND: [await directoryWhere(user), { status: "ACTIVE", role: { key: { in: TRACKED } } }] }, select: { id: true, name: true, team: { select: { name: true } } }, orderBy: { name: "asc" }, take: 500 });
  const ids = people.map((p) => p.id);
  const [att, calls] = await Promise.all([
    db.attendance.findMany({ where: { userId: { in: ids }, date: dateOf(todayKey()) }, include: { breaks: { where: { endedAt: null } } } }),
    db.callLog.findMany({ where: { agentId: { in: ids }, status: { in: ["INITIATED", "RINGING", "IN_PROGRESS"] }, createdAt: { gte: new Date(Date.now() - 3 * 3_600_000) } }, distinct: ["agentId"], select: { agentId: true } }),
  ]);
  const a = new Map(att.map((r) => [r.userId, r]));
  const onCall = new Set(calls.map((c) => c.agentId));
  return people.map((p) => {
    const r = a.get(p.id);
    return { id: p.id, name: p.name, team: p.team?.name ?? null, status: deriveLiveStatus({ attendanceStatus: r?.status ?? null, clockedIn: !!r?.clockInAt, clockedOut: !!r?.clockOutAt, onBreak: !!r?.breaks.length, onCall: onCall.has(p.id) }), since: r?.clockInAt ?? null };
  });
}
