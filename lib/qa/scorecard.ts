import { z } from "zod";

// The QA scorecard. Weights add up to 100. Change the list to change the scorecard (existing reviews keep their stored ratings).
export const QA_CRITERIA = [
  { key: "greeting", label: "Greeting and introduction", weight: 10 },
  { key: "discovery", label: "Understanding the customer's needs", weight: 20 },
  { key: "knowledge", label: "Product / service knowledge", weight: 20 },
  { key: "objections", label: "Handling objections", weight: 15 },
  { key: "script", label: "Script and compliance adherence", weight: 15 },
  { key: "closing", label: "Closing and agreeing next steps", weight: 10 },
  { key: "communication", label: "Communication and tone", weight: 10 },
] as const;

export const RATING_LABELS = ["", "Poor", "Needs work", "Acceptable", "Good", "Excellent"] as const;

export const ratingsSchema = z.object(Object.fromEntries(QA_CRITERIA.map((c) => [c.key, z.coerce.number().int().min(1, `Rate “${c.label}”`).max(5)])) as Record<(typeof QA_CRITERIA)[number]["key"], z.ZodNumber>);
export type Ratings = z.infer<typeof ratingsSchema>;

/** Weighted score 0–100 (one decimal). Every criterion must be rated; otherwise null. */
export function computeScore(ratings: Partial<Record<string, number>>): number | null {
  let total = 0;
  for (const c of QA_CRITERIA) {
    const r = ratings[c.key];
    if (!Number.isInteger(r) || (r as number) < 1 || (r as number) > 5) return null;
    total += (c.weight * (r as number)) / 5;
  }
  return Math.round(total * 10) / 10;
}

export const scoreBand = (s: number | null): string => (s === null ? "—" : s >= 85 ? "Excellent" : s >= 70 ? "Good" : s >= 50 ? "Needs improvement" : "Poor");
