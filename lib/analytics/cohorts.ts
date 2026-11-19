// Cohort analysis utilities

import type { CohortRow } from "@/types/analytics";
import { conversionRate } from "./metrics";

/**
 * Group timestamp into cohort period
 * @param date Date to group
 * @param groupBy Cohort period (week or month)
 */
export function getCohortKey(date: Date, groupBy: "week" | "month"): string {
  if (groupBy === "month") {
    return date.toISOString().slice(0, 7); // YYYY-MM
  } else {
    // For week, use ISO week format
    const year = date.getFullYear();
    const week = getISOWeek(date);
    return `${year}-W${week.toString().padStart(2, "0")}`;
  }
}

/**
 * Get ISO week number for a date
 */
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNumber;
}

/**
 * Format cohort key for display
 */
export function formatCohortLabel(key: string): string {
  if (key.includes("-W")) {
    // Week format: 2024-W12 -> Week 12, 2024
    const [year, week] = key.split("-W");
    return `Week ${week}, ${year}`;
  } else {
    // Month format: 2024-03 -> Mar 2024
    const date = new Date(`${key}-01`);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
}

/**
 * Calculate cohort metrics from raw data
 */
export function calculateCohortMetrics(
  cohort: string,
  totalLeads: number,
  converted: number,
  avgDaysToConvert: number | null
): CohortRow {
  return {
    cohort,
    totalLeads,
    converted,
    conversionRate: conversionRate(converted, totalLeads),
    avgDaysToConvert,
  };
}

/**
 * Sort cohorts chronologically (newest first)
 */
export function sortCohortsDesc(cohorts: CohortRow[]): CohortRow[] {
  return cohorts.sort((a, b) => b.cohort.localeCompare(a.cohort));
}
