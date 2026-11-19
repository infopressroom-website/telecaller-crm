// Metric calculation utilities for analytics

/**
 * Calculate percentage change between two values
 */
export function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Determine trend direction
 */
export function getTrend(change: number): "up" | "down" | "flat" {
  if (Math.abs(change) < 0.5) return "flat"; // less than 0.5% change
  return change > 0 ? "up" : "down";
}

/**
 * Calculate conversion rate as percentage
 */
export function conversionRate(converted: number, total: number): number {
  if (total === 0) return 0;
  return (converted / total) * 100;
}

/**
 * Calculate average from array of numbers
 */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Round to specified decimal places
 */
export function round(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}
