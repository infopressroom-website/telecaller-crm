/**
 * React hooks for real-time features
 * Uses Pusher for WebSocket connections
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getPusherClient, subscribeToUser, subscribeToTeam, subscribeToGlobal } from '@/lib/pusher-client';
import type { Channel } from 'pusher-js';

/**
 * Subscribe to a Pusher channel and event
 * 
 * @example
 * useRealtime('user-123', 'notification.created', (data) => {
 *   console.log('New notification:', data);
 * });
 */
export function useRealtime(
  channel: string,
  event: string,
  handler: (data: any) => void,
  deps: any[] = []
) {
  const handlerRef = useRef(handler);
  
  // Keep handler reference up to date
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  
  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;
    
    const ch = pusher.subscribe(channel);
    
    const wrappedHandler = (data: any) => {
      handlerRef.current(data);
    };
    
    ch.bind(event, wrappedHandler);
    
    return () => {
      ch.unbind(event, wrappedHandler);
      pusher.unsubscribe(channel);
    };
  }, [channel, event, ...deps]);
}

/**
 * Subscribe to user-specific events
 * 
 * @example
 * useUserEvents(userId, {
 *   'notification.created': handleNotification,
 *   'lead.assigned': handleLeadAssignment,
 * });
 */
export function useUserEvents(
  userId: string,
  events: Record<string, (data: any) => void>
) {
  const eventsRef = useRef(events);
  
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  
  useEffect(() => {
    if (!userId) return;
    
    const channel = subscribeToUser(userId);
    if (!channel) return;
    
    // Bind all events
    Object.entries(eventsRef.current).forEach(([event, handler]) => {
      channel.bind(event, handler);
    });
    
    return () => {
      // Unbind all events
      Object.entries(eventsRef.current).forEach(([event, handler]) => {
        channel.unbind(event, handler);
      });
    };
  }, [userId]);
}

/**
 * Subscribe to team events
 */
export function useTeamEvents(
  teamId: string | null,
  events: Record<string, (data: any) => void>
) {
  const eventsRef = useRef(events);
  
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  
  useEffect(() => {
    if (!teamId) return;
    
    const channel = subscribeToTeam(teamId);
    if (!channel) return;
    
    Object.entries(eventsRef.current).forEach(([event, handler]) => {
      channel.bind(event, handler);
    });
    
    return () => {
      Object.entries(eventsRef.current).forEach(([event, handler]) => {
        channel.unbind(event, handler);
      });
    };
  }, [teamId]);
}

/**
 * Subscribe to global events
 */
export function useGlobalEvents(
  events: Record<string, (data: any) => void>
) {
  const eventsRef = useRef(events);
  
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  
  useEffect(() => {
    const channel = subscribeToGlobal();
    if (!channel) return;
    
    Object.entries(eventsRef.current).forEach(([event, handler]) => {
      channel.bind(event, handler);
    });
    
    return () => {
      Object.entries(eventsRef.current).forEach(([event, handler]) => {
        channel.unbind(event, handler);
      });
    };
  }, []);
}

/**
 * Hook to track online/offline presence
 * 
 * @example
 * const { isOnline, setStatus } = usePresence(userId);
 */
export function usePresence(userId: string) {
  const pusher = getPusherClient();
  
  const setStatus = useCallback((status: 'online' | 'offline' | 'busy') => {
    if (!pusher) return;
    
    // Send presence update via API
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status }),
    }).catch(err => console.error('Failed to update presence:', err));
  }, [userId, pusher]);
  
  useEffect(() => {
    if (!pusher || !userId) return;
    
    // Set online on mount
    setStatus('online');
    
    // Set offline on unmount
    return () => {
      setStatus('offline');
    };
  }, [userId, pusher, setStatus]);
  
  useEffect(() => {
    if (!userId) return;
    
    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setStatus('offline');
      } else {
        setStatus('online');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, setStatus]);
  
  return {
    setStatus,
    isOnline: true, // Would come from server state
  };
}

/**
 * Hook for optimistic UI updates with real-time sync
 * 
 * @example
 * const { data, update } = useRealtimeData(
 *   initialData,
 *   'user-123',
 *   'data.updated'
 * );
 */
export function useRealtimeData<T>(
  initialData: T,
  channel: string,
  event: string
) {
  const [data, setData] = React.useState<T>(initialData);
  
  useRealtime(channel, event, (newData: T) => {
    setData(newData);
  });
  
  const update = useCallback((updater: (prev: T) => T) => {
    setData(updater);
  }, []);
  
  return { data, update, setData };
}

// Re-export for convenience
import React from 'react';
