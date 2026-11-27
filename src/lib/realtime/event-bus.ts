import crypto from "crypto";
import { EventEmitter } from "events";
import type {
  AuthUserDTO,
  RealtimeEventPayload,
  RealtimeEventType,
} from "@/types/contracts";

type RealtimeListener = (event: RealtimeEventPayload) => void;

const REALTIME_CHANNEL = "campuslab:realtime";
const MAX_REPLAY_BUFFER = 200;

/**
 * Non-blocking Supabase Realtime HTTP Broadcast fan-out for multi-server / serverless Next.js.
 * Activates automatically when NEXT_PUBLIC_SUPABASE_URL and a Supabase key are configured.
 */
function fanOutToSupabaseBroadcast(payload: RealtimeEventPayload): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || payload.type === "heartbeat") return;

  const topics: string[] = ["campuslab:global"];
  if (payload.campusId) {
    topics.push(`campuslab:campus:${payload.campusId}`);
  }

  const messages = topics.map((topic) => ({
    topic,
    event: "campuslab_event",
    payload,
  }));

  void fetch(`${supabaseUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  }).catch(() => {
    // Graceful degradation: local SSE stream still delivers immediately
  });
}

class CampusRealtimeEventBus {
  private readonly emitter: EventEmitter;
  private readonly recentEvents: RealtimeEventPayload[] = [];

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(500);
  }

  private matchesUserScope(
    user: Pick<AuthUserDTO, "id" | "role" | "campusId">,
    event: RealtimeEventPayload
  ): boolean {
    if (event.type === "heartbeat") return true;
    if (user.role === "CENTRAL_LAB_MANAGER") return true;
    return Boolean(
      event.campusId && user.campusId && event.campusId === user.campusId
    );
  }

  publish(input: {
    type: RealtimeEventType;
    campusId: string | null;
    entityType: string;
    entityId: string;
    actorId: string | null;
    summary: string;
    data?: Record<string, unknown>;
  }): RealtimeEventPayload {
    const payload: RealtimeEventPayload = {
      id: crypto.randomUUID(),
      type: input.type,
      campusId: input.campusId,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId,
      summary: input.summary,
      timestamp: new Date().toISOString(),
      ...(input.data ? { data: input.data } : {}),
    };

    if (payload.type !== "heartbeat") {
      this.recentEvents.push(payload);
      if (this.recentEvents.length > MAX_REPLAY_BUFFER) {
        this.recentEvents.splice(0, this.recentEvents.length - MAX_REPLAY_BUFFER);
      }
    }

    this.emitter.emit(REALTIME_CHANNEL, payload);
    fanOutToSupabaseBroadcast(payload);
    return payload;
  }

  /**
   * Replays missed campus-scoped events after `lastEventId` for SSE reconnect recovery.
   */
  getEventsSince(
    lastEventId: string | null,
    user: Pick<AuthUserDTO, "id" | "role" | "campusId">
  ): RealtimeEventPayload[] {
    if (!lastEventId) return [];
    const idx = this.recentEvents.findIndex((evt) => evt.id === lastEventId);
    if (idx === -1) return [];
    return this.recentEvents
      .slice(idx + 1)
      .filter((evt) => this.matchesUserScope(user, evt));
  }

  /**
   * Subscribes an authenticated user with strict campus isolation:
   * - CENTRAL_LAB_MANAGER receives all events globally.
   * - Campus users ONLY receive events whose campusId matches their own campusId.
   * - Events with campusId === null (global-only admin changes) are never sent to campus users.
   */
  subscribeForUser(
    user: Pick<AuthUserDTO, "id" | "role" | "campusId">,
    onEvent: RealtimeListener
  ): () => void {
    const scopedHandler: RealtimeListener = (event) => {
      if (this.matchesUserScope(user, event)) {
        onEvent(event);
      }
    };

    this.emitter.on(REALTIME_CHANNEL, scopedHandler);
    return () => {
      this.emitter.off(REALTIME_CHANNEL, scopedHandler);
    };
  }
}

const globalForBus = globalThis as unknown as {
  campusLabEventBus?: CampusRealtimeEventBus;
};

export const realtimeEventBus: CampusRealtimeEventBus =
  globalForBus.campusLabEventBus ?? new CampusRealtimeEventBus();

if (process.env.NODE_ENV !== "production") {
  globalForBus.campusLabEventBus = realtimeEventBus;
}
