/**
 * Notifications API endpoint
 * Returns user's notifications
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyNotifications } from "@/services/notification-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const notifications = await listMyNotifications(user);
    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
