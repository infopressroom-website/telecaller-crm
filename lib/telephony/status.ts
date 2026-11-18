import type { ProviderCallStatus } from "./provider";

export type CallStatusValue = "INITIATED" | "RINGING" | "IN_PROGRESS" | "COMPLETED" | "NOT_ANSWERED" | "BUSY" | "FAILED" | "CANCELED";

const MAP: Record<ProviderCallStatus, CallStatusValue | null> = {
  "in-progress": "IN_PROGRESS", completed: "COMPLETED", failed: "FAILED", busy: "BUSY", "no-answer": "NOT_ANSWERED", canceled: "CANCELED", unknown: null,
};
export const toCallStatus = (s: ProviderCallStatus): CallStatusValue | null => MAP[s];

const TERMINAL = new Set<CallStatusValue>(["COMPLETED", "NOT_ANSWERED", "BUSY", "FAILED", "CANCELED"]);
export const isTerminal = (s: string): boolean => TERMINAL.has(s as CallStatusValue);

const RANK: Record<CallStatusValue, number> = { INITIATED: 0, RINGING: 1, IN_PROGRESS: 2, COMPLETED: 3, NOT_ANSWERED: 3, BUSY: 3, FAILED: 3, CANCELED: 3 };

/**
 * Whether a provider status may replace what we have. A call never goes backwards (a late "in progress"
 * cannot reopen a finished call). The first provider-reported terminal status always wins, even over
 * the status guessed from the agent's outcome; later terminal events only fill in blanks.
 */
export function shouldApplyStatus(current: string, incoming: CallStatusValue, providerAlreadyFinal: boolean): boolean {
  if (providerAlreadyFinal) return false;
  if (isTerminal(incoming)) return true;
  return !isTerminal(current) && RANK[incoming] > (RANK[current as CallStatusValue] ?? 0);
}

const PROVIDER_TERMINAL = new Set(["completed", "failed", "busy", "no-answer", "canceled"]);
/** True when the stored provider status text is one of the provider's own final statuses. */
export const isProviderFinal = (externalStatus: string | null | undefined): boolean =>
  !!externalStatus && PROVIDER_TERMINAL.has(externalStatus.toLowerCase().replace(/_/g, "-").replace("cancelled", "canceled"));
