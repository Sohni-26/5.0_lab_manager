"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeEventPayload, RealtimeEventType } from "@/types/contracts";

const BROADCAST_CHANNEL_NAME = "campuslab_realtime_v1";
const STORAGE_SIGNAL_KEY = "campuslab_realtime_signal_v1";

type LocalEventHandler = (event: RealtimeEventPayload) => void;

const seenEventIds = new Set<string>();
const MAX_SEEN_IDS = 300;

function markEventSeen(id: string): boolean {
  if (seenEventIds.has(id)) return false;
  seenEventIds.add(id);
  if (seenEventIds.size > MAX_SEEN_IDS) {
    const oldest = seenEventIds.values().next().value;
    if (oldest) seenEventIds.delete(oldest);
  }
  return true;
}

function generateEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Broadcasts a typed realtime event to all other tabs/windows in this browser
 * via BroadcastChannel + localStorage signal fallback (instant <20ms sync).
 */
export function broadcastLocalRealtimeEvent(input: {
  type: RealtimeEventType;
  campusId?: string | null;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  summary: string;
  data?: Record<string, unknown>;
}): RealtimeEventPayload | null {
  if (typeof window === "undefined") return null;

  const payload: RealtimeEventPayload = {
    id: generateEventId(),
    type: input.type,
    campusId: input.campusId ?? "demo-campus-01",
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.actorId ?? null,
    summary: input.summary,
    timestamp: new Date().toISOString(),
    ...(input.data ? { data: input.data } : {}),
  };

  // Mark seen in the sender tab so storage echo never re-triggers the sender
  markEventSeen(payload.id);

  // 1. BroadcastChannel (primary ultra-fast cross-tab transport)
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const ch = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    } catch {
      // ignore restricted environments
    }
  }

  // 2. localStorage signal fallback (ensures sync even in private/sandboxed windows)
  try {
    window.localStorage.setItem(STORAGE_SIGNAL_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }

  return payload;
}

/**
 * Subscribes to cross-tab local realtime events (BroadcastChannel + storage fallback)
 * with automatic event-ID deduplication.
 */
export function subscribeLocalRealtimeEvents(
  handler: LocalEventHandler,
  extraStorageKeys: string[] = []
): () => void {
  if (typeof window === "undefined") return () => {};

  const dispatch = (payload: RealtimeEventPayload) => {
    if (!payload?.id || !markEventSeen(payload.id)) return;
    handler(payload);
  };

  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (e: MessageEvent<RealtimeEventPayload>) => {
        if (e.data && typeof e.data === "object") {
          dispatch(e.data);
        }
      };
    } catch {
      bc = null;
    }
  }

  const handleStorage = (e: StorageEvent) => {
    if (!e.key) return;
    if (e.key === STORAGE_SIGNAL_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as RealtimeEventPayload;
        dispatch(parsed);
      } catch {
        // ignore malformed signal
      }
      return;
    }
    if (extraStorageKeys.includes(e.key)) {
      // Fallback synthetic event if another tab wrote directly to localStorage
      dispatch({
        id: `storage-${e.key}-${Date.now()}`,
        type: "request.status_changed",
        campusId: "demo-campus-01",
        entityType: "LabRequest",
        entityId: "local-sync",
        actorId: null,
        summary: "Workspace data updated in another tab",
        timestamp: new Date().toISOString(),
      });
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    try {
      bc?.close();
    } catch {
      // ignore close error
    }
  };
}

let cachedSupabaseClient: SupabaseClient | null | undefined;

/**
 * Lazy Supabase client for distributed multi-campus Realtime WebSockets.
 * Automatically activates when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * are set in `.env`; returns null in local/demo mode with zero overhead.
 */
export function getSupabaseRealtimeClient(): SupabaseClient | null {
  if (cachedSupabaseClient !== undefined) return cachedSupabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    cachedSupabaseClient = null;
    return null;
  }

  cachedSupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return cachedSupabaseClient;
}

/**
 * Subscribes to campus-scoped Supabase Realtime broadcast channel when configured.
 * Returns null if Supabase Realtime env vars are not set.
 */
export function subscribeSupabaseCampusChannel(params: {
  campusId: string | null;
  isGlobal: boolean;
  onEvent: LocalEventHandler;
  onStatus?: (connected: boolean) => void;
}): (() => void) | null {
  const client = getSupabaseRealtimeClient();
  if (!client) return null;

  const channelName = params.isGlobal
    ? "campuslab:global"
    : params.campusId
      ? `campuslab:campus:${params.campusId}`
      : null;

  if (!channelName) return null;

  const channel: RealtimeChannel = client
    .channel(channelName, {
      config: { broadcast: { self: false } },
    })
    .on("broadcast", { event: "campuslab_event" }, ({ payload }) => {
      if (payload && typeof payload === "object") {
        const evt = payload as RealtimeEventPayload;
        if (evt.id && markEventSeen(evt.id)) {
          params.onEvent(evt);
        }
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        params.onStatus?.(true);
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        params.onStatus?.(false);
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}
