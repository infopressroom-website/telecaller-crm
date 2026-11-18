import type { Metadata } from "next";
import Link from "next/link";
import { markAllReadAction, markOneReadAction } from "@/app/actions/notifications";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { listMyNotifications } from "@/services/notification-service";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listMyNotifications(user);
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <>
      <PageHeader title="Notifications" description="In-app alerts only. Email, SMS and WhatsApp are not connected." actions={unread > 0 && <form action={markAllReadAction}><button type="submit" className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold">Mark all as read</button></form>} />
      <Card>
        {items.length === 0 ? <EmptyState title="No notifications yet" /> : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id} className={`flex flex-wrap items-start justify-between gap-3 py-3 ${n.readAt ? "" : "bg-blue-50/40"}`}>
                <div className="min-w-0 px-2">
                  <p className={`text-sm ${n.readAt ? "" : "font-semibold"}`}>{n.link ? <Link href={n.link} className="text-brand-700 underline">{n.title}</Link> : n.title}</p>
                  {n.body && <p className="text-xs text-ink-muted">{n.body}</p>}
                  <time dateTime={n.createdAt.toISOString()} className="text-xs text-ink-muted">{when.format(n.createdAt)}</time>
                </div>
                {!n.readAt && <form action={markOneReadAction}><input type="hidden" name="id" value={n.id} /><button type="submit" className="min-h-11 px-3 text-xs text-brand-700 underline">Mark read</button></form>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
