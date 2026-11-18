import type { DailyPoint } from "@/lib/dashboard-series";

export type { DailyPoint };
export type Kpi = { key: string; label: string; value: number; basis: "period" | "snapshot"; note?: string };
export type FunnelStage = { stage: string; count: number };
export type GroupRow = { name: string; leads: number; converted: number; conversionRate: number | null };
export type AgentRow = { name: string; team: string; attempts: number; connected: number; conversions: number; connectRate: number | null };
export type TeamRow = { name: string; attempts: number; connected: number; conversions: number };
export type FollowUpSummary = {
  completed: number; missed: number; overduePending: number; upcomingPending: number; rescheduled: number;
  completionRate: number | null;
};
export type RecentAssignment = { id: string; leadName: string; leadCode: string; toName: string | null; actorName: string | null; method: string; at: Date };
export type RecentConversion = { id: string; leadName: string; leadCode: string; agentName: string; at: Date };
export type FollowUpAlert = { id: string; leadName: string; leadCode: string; ownerName: string; dueAt: Date };
export type NotificationItem = { id: string; title: string; at: Date; read: boolean };

export type DashboardData = {
  kpis: Kpi[];
  daily: DailyPoint[];
  funnel: FunnelStage[];
  sources: GroupRow[];
  campaigns: GroupRow[];
  agents: AgentRow[];
  teams: TeamRow[];
  followUps: FollowUpSummary;
  recent: {
    assignments: RecentAssignment[];
    conversions: RecentConversion[];
    followUpAlerts: FollowUpAlert[];
    notifications: NotificationItem[];
  };
};

export type FilterOptions = { teams: { id: string; name: string }[]; campaigns: { id: string; name: string }[] };
