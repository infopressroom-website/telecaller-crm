// Single source of truth for what each dashboard number means. Shown on the dashboard and in docs/METRICS.md.
export type MetricBasis = "period" | "snapshot";

export const METRIC_DEFINITIONS: { label: string; basis: MetricBasis; definition: string }[] = [
  { label: "Total leads", basis: "snapshot", definition: "All non-archived leads you can access, regardless of the date filter." },
  { label: "New leads today", basis: "snapshot", definition: "Leads created today (IST). Always today; ignores the date filter." },
  { label: "Assigned leads", basis: "snapshot", definition: "Leads that currently have an owner." },
  { label: "Call attempts", basis: "period", definition: "Call records created in the selected period." },
  { label: "Connected calls", basis: "period", definition: "Call attempts whose outcome is marked as 'connected' (Connected, Interested, Not Interested, Callback Requested, Converted)." },
  { label: "Interested leads", basis: "snapshot", definition: "Leads whose current status is Interested." },
  { label: "Follow-ups due", basis: "snapshot", definition: "Pending follow-ups due today or already overdue." },
  { label: "Converted leads", basis: "period", definition: "Distinct leads that, in the period, had a call with the 'Converted' outcome or were changed to the Converted status." },
  { label: "Active telecallers", basis: "snapshot", definition: "Active users with the Telecaller role. This is not attendance or live presence." },
  { label: "Pending tasks", basis: "snapshot", definition: "Tasks that are Open or In progress." },
];
