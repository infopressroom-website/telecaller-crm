import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listMyNotifications } from "@/services/notification-service";
import { NotificationsClient } from "./notifications-client";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listMyNotifications(user);
  return <NotificationsClient userId={user.id} initialNotifications={items} />;
}
