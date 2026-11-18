import { IST_OFFSET_MS } from "@/lib/date-range";

export type BreakSpan = { startedAt: Date; endedAt: Date | null };
const MIN = 60_000;

/** Whole minutes spent on breaks. An open break counts up to `until` (clock-out or now). */
export function breakMinutes(breaks: BreakSpan[], until: Date): number {
  return Math.round(breaks.reduce((sum, b) => sum + Math.max(0, ((b.endedAt ?? until).getTime() - b.startedAt.getTime()) / MIN), 0));
}

/** Time at work: clock-in to clock-out (or `now`) minus breaks. Never negative. */
export function workedMinutes(clockIn: Date | null, clockOut: Date | null, breaks: BreakSpan[], now: Date): number {
  if (!clockIn) return 0;
  const end = clockOut ?? now;
  return Math.max(0, Math.round((end.getTime() - clockIn.getTime()) / MIN) - breakMinutes(breaks, end));
}

/** Late = clock-in after shift start (HH:mm India time on that day) plus the grace period. */
export function isLateArrival(clockIn: Date, shiftStart: string, graceMinutes: number): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(shiftStart);
  if (!m) return false;
  const ist = new Date(clockIn.getTime() + IST_OFFSET_MS);
  const startUtcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), Number(m[1]), Number(m[2])) - IST_OFFSET_MS;
  return clockIn.getTime() > startUtcMs + graceMinutes * MIN;
}

export const hoursText = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
