import { createHmac, timingSafeEqual } from "node:crypto";

export function constantTimeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) {
    timingSafeEqual(x, x); // keep timing similar on length mismatch
    return false;
  }
  return timingSafeEqual(x, y);
}

const ipv4 = (s: string): number | null => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.some((n) => n > 255) ? null : (((p[0]! << 24) >>> 0) + (p[1]! << 16) + (p[2]! << 8) + p[3]!) >>> 0;
};

/** Empty list = no restriction. Supports exact addresses and IPv4 CIDR ranges (e.g. 203.0.113.0/24). */
export function ipAllowed(ip: string | null, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  if (!ip) return false;
  const client = ip.replace(/^::ffff:/, "");
  const c = ipv4(client);
  return allowed.some((rule) => {
    const [base, bits] = rule.trim().split("/");
    if (!base) return false;
    if (bits === undefined) return base === client;
    const b = ipv4(base);
    const n = Number(bits);
    if (c === null || b === null || !Number.isInteger(n) || n < 0 || n > 32) return false;
    const mask = n === 0 ? 0 : (~0 << (32 - n)) >>> 0;
    return (c & mask) >>> 0 === (b & mask) >>> 0;
  });
}

/** HMAC-SHA256 of the raw body with a shared secret, compared in constant time. */
export function verifyHmac(rawBody: string, headerValue: string | null, secret: string, encoding: "hex" | "base64"): boolean {
  if (!headerValue || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest(encoding);
  return constantTimeEqual(expected, headerValue.trim());
}
