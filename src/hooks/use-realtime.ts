"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  subscribeLocalRealtimeEvents,
  subscribeSupabaseCampusChannel,
} from "@/lib/realtime/client-sync";
import { STUDENT_REQUESTS_STORAGE_KEY } from "@/lib/student-requests-store";
import type { RealtimeEventPayload, RealtimeEventType } from "@/types/contracts";

export type RealtimeStatus = "connected" | "reconnecting" | "demo";

interface UseRealtimeOptions {
  enabled?: boolean;
  isDemoMode?: boolean;
  eventTypes?: RealtimeEventType[];
  onEvent?: (event: RealtimeEventPayload) => void;
  /** Optional hook triggered on tab focus / network reconnect for guaranteed freshness */
  onReconnect?: () => void;
}

/**
 * Progressive Distributed Realtime Hook (Plan 3):
 * 1. Always-on cross-tab BroadcastChannel + localStorage signal (<20ms sync across browser tabs)
 * 2. Live SSE (/api/events) with Last-Event-ID replay & exponential backoff
 * 3. Pluggable Supabase Realtime WebSocket broadcast channel (auto-enabled via env vars)
 * 4. Automatic tab-focus & online catch-up sync
 */
export function useRealtime({
  enabled = true,
  isDemoMode = false,
  eventTypes,
  onEvent,
  onReconnect,
}: UseRealtimeOptions = {}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<RealtimeStatus>(
    isDemoMode ? "demo" : "reconnecting"
  );
  const [events, setEvents] = useState<RealtimeEventPayload[]>([]);
  const [lastEvent, setLastEvent] = useState<RealtimeEventPayload | null>(null);
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const eventTypesRef = useRef(eventTypes);
  const lastEventIdRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    eventTypesRef.current = eventTypes;
  }, [eventTypes]);

  useEffect(() => {
    if (!enabled) return;

    const handleIncomingEvent = (payload: RealtimeEventPayload) => {
      if (payload.type === "heartbeat") {
        setStatus("connected");
        return;
      }

      if (payload.id) {
        if (seenIdsRef.current.has(payload.id)) return;
        seenIdsRef.current.add(payload.id);
        if (seenIdsRef.current.size > 300) {
          const oldest = seenIdsRef.current.values().next().value;
          if (oldest) seenIdsRef.current.delete(oldest);
        }
        lastEventIdRef.current = payload.id;
      }

      setLastEvent(payload);
      setEvents((prev) => [payload, ...prev].slice(0, 15));

      const allowed = eventTypesRef.current;
      if (!allowed || allowed.includes(payload.type)) {
        onEventRef.current?.(payload);
      }
    };

    // 1. Always-on local cross-tab transport (instant sync between side-by-side tabs)
    const unsubscribeLocal = subscribeLocalRealtimeEvents(
      handleIncomingEvent,
      [STUDENT_REQUESTS_STORAGE_KEY]
    );

    // 2. Tab visibility & online catch-up resync
    const triggerCatchUp = () => {
      if (onReconnectRef.current) {
        onReconnectRef.current();
      } else {
        onEventRef.current?.({
          id: `sync-${Date.now()}`,
          type: "request.status_changed",
          campusId: user?.campusId ?? null,
          entityType: "Session",
          entityId: "visibility-sync",
          actorId: null,
          summary: "",
          timestamp: new Date().toISOString(),
        });
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        triggerCatchUp();
      }
    };
    const handleOnline = () => triggerCatchUp();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    if (isDemoMode) {
      setStatus("demo");
      return () => {
        unsubscribeLocal();
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("online", handleOnline);
      };
    }

    // 3. Distributed Supabase Realtime WebSocket channel (auto-enabled when env vars exist)
    const unsubscribeSupabase = subscribeSupabaseCampusChannel({
      campusId: user?.campusId ?? null,
      isGlobal: user?.role === "CENTRAL_LAB_MANAGER",
      onEvent: handleIncomingEvent,
      onStatus: (connected) => {
        if (connected) setStatus("connected");
      },
    });

    // 4. Server SSE (/api/events) with Last-Event-ID replay & exponential backoff
    let es: EventSource | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelayMs = 1500;

    const connect = () => {
      if (closed) return;
      try {
        const streamUrl = lastEventIdRef.current
          ? `/api/events?lastEventId=${encodeURIComponent(lastEventIdRef.current)}`
          : "/api/events";
        es = new EventSource(streamUrl);
        es.onopen = () => {
          if (!closed) {
            retryDelayMs = 1500;
            setStatus("connected");
          }
        };
        es.onmessage = (msg) => {
          if (!msg.data) return;
          try {
            const payload = JSON.parse(msg.data) as RealtimeEventPayload;
            handleIncomingEvent(payload);
          } catch {
            // ignore non-JSON keepalive
          }
        };
        es.onerror = () => {
          if (closed) return;
          setStatus("reconnecting");
          es?.close();
          reconnectTimer = setTimeout(connect, retryDelayMs);
          retryDelayMs = Math.min(15000, Math.round(retryDelayMs * 1.8));
        };
      } catch {
        setStatus("reconnecting");
      }
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
      unsubscribeSupabase?.();
      unsubscribeLocal();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, isDemoMode, user?.campusId, user?.role]);

  return { status, events, lastEvent };
}
