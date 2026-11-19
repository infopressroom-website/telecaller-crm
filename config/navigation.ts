import {
  BarChart3, CalendarCheck, CalendarClock, FileBarChart, Headset, Home, LayoutDashboard, ListChecks,
  PhoneCall, Settings, Shuffle, ShieldCheck, TrendingUp, Users, UsersRound, Zap, type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** false = page not built yet; rendered disabled instead of linking to a 404 */
  ready: boolean;
  /** permission resource required to see this item (VIEW) */
  resource?: string;
};

export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", resource: "dashboard", href: "/dashboard", icon: LayoutDashboard, ready: true },
  { label: "Analytics", resource: "analytics", href: "/analytics", icon: BarChart3, ready: true },
  { label: "Leads", resource: "lead", href: "/leads", icon: Users, ready: true },
  { label: "Lead Distribution", resource: "distribution", href: "/distribution", icon: Shuffle, ready: true },
  { label: "Team & employees", resource: "user", href: "/team", icon: Headset, ready: true },
  { label: "Calls", resource: "call", href: "/calls", icon: PhoneCall, ready: true },
  { label: "Follow-ups", resource: "followup", href: "/follow-ups", icon: CalendarClock, ready: true },
  { label: "Tasks", resource: "task", href: "/tasks", icon: ListChecks, ready: false },
  { label: "Teams", resource: "team", href: "/team/teams", icon: UsersRound, ready: true },
  { label: "Attendance", resource: "attendance", href: "/attendance", icon: CalendarCheck, ready: true },
  { label: "Performance", resource: "performance", href: "/performance", icon: TrendingUp, ready: true },
  { label: "QA", resource: "qa", href: "/qa", icon: ShieldCheck, ready: true },
  { label: "Reports", resource: "report", href: "/reports", icon: FileBarChart, ready: true },
  { label: "Automation", resource: "automation", href: "/automation", icon: Zap, ready: true },
  { label: "Settings", resource: "settings", href: "/settings", icon: Settings, ready: true },
  { label: "Audit log", resource: "audit", href: "/audit", icon: ShieldCheck, ready: true },
];

// Deliberately short: telecallers get a simple, low-clutter menu.
export const TELECALLER_NAV: NavItem[] = [
  { label: "My Workspace", href: "/workspace", icon: Home, ready: true },
  { label: "My Leads", href: "/leads", icon: Users, ready: true },
  { label: "My Follow-ups", href: "/follow-ups", icon: CalendarClock, ready: true },
  { label: "My Attendance", href: "/attendance", icon: CalendarCheck, ready: true },
  { label: "My Calls", href: "/calls", icon: PhoneCall, ready: true },
  { label: "My Performance", href: "/performance", icon: TrendingUp, ready: true },
];
