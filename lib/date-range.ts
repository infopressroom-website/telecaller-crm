// All dashboard dates are interpreted in India Standard Time (UTC+5:30, no daylight saving).
// Ranges are half-open: [from, to) — `to` is the start of the day AFTER the last included day.

export const IST_OFFSET_MS = 330 * 60 * 1000;
export const DAY_MS = 86_400_000;
export const MAX_RANGE_DAYS = 366;

export const PRESET_VALUES = ["today", "yesterday", "last7", "last30", "this_month", "custom"] as const;
export type Preset = (typeof PRESET_VALUES)[number];

export const PRESET_LABELS: Record<Preset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  this_month: "This month",
  custom: "Custom range",
};

export type ResolvedRange = { preset: Preset; from: Date; to: Date; label: string };

export const startOfDayIST = (d: Date) => {
  const s = new Date(d.getTime() + IST_OFFSET_MS);
  s.setUTCHours(0, 0, 0, 0);
  return new Date(s.getTime() - IST_OFFSET_MS);
};
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
/** "YYYY-MM-DD" of the IST calendar day containing d. */
export const dayKeyIST = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const parseISTDate = (s: string) => {
  const d = new Date(`${s}T00:00:00+05:30`);
  if (!DATE_RE.test(s) || Number.isNaN(d.getTime())) throw new RangeError("Enter valid dates for the custom range.");
  return d;
};

/** Throws RangeError for an invalid custom range. */
export function resolveRange(
  input: { preset: Preset; from?: string; to?: string },
  now: Date = new Date(),
): ResolvedRange {
  const today = startOfDayIST(now);
  const tomorrow = addDays(today, 1);
  const label = PRESET_LABELS[input.preset];

  switch (input.preset) {
    case "today":
      return { preset: "today", from: today, to: tomorrow, label };
    case "yesterday":
      return { preset: "yesterday", from: addDays(today, -1), to: today, label };
    case "last7":
      return { preset: "last7", from: addDays(today, -6), to: tomorrow, label };
    case "last30":
      return { preset: "last30", from: addDays(today, -29), to: tomorrow, label };
    case "this_month": {
      const s = new Date(now.getTime() + IST_OFFSET_MS);
      const from = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1) - IST_OFFSET_MS);
      return { preset: "this_month", from, to: tomorrow, label };
    }
    case "custom": {
      if (!input.from || !input.to) throw new RangeError("Pick both a start and an end date.");
      const from = parseISTDate(input.from);
      const lastDay = parseISTDate(input.to);
      if (from > lastDay) throw new RangeError("The start date must be on or before the end date.");
      const to = addDays(lastDay, 1);
      if ((to.getTime() - from.getTime()) / DAY_MS > MAX_RANGE_DAYS) {
        throw new RangeError(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
      }
      return { preset: "custom", from, to, label: `${input.from} to ${input.to}` };
    }
  }
}
