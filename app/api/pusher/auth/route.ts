/**
 * Pusher private channel authentication endpoint
 * Validates user session and authorizes access to private channels
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/pusher-server";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse Pusher auth request
    const body = await request.text();
    const params = new URLSearchParams(body);
    const socketId = params.get("socket_id");
    const channel = params.get("channel_name");

    if (!socketId || !channel) {
      return NextResponse.json(
        { error: "Missing socket_id or channel_name" },
        { status: 400 }
      );
    }

    // Verify user has access to this channel
    // User can only access their own private channel (user-{userId})
    const expectedChannel = `user-${user.id}`;
    if (channel !== expectedChannel && !channel.startsWith("team-") && channel !== "global") {
      return NextResponse.json(
        { error: "Forbidden: cannot access this channel" },
        { status: 403 }
      );
    }

    // Authenticate with Pusher
    const auth = authenticateUser(socketId, channel, user.id);
    
    if (!auth) {
      // Pusher not configured - gracefully fail
      return NextResponse.json(
        { error: "Real-time features not available" },
        { status: 503 }
      );
    }

    // Return Pusher auth response
    return new NextResponse(auth, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Pusher auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
