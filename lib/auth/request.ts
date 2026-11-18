import "server-only";
import { headers } from "next/headers";

export type ClientMeta = { ip: string | null; userAgent: string | null };

/** x-forwarded-for is only trustworthy behind your own reverse proxy / platform edge. */
export function getClientMeta(): ClientMeta {
  const h = headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}
