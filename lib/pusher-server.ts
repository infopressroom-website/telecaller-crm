/**
 * Server-side Pusher integration for real-time features
 * Gracefully handles missing configuration
 */

import Pusher from 'pusher';
import { env } from './env';

let pusher: Pusher | null = null;
let pusherAvailable = false;

// Initialize Pusher if configured
if (env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET && env.PUSHER_CLUSTER) {
  try {
    pusher = new Pusher({
      appId: env.PUSHER_APP_ID,
      key: env.PUSHER_KEY,
      secret: env.PUSHER_SECRET,
      cluster: env.PUSHER_CLUSTER,
      useTLS: true,
    });
    
    pusherAvailable = true;
    console.log('✓ Pusher initialized');
  } catch (error) {
    console.error('Failed to initialize Pusher:', error);
    pusher = null;
  }
}

/**
 * Trigger a real-time event
 * Silently fails if Pusher is not configured
 */
export async function trigger(
  channel: string,
  event: string,
  data: any
): Promise<boolean> {
  if (!pusher || !pusherAvailable) {
    return false;
  }
  
  try {
    await pusher.trigger(channel, event, data);
    return true;
  } catch (error) {
    console.error('Pusher trigger error:', error);
    return false;
  }
}

/**
 * Trigger event for specific user
 */
export async function notifyUser(
  userId: string,
  event: string,
  data: any
): Promise<boolean> {
  return trigger(`user-${userId}`, event, data);
}

/**
 * Trigger event for team
 */
export async function notifyTeam(
  teamId: string,
  event: string,
  data: any
): Promise<boolean> {
  return trigger(`team-${teamId}`, event, data);
}

/**
 * Trigger event globally (all users)
 */
export async function notifyAll(
  event: string,
  data: any
): Promise<boolean> {
  return trigger('global', event, data);
}

/**
 * Batch trigger multiple events
 */
export async function triggerBatch(
  events: Array<{
    channel: string;
    event: string;
    data: any;
  }>
): Promise<boolean> {
  if (!pusher || !pusherAvailable || events.length === 0) {
    return false;
  }
  
  try {
    // Map to Pusher's BatchEvent format which uses 'name' instead of 'event'
    const batchEvents = events.map(e => ({
      channel: e.channel,
      name: e.event,
      data: e.data
    }));
    await pusher.triggerBatch(batchEvents);
    return true;
  } catch (error) {
    console.error('Pusher batch trigger error:', error);
    return false;
  }
}

/**
 * Authenticate private channel
 */
export function authenticateUser(
  socketId: string,
  channel: string,
  userId: string
): string | null {
  if (!pusher || !pusherAvailable) {
    return null;
  }
  
  try {
    const auth = pusher.authorizeChannel(socketId, channel, {
      user_id: userId,
    });
    return JSON.stringify(auth);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return null;
  }
}

/**
 * Check if Pusher is available
 */
export function isPusherAvailable(): boolean {
  return pusherAvailable;
}

/**
 * Real-time event types
 */
export const RealtimeEvents = {
  // Notifications
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_READ: 'notification.read',
  
  // Leads
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_ASSIGNED: 'lead.assigned',
  LEAD_STATUS_CHANGED: 'lead.status_changed',
  
  // Calls
  CALL_STARTED: 'call.started',
  CALL_ENDED: 'call.ended',
  CALL_UPDATED: 'call.updated',
  
  // Follow-ups
  FOLLOWUP_CREATED: 'followup.created',
  FOLLOWUP_UPDATED: 'followup.updated',
  FOLLOWUP_DUE: 'followup.due',
  FOLLOWUP_COMPLETED: 'followup.completed',
  
  // Team
  MEMBER_ONLINE: 'member.online',
  MEMBER_OFFLINE: 'member.offline',
  MEMBER_BUSY: 'member.busy',
  
  // Performance
  TARGET_ACHIEVED: 'target.achieved',
  INCENTIVE_EARNED: 'incentive.earned',
  
  // System
  SYSTEM_ALERT: 'system.alert',
  MAINTENANCE_MODE: 'maintenance.mode',
} as const;

/**
 * Helper to broadcast lead updates
 */
export async function broadcastLeadUpdate(
  leadId: string,
  ownerId: string | null,
  teamId: string | null,
  event: typeof RealtimeEvents[keyof typeof RealtimeEvents],
  data: any
): Promise<void> {
  const events: Array<{ channel: string; event: string; data: any }> = [];
  
  // Notify owner
  if (ownerId) {
    events.push({
      channel: `user-${ownerId}`,
      event,
      data: { ...data, leadId },
    });
  }
  
  // Notify team
  if (teamId) {
    events.push({
      channel: `team-${teamId}`,
      event,
      data: { ...data, leadId },
    });
  }
  
  if (events.length > 0) {
    await triggerBatch(events);
  }
}

/**
 * Helper to broadcast call updates
 */
export async function broadcastCallUpdate(
  callId: string,
  agentId: string,
  leadOwnerId: string | null,
  event: typeof RealtimeEvents[keyof typeof RealtimeEvents],
  data: any
): Promise<void> {
  const events: Array<{ channel: string; event: string; data: any }> = [];
  
  // Notify agent
  events.push({
    channel: `user-${agentId}`,
    event,
    data: { ...data, callId },
  });
  
  // Notify lead owner if different
  if (leadOwnerId && leadOwnerId !== agentId) {
    events.push({
      channel: `user-${leadOwnerId}`,
      event,
      data: { ...data, callId },
    });
  }
  
  await triggerBatch(events);
}
