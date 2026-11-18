import { IST_OFFSET_MS, addDays, startOfDayIST } from "@/lib/date-range";

export type PeriodKind = "DAILY" | "WEEKLY" | "MONTHLY";

/** Monday 00:00 India time of the week containing `now`. */
export function weekStartIST(now: Date): Date {
  const day = startOfDayIST(now);
  const dow = new Date(day.getTime() + IST_OFFSET_MS).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** The current window for a target period, half-open [from, to), in India time. */
export function currentWindow(period: PeriodKind, now: Date): { from: Date; to: Date } {
  if (period === "DAILY") { const f = startOfDayIST(now); return { from: f, to: addDays(f, 1) }; }
  if (period === "WEEKLY") { const f = weekStartIST(now); return { from: f, to: addDays(f, 7) }; }
  const s = new Date(now.getTime() + IST_OFFSET_MS);
  return { from: new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1) - IST_OFFSET_MS), to: new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1) - IST_OFFSET_MS) };
}

/** Which kind of target the dashboard period filter lines up with (null = no fair comparison). */
export function periodKindForPreset(preset: string): PeriodKind | null {
  if (preset === "today" || preset === "yesterday") return "DAILY";
  if (preset === "last7") return "WEEKLY";
  if (preset === "this_month") return "MONTHLY";
  return null;
}

export const percentOf = (value: number, target: number): number | null => (target > 0 ? Math.round((value / target) * 1000) / 10 : null);
