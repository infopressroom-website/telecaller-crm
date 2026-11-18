export type Point = { label: string; attempts: number; connected: number };
export type Grouping = "day" | "week" | "month";

const DAY = 86_400_000;
/** Monday of the week containing the given "YYYY-MM-DD" date. */
export function mondayOf(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  const dow = new Date(t).getUTCDay();
  return new Date(t - ((dow + 6) % 7) * DAY).toISOString().slice(0, 10);
}

/** Sums daily points into weeks (Mon–Sun) or calendar months. Labels that aren't dates are kept as they are. */
export function groupSeries(points: Point[], group: Grouping): Point[] {
  if (group === "day") return points;
  const out = new Map<string, Point>();
  for (const p of points) {
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(p.label);
    const key = !isDate ? p.label : group === "week" ? mondayOf(p.label) : p.label.slice(0, 7);
    const cur = out.get(key) ?? { label: key, attempts: 0, connected: 0 };
    cur.attempts += p.attempts;
    cur.connected += p.connected;
    out.set(key, cur);
  }
  return [...out.values()];
}
