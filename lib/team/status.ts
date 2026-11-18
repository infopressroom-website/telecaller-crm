export type LiveStatus = "ON_CALL" | "BREAK" | "AVAILABLE" | "OFFLINE" | "ON_LEAVE";

export const LIVE_LABELS: Record<LiveStatus, string> = { ON_CALL: "On call", BREAK: "On break", AVAILABLE: "Available", OFFLINE: "Offline", ON_LEAVE: "On leave" };

/**
 * Status comes only from reliable records: attendance (clock-in/out, breaks, leave) and calls in progress.
 * There is deliberately NO "Away": browser inactivity does not prove someone isn't working.
 */
export function deriveLiveStatus(i: { attendanceStatus: string | null; clockedIn: boolean; clockedOut: boolean; onBreak: boolean; onCall: boolean }): LiveStatus {
  if (i.attendanceStatus === "ON_LEAVE" || i.attendanceStatus === "HOLIDAY") return "ON_LEAVE";
  if (!i.clockedIn || i.clockedOut) return "OFFLINE";
  if (i.onBreak) return "BREAK";
  if (i.onCall) return "ON_CALL";
  return "AVAILABLE";
}
