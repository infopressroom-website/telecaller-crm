"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { markAllReadAction, markOneReadAction } from "@/app/actions/notifications";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useUserEvents } from "@/hooks/use-realtime";
import { useToast } from "@/components/ui/toast";

const when = new Intl.DateTimeFormat("en-IN", { 
  day: "numeric", 
  month: "short", 
  hour: "2-digit", 
  minute: "2-digit", 
  timeZone: "Asia/Kolkata" 
});

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

type NotificationsClientProps = {
  userId: string;
  initialNotifications: Notification[];
};

export function NotificationsClient({ userId, initialNotifications }: NotificationsClientProps) {
  const [items, setItems] = useState(initialNotifications);
  const { success } = useToast();
  
  // Refetch notifications from server
  const refetch = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Failed to refetch notifications:", error);
    }
  }, []);

  // Listen for real-time notification events
  useUserEvents(userId, {
    "notification.created": (data) => {
      // Add new notification to the list
      setItems(prev => [{
        id: data.id,
        title: data.title,
        body: data.body,
        link: data.link,
        readAt: null,
        createdAt: new Date(data.createdAt),
      }, ...prev]);
      
      // Show toast notification
      success(data.title);
    },
  });

  const unread = items.filter((i) => !i.readAt).length;

  return (
    <>
      <PageHeader 
        title="Notifications" 
        description="In-app alerts only. Email, SMS and WhatsApp are not connected." 
        actions={unread > 0 && (
          <form action={markAllReadAction}>
            <button 
              type="submit" 
              className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold"
              onClick={() => {
                // Optimistically mark all as read in UI
                setItems(prev => prev.map(item => ({ ...item, readAt: item.readAt || new Date() })));
              }}
            >
              Mark all as read
            </button>
          </form>
        )} 
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="No notifications yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li 
                key={n.id} 
                className={`flex flex-wrap items-start justify-between gap-3 py-3 ${n.readAt ? "" : "bg-blue-50/40"}`}
              >
                <div className="min-w-0 px-2">
                  <p className={`text-sm ${n.readAt ? "" : "font-semibold"}`}>
                    {n.link ? (
                      <Link href={n.link} className="text-brand-700 underline">
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </p>
                  {n.body && <p className="text-xs text-ink-muted">{n.body}</p>}
                  <time dateTime={n.createdAt.toISOString()} className="text-xs text-ink-muted">
                    {when.format(n.createdAt)}
                  </time>
                </div>
                {!n.readAt && (
                  <form action={markOneReadAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <button 
                      type="submit" 
                      className="min-h-11 px-3 text-xs text-brand-700 underline"
                      onClick={() => {
                        // Optimistically mark as read in UI
                        setItems(prev => prev.map(item => 
                          item.id === n.id ? { ...item, readAt: new Date() } : item
                        ));
                      }}
                    >
                      Mark read
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
