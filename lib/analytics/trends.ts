// Trend calculation utilities for time series analysis

import type { TrendPoint } from "@/types/analytics";

/**
 * Calculate simple moving average
 * @param data Time series data points
 * @param window Number of periods to average
 */
export function movingAverage(data: TrendPoint[], window: number): TrendPoint[] {
  if (window <= 0 || window > data.length) return data;
  
  return data.map((point, index) => {
    if (index < window - 1) {
      return { ...point, movingAvg: undefined };
    }
    
    const slice = data.slice(index - window + 1, index + 1);
    const avg = slice.reduce((sum, p) => sum + p.value, 0) / window;
    
    return {
      ...point,
      movingAvg: Math.round(avg * 100) / 100,
    };
  });
}

/**
 * Simple linear regression for trend line
 * Returns slope and intercept: y = mx + b
 */
export function linearRegression(data: TrendPoint[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  
  data.forEach((point, index) => {
    const x = index;
    const y = point.value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

/**
 * Generate forecast points using linear regression
 * @param historicalData Past data points
 * @param periodsAhead Number of future periods to forecast
 */
export function forecastLinear(historicalData: TrendPoint[], periodsAhead: number): TrendPoint[] {
  if (historicalData.length < 2) return [];
  
  const { slope, intercept } = linearRegression(historicalData);
  const lastIndex = historicalData.length - 1;
  const lastDate = new Date(historicalData[lastIndex].date);
  
  const forecasts: TrendPoint[] = [];
  
  for (let i = 1; i <= periodsAhead; i++) {
    const futureIndex = lastIndex + i;
    const value = slope * futureIndex + intercept;
    
    // Calculate future date (assume daily data)
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + i);
    
    forecasts.push({
      date: futureDate.toISOString().split("T")[0],
      value: Math.max(0, Math.round(value)), // ensure non-negative
      forecast: true,
    });
  }
  
  return forecasts;
}

/**
 * Calculate growth rate between two periods
 */
export function growthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
