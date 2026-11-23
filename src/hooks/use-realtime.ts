"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeEventPayload, RealtimeEventType } from "@/types/contracts";

export type RealtimeStatus = "connected" | "reconnecting" | "demo";

interface UseRealtimeOptions {
  enabled?: boolean;
  isDemoMode?: boolean;
  eventTypes?: RealtimeEventType[];
  onEvent?: (event: RealtimeEventPayload) => void;
}

export function useRealtime({
  enabled = true,
  isDemoMode = false,
  eventTypes,
  onEvent,
}: UseRealtimeOptions = {}) {
  const [status, setStatus] = useState<RealtimeStatus>(
    isDemoMode ? "demo" : "reconnecting"
  );
  const [events, setEvents] = useState<RealtimeEventPayload[]>([]);
  const [lastEvent, setLastEvent] = useState<RealtimeEventPayload | null>(null);
  const onEventRef = useRef(onEvent);
  const eventTypesRef = useRef(eventTypes);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    eventTypesRef.current = eventTypes;
  }, [eventTypes]);

  useEffect(() => {
    if (!enabled) return;
    if (isDemoMode) {
      setStatus("demo");
      return;
    }

    let es: EventSource | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      try {
        es = new EventSource("/api/events");
        es.onopen = () => {
          if (!closed) setStatus("connected");
        };
        es.onmessage = (msg) => {
          if (!msg.data) return;
          try {
            const payload = JSON.parse(msg.data) as RealtimeEventPayload;
            if (payload.type === "heartbeat") {
              setStatus("connected");
              return;
            }
            setLastEvent(payload);
            setEvents((prev) => [payload, ...prev].slice(0, 15));
            const allowed = eventTypesRef.current;
            if (!allowed || allowed.includes(payload.type)) {
              onEventRef.current?.(payload);
            }
          } catch {
            // ignore non-JSON keepalive
          }
        };
        es.onerror = () => {
          if (closed) return;
          setStatus("reconnecting");
          es?.close();
          reconnectTimer = setTimeout(connect, 5000);
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
    };
  }, [enabled, isDemoMode]);

  return { status, events, lastEvent };
}
