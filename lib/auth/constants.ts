// Edge-safe (imported by middleware): no Node or Prisma imports here.
export const SESSION_COOKIE = "crm_session";
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000; // hard expiry: 12h
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000; // idle expiry: 2h without activity
export const SESSION_TOUCH_MS = 5 * 60 * 1000; // refresh lastSeenAt at most every 5 min
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const RESET_TOKEN_MS = 60 * 60 * 1000; // 1h
