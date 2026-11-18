// Structured (JSON-per-line) logging with automatic redaction, so logs are safe to ship to a log service.
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SECRET_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|signature/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEY.test(k) ? "[redacted]" : redact(v, depth + 1)]));
}

function write(level: Level, msg: string, ctx?: Record<string, unknown>) {
  const min = (process.env.LOG_LEVEL as Level | undefined) ?? "info";
  if (ORDER[level] < (ORDER[min] ?? 20)) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(ctx ? { ctx: redact(ctx) } : {}) });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const log = {
  debug: (m: string, c?: Record<string, unknown>) => write("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => write("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => write("warn", m, c),
  /** Errors are logged by message only: stack traces and request data stay out of shared logs. */
  error: (m: string, e?: unknown) => write("error", m, e instanceof Error ? { error: e.message } : undefined),
};
