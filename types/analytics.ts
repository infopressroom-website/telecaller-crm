// Analytics-specific types

export type AnalyticsFilters = {
  range: { from: Date; to: Date; label: string; preset: string };
  teamId?: string;
  campaignId?: string;
  sourceId?: string;
  groupBy?: "day" | "week" | "month";
  notice?: string;
};

export type TrendPoint = {
  date: string;
  value: number;
  movingAvg?: number;
  forecast?: boolean;
};

export type HeatmapCell = {
  hour: number;
  day: number;
  value: number;
  label: string;
};

export type CohortRow = {
  cohort: string;
  totalLeads: number;
  converted: number;
  conversionRate: number;
  avgDaysToConvert: number | null;
};

export type FunnelStageAdvanced = {
  stage: string;
  count: number;
  percentage: number;
  avgTimeInStage: number | null; // days
  conversionRate: number | null; // to next stage
};

export type ChannelPerformance = {
  name: string;
  leads: number;
  converted: number;
  conversionRate: number;
  avgTimeToConvert: number | null;
};

export type TeamTrend = {
  teamName: string;
  data: TrendPoint[];
};

export type AgentPerformance = {
  agentId: string;
  agentName: string;
  teamName: string;
  calls: number;
  connected: number;
  converted: number;
  avgCallDuration: number;
  connectRate: number;
  conversionRate: number;
};

export type KPIComparison = {
  label: string;
  current: number;
  previous: number;
  change: number; // percentage
  trend: "up" | "down" | "flat";
};

export type CallPatternData = {
  hour: number;
  attempts: number;
  connected: number;
  connectRate: number;
};

export type AnalyticsSummary = {
  // Overview metrics
  overview: {
    totalLeads: number;
    conversionRate: number;
    callsToday: number;
    activeFollowUps: number;
  };
  
  // KPI comparisons (current period vs previous period)
  comparisons: KPIComparison[];
  
  // Lead funnel with advanced metrics
  funnel: FunnelStageAdvanced[];
  
  // Call patterns (hourly breakdown)
  callPatterns: CallPatternData[];
  
  // Cohort analysis
  cohorts: CohortRow[];
  
  // Channel performance
  channels: ChannelPerformance[];
  
  // Team performance trends
  teamTrends: TeamTrend[];
  
  // Top performers
  topAgents: AgentPerformance[];
  
  // Trend data for main chart
  trends: {
    leads: TrendPoint[];
    calls: TrendPoint[];
    conversions: TrendPoint[];
  };
};
