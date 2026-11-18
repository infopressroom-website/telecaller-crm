import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardData } from "@/types/dashboard";

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      {children.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">{children}</ul>
      )}
    </Card>
  );
}

const Row = ({ main, sub, at }: { main: string; sub: string; at: Date }) => (
  <li className="flex items-start justify-between gap-3 py-2.5">
    <div className="min-w-0">
      <p className="truncate font-medium">{main}</p>
      <p className="truncate text-xs text-ink-muted">{sub}</p>
    </div>
    <time dateTime={at.toISOString()} className="shrink-0 text-xs text-ink-muted">{fmt.format(at)}</time>
  </li>
);

export function RecentActivity({ recent }: { recent: DashboardData["recent"] }) {
  return (
    <section aria-label="Recent activity" className="grid gap-4 lg:grid-cols-2">
      <Panel title="Recent assignments" empty="No assignments yet">
        {recent.assignments.map((a) => (
          <Row key={a.id} main={`${a.leadName} → ${a.toName ?? "Unassigned"}`} sub={`${a.leadCode} · ${a.method.replace(/_/g, " ").toLowerCase()}${a.actorName ? ` · by ${a.actorName}` : ""}`} at={a.at} />
        ))}
      </Panel>
      <Panel title="Recent conversions" empty="No conversions yet">
        {recent.conversions.map((c) => (
          <Row key={c.id} main={c.leadName} sub={`${c.leadCode} · converted by ${c.agentName}`} at={c.at} />
        ))}
      </Panel>
      <Panel title="Follow-up alerts (overdue)" empty="No overdue follow-ups">
        {recent.followUpAlerts.map((a) => (
          <Row key={a.id} main={a.leadName} sub={`${a.leadCode} · owner ${a.ownerName} · was due`} at={a.dueAt} />
        ))}
      </Panel>
      <Panel title="Your notifications" empty="No notifications">
        {recent.notifications.map((n) => (
          <Row key={n.id} main={n.title} sub={n.read ? "Read" : "Unread"} at={n.at} />
        ))}
      </Panel>
    </section>
  );
}
