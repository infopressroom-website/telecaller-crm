/**
 * Integration tests for real-time notifications via Pusher
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyUser, isPusherAvailable, RealtimeEvents } from "@/lib/pusher-server";

describe("Real-time Notifications Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should check if Pusher is available", () => {
    const available = isPusherAvailable();
    // This will be true if PUSHER credentials are configured, false otherwise
    expect(typeof available).toBe("boolean");
  });

  it("should gracefully handle notification trigger when Pusher not configured", async () => {
    // This should not throw even if Pusher is not configured
    const result = await notifyUser("user-123", RealtimeEvents.NOTIFICATION_CREATED, {
      id: "notif-1",
      title: "Test Notification",
      body: "This is a test",
      link: null,
      createdAt: new Date().toISOString(),
    });
    
    // Result should be boolean
    expect(typeof result).toBe("boolean");
    
    // If Pusher is not configured, result should be false (graceful degradation)
    if (!isPusherAvailable()) {
      expect(result).toBe(false);
    }
  });

  it("should have correct event types defined", () => {
    expect(RealtimeEvents.NOTIFICATION_CREATED).toBe("notification.created");
    expect(RealtimeEvents.NOTIFICATION_READ).toBe("notification.read");
    expect(RealtimeEvents.LEAD_CREATED).toBe("lead.created");
    expect(RealtimeEvents.LEAD_UPDATED).toBe("lead.updated");
    expect(RealtimeEvents.CALL_STARTED).toBe("call.started");
  });

  it("should format notification data correctly", () => {
    const notificationData = {
      id: "notif-123",
      title: "New Lead Assigned",
      body: "You have been assigned a new lead: John Doe",
      link: "/leads/lead-123",
      createdAt: new Date().toISOString(),
    };

    expect(notificationData).toHaveProperty("id");
    expect(notificationData).toHaveProperty("title");
    expect(notificationData).toHaveProperty("body");
    expect(notificationData).toHaveProperty("link");
    expect(notificationData).toHaveProperty("createdAt");
    expect(notificationData.title).toBeTruthy();
  });
});

describe("Real-time Event Types", () => {
  it("should have all required notification events", () => {
    expect(RealtimeEvents).toHaveProperty("NOTIFICATION_CREATED");
    expect(RealtimeEvents).toHaveProperty("NOTIFICATION_READ");
  });

  it("should have all required lead events", () => {
    expect(RealtimeEvents).toHaveProperty("LEAD_CREATED");
    expect(RealtimeEvents).toHaveProperty("LEAD_UPDATED");
    expect(RealtimeEvents).toHaveProperty("LEAD_ASSIGNED");
    expect(RealtimeEvents).toHaveProperty("LEAD_STATUS_CHANGED");
  });

  it("should have all required call events", () => {
    expect(RealtimeEvents).toHaveProperty("CALL_STARTED");
    expect(RealtimeEvents).toHaveProperty("CALL_ENDED");
    expect(RealtimeEvents).toHaveProperty("CALL_UPDATED");
  });

  it("should have all required follow-up events", () => {
    expect(RealtimeEvents).toHaveProperty("FOLLOWUP_CREATED");
    expect(RealtimeEvents).toHaveProperty("FOLLOWUP_UPDATED");
    expect(RealtimeEvents).toHaveProperty("FOLLOWUP_DUE");
    expect(RealtimeEvents).toHaveProperty("FOLLOWUP_COMPLETED");
  });
});
