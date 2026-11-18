"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, Menu, Search, User, X } from "lucide-react";
import { ADMIN_NAV, TELECALLER_NAV, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";

type Variant = "admin" | "telecaller";

function NavList({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ label, href, icon: Icon, ready }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        const base = "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium";
        return (
          <li key={href}>
            {ready ? (
              <Link
                href={href}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(base, active ? "bg-brand text-white" : "text-navy-300 hover:bg-navy-800 hover:text-white")}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <span className={cn(collapsed && "sr-only")}>{label}</span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                title={`${label} — coming in a later phase`}
                className={cn(base, "cursor-not-allowed text-navy-300/50")}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <span className={cn(collapsed && "sr-only")}>{label}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type AppShellProps = {
  variant: Variant;
  user: { name: string; roleName: string };
  /** "resource:ACTION" strings; nav items are hidden when VIEW is missing (UI convenience only; the server enforces access) */
  permissions: string[];
  logoutAction: () => Promise<void>;
  unread?: number;
  children: React.ReactNode;
};

export function AppShell({ variant, user, permissions, logoutAction, unread = 0, children }: AppShellProps) {
  const items = (variant === "admin" ? ADMIN_NAV : TELECALLER_NAV).filter(
    (i) => !i.resource || permissions.includes(`${i.resource}:VIEW`),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const brand = (
    <div className="flex items-center gap-2 px-3 pb-5 pt-1 font-bold text-white">
      <span className="h-7 w-7 shrink-0 rounded-lg bg-brand" aria-hidden />
      <span className={cn(collapsed && "lg:sr-only")}>Telecaller CRM</span>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        aria-label="Main navigation"
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col bg-navy-900 p-3 transition-[width] lg:flex",
          collapsed ? "w-[72px]" : "w-60",
        )}
      >
        {brand}
        <nav className="flex-1 overflow-y-auto"><NavList items={items} collapsed={collapsed} /></nav>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-navy-300 hover:bg-navy-800 hover:text-white"
        >
          {collapsed ? <ChevronRight className="h-[18px] w-[18px]" aria-hidden /> : <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />}
          <span className={cn(collapsed && "sr-only")}>Collapse</span>
        </button>
      </aside>

      {/* Mobile / tablet drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-navy-900 p-3">
            <button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="absolute right-2 top-2 grid h-11 w-11 place-items-center text-navy-300">
              <X className="h-5 w-5" aria-hidden />
            </button>
            <div className="flex items-center gap-2 px-3 pb-5 pt-1 font-bold text-white">
              <span className="h-7 w-7 rounded-lg bg-brand" aria-hidden />Telecaller CRM
            </div>
            <nav className="flex-1 overflow-y-auto"><NavList items={items} collapsed={false} onNavigate={() => setDrawerOpen(false)} /></nav>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-line bg-white px-4 lg:px-6">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="grid h-11 w-11 place-items-center rounded-lg border border-line lg:hidden">
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="relative min-w-40 max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            {/* Disabled until global search is implemented (no decorative controls). */}
            <input
              type="search"
              disabled
              aria-label="Global search (coming soon)"
              title="Global search arrives with lead management"
              placeholder="Search leads, name or mobile"
              className="h-10 w-full cursor-not-allowed rounded-lg border border-line bg-slate-50 pl-9 pr-3 text-sm"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/notifications" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} className="relative grid h-11 w-11 place-items-center rounded-lg border border-line text-ink">
              <Bell className="h-[18px] w-[18px]" aria-hidden />
              {unread > 0 && <span aria-hidden className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-700 px-1 text-center text-[11px] font-bold leading-5 text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <details className="relative">
              <summary aria-label="Account menu" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-lg border border-line [&::-webkit-details-marker]:hidden">
                <User className="h-[18px] w-[18px]" aria-hidden />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-line bg-white p-2 shadow-md">
                <p className="px-3 py-2 text-sm">
                  <span className="block font-semibold">{user.name}</span>
                  <span className="text-ink-muted">{user.roleName}</span>
                </p>
                <Link href="/change-password" className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-slate-100">Change password</Link>
                <form action={logoutAction}>
                  <button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-3 text-sm hover:bg-slate-100">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-5 p-4 lg:p-6">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
