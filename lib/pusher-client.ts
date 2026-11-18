/**
 * Client-side Pusher integration
 * Must be imported only in Client Components
 */

'use client';

import Pusher from 'pusher-js';

let pusher: Pusher | null = null;

/**
 * Get or create Pusher client instance
 * Returns null if Pusher is not configured
 */
export function getPusherClient(): Pusher | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  
  if (!key || !cluster) {
    return null;
  }
  
  if (!pusher) {
    pusher = new Pusher(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
      forceTLS: true,
    });
    
    pusher.connection.bind('error', (err: any) => {
      console.error('Pusher connection error:', err);
    });
  }
  
  return pusher;
}

/**
 * Subscribe to a channel
 */
export function subscribe(channelName: string) {
  const client = getPusherClient();
  if (!client) return null;
  
  return client.subscribe(channelName);
}

/**
 * Unsubscribe from a channel
 */
export function unsubscribe(channelName: string) {
  const client = getPusherClient();
  if (!client) return;
  
  client.unsubscribe(channelName);
}

/**
 * Subscribe to user-specific channel
 */
export function subscribeToUser(userId: string) {
  return subscribe(`user-${userId}`);
}

/**
 * Subscribe to team channel
 */
export function subscribeToTeam(teamId: string) {
  return subscribe(`team-${teamId}`);
}

/**
 * Subscribe to global channel
 */
export function subscribeToGlobal() {
  return subscribe('global');
}

/**
 * Disconnect Pusher
 */
export function disconnect() {
  if (pusher) {
    pusher.disconnect();
    pusher = null;
  }
}
