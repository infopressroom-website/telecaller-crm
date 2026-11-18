export type Slab = { id: string; name: string; metric: string; minValue: number; maxValue: number | null; amountPaise: number };
export type IncentiveLine = { kind: "slab" | "conversion_bonus"; label: string; metric?: string; value: number; amountPaise: number; slabId?: string };
export type IncentiveCalc = { lines: IncentiveLine[]; totalPaise: number; metrics: Record<string, number>; conversionBonusPaise: number };

/**
 * Incentive = for each metric, the one slab whose range contains the achieved value (the highest minimum wins if
 * ranges overlap), plus a flat bonus per conversion. Every line is kept so the amount can be traced and audited.
 * All money is in paise (integers).
 */
export function calculateIncentive(metrics: Record<string, number>, slabs: Slab[], conversionBonusPaise: number): IncentiveCalc {
  const lines: IncentiveLine[] = [];
  for (const metric of new Set(slabs.map((s) => s.metric))) {
    const value = metrics[metric] ?? 0;
    const hit = slabs
      .filter((s) => s.metric === metric && value >= s.minValue && (s.maxValue === null || value <= s.maxValue))
      .sort((a, b) => b.minValue - a.minValue)[0];
    if (hit && hit.amountPaise > 0) lines.push({ kind: "slab", label: hit.name, metric, value, amountPaise: hit.amountPaise, slabId: hit.id });
  }
  const conversions = metrics.CONVERSIONS ?? 0;
  if (conversionBonusPaise > 0 && conversions > 0) lines.push({ kind: "conversion_bonus", label: `${conversions} conversion(s) × bonus`, value: conversions, amountPaise: conversions * conversionBonusPaise });
  return { lines, totalPaise: lines.reduce((n, l) => n + l.amountPaise, 0), metrics, conversionBonusPaise };
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const toPaise = (rupeeValue: number) => Math.round(rupeeValue * 100);
