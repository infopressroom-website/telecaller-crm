import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Reserves `n` sequential codes (LD-000001, …). The upsert-increment takes a row lock,
 * so concurrent imports and manual creates can never receive the same code.
 */
export async function nextLeadCodes(tx: Prisma.TransactionClient, n: number): Promise<string[]> {
  if (n <= 0) return [];
  const row = await tx.counter.upsert({
    where: { key: "lead" },
    create: { key: "lead", value: n },
    update: { value: { increment: n } },
  });
  const start = row.value - n + 1;
  return Array.from({ length: n }, (_, i) => `LD-${String(start + i).padStart(6, "0")}`);
}
