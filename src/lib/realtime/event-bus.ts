import crypto from "crypto";
import { EventEmitter } from "events";
import type {
  AuthUserDTO,
  RealtimeEventPayload,
  RealtimeEventType,
} from "@/types/contracts";

type RealtimeListener = (event: RealtimeEventPayload) => void;

const REALTIME_CHANNEL = "campuslab:realtime";

class CampusRealtimeEventBus {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(500);
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

    this.emitter.emit(REALTIME_CHANNEL, payload);
    return payload;
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
      if (event.type === "heartbeat") {
        onEvent(event);
        return;
      }
      if (user.role === "CENTRAL_LAB_MANAGER") {
        onEvent(event);
        return;
      }
      if (event.campusId && user.campusId && event.campusId === user.campusId) {
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
