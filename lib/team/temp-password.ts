import { randomInt } from "node:crypto";

const U = "ABCDEFGHJKLMNPQRSTUVWXYZ", L = "abcdefghijkmnpqrstuvwxyz", D = "23456789", ALL = U + L + D;
const pick = (s: string) => s[randomInt(s.length)]!;

/** 12 characters, always containing upper, lower and a digit (matches the password policy); no look-alike characters. */
export function generateTempPassword(): string {
  const chars = [pick(U), pick(L), pick(D), ...Array.from({ length: 9 }, () => pick(ALL))];
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join("");
}
