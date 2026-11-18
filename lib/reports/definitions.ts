export type ReportKey = "calling" | "performance" | "teams" | "sources" | "campaigns" | "funnel" | "followups" | "attendance" | "productivity" | "qa";

export const REPORTS: { key: ReportKey; title: string; description: string; needs: [string, string][]; grouped?: boolean }[] = [
  { key: "calling", title: "Calling activity", description: "Calls and connected calls per day, week or month.", needs: [], grouped: true },
  { key: "performance", title: "Telecaller performance", description: "Calls, connections, interested leads, follow-ups, conversions, talk time and QA score per telecaller.", needs: [["performance", "VIEW"]] },
  { key: "teams", title: "Team comparison", description: "Attempts, connected calls and conversions per team.", needs: [] },
  { key: "sources", title: "Lead source performance", description: "Leads created in the period by source and how many converted.", needs: [] },
  { key: "campaigns", title: "Campaign conversion", description: "Leads created in the period by campaign and how many converted.", needs: [] },
  { key: "funnel", title: "Conversion funnel", description: "How leads created in the period progressed: contacted, connected, interested, converted.", needs: [] },
  { key: "followups", title: "Follow-up completion", description: "Follow-ups due in the period by status and the completion rate.", needs: [] },
  { key: "attendance", title: "Attendance (monthly)", description: "Present, absent, leave, late and hours worked for the month of the start date.", needs: [["attendance", "VIEW"]] },
  { key: "productivity", title: "Productivity", description: "Calls per hour worked, from attendance records and call records.", needs: [["attendance", "VIEW"], ["performance", "VIEW"]] },
  { key: "qa", title: "QA scores", description: "Number of reviews and average, lowest and highest score per telecaller.", needs: [["qa", "VIEW"]] },
];

export const isReportKey = (k: string): k is ReportKey => REPORTS.some((r) => r.key === k);

export type ReportTable = { title: string; subtitle: string; columns: { key: string; label: string }[]; rows: Record<string, string | number | null>[] };
