import { cn } from "@/lib/utils";

// Text/background pairs chosen to meet WCAG AA contrast.
const TONES = {
  neutral: "bg-slate-200 text-slate-800",
  info: "bg-brand-100 text-brand-700",
  success: "bg-green-100 text-green-900",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-900",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone])}>
      {children}
    </span>
  );
}

/** Maps lead statuses to tones in one place so every screen colours them identically. */
export const LEAD_STATUS_TONE: Record<string, BadgeTone> = {
  NEW: "info", ASSIGNED: "info", ATTEMPTED: "neutral", CONNECTED: "info",
  INTERESTED: "success", FOLLOW_UP: "warning", QUALIFIED: "success", CONVERTED: "success",
  LOST: "danger", INVALID: "danger", DND: "danger",
};
