import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type DistributionSettings = { unworkedAfterHours: number };
const DEFAULTS: DistributionSettings = { unworkedAfterHours: 4 };

export async function getDistributionSettings(): Promise<DistributionSettings> {
  const row = await db.setting.findUnique({ where: { key: "distribution" } });
  const v = (row?.value ?? {}) as Partial<DistributionSettings>;
  const h = Number(v.unworkedAfterHours);
  return { unworkedAfterHours: Number.isFinite(h) ? Math.min(168, Math.max(1, Math.round(h))) : DEFAULTS.unworkedAfterHours };
}

export async function saveDistributionSettings(s: DistributionSettings) {
  await db.setting.upsert({
    where: { key: "distribution" },
    create: { key: "distribution", value: s as Prisma.InputJsonValue },
    update: { value: s as Prisma.InputJsonValue },
  });
}
