import { DAY_MS, dayKeyIST } from "./date-range";

export type DailyRow = { day: string; attempts: number; connected: number };
export type DailyPoint = { label: string; attempts: number; connected: number };

/** Fills days with no calls with zeros; ranges over 62 days are summed into 7-day buckets. */
export function fillSeries(rows: DailyRow[], from: Date, to: Date): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const daily: DailyPoint[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) {
    const key = dayKeyIST(new Date(t));
    const r = byDay.get(key);
    daily.push({ label: key, attempts: r?.attempts ?? 0, connected: r?.connected ?? 0 });
  }
  if (daily.length <= 62) return daily;

  const weekly: DailyPoint[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    weekly.push({
      label: chunk[0]?.label ?? "",
      attempts: chunk.reduce((n, d) => n + d.attempts, 0),
      connected: chunk.reduce((n, d) => n + d.connected, 0),
    });
  }
  return weekly;
}

export const percent = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
