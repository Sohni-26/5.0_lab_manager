import crypto from "crypto";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/errors";
import { realtimeEventBus } from "@/lib/realtime/event-bus";
import type { RealtimeEventPayload } from "@/types/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const encoder = new TextEncoder();
    const lastEventId =
      request.headers.get("last-event-id") ??
      request.nextUrl.searchParams.get("lastEventId");

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (payload: RealtimeEventPayload) => {
          try {
            const frame =
              payload.type === "heartbeat"
                ? `data: ${JSON.stringify(payload)}\n\n`
                : `id: ${payload.id}\ndata: ${JSON.stringify(payload)}\n\n`;
            controller.enqueue(encoder.encode(frame));
          } catch {
            // Stream already closed
          }
        };

        // Initial connected heartbeat + retry hint
        try {
          controller.enqueue(encoder.encode("retry: 2000\n\n"));
        } catch {
          // ignore
        }

        send({
          id: crypto.randomUUID(),
          type: "heartbeat",
          campusId: actor.campusId,
          entityType: "Session",
          entityId: actor.id,
          actorId: actor.id,
          summary: "Connected to CampusLab realtime stream",
          timestamp: new Date().toISOString(),
        });

        // Replay any events missed while reconnecting (Last-Event-ID support)
        const missed = realtimeEventBus.getEventsSince(lastEventId, actor);
        for (const evt of missed) {
          send(evt);
        }

        const unsubscribe = realtimeEventBus.subscribeForUser(actor, send);

        const heartbeatTimer = setInterval(() => {
          send({
            id: crypto.randomUUID(),
            type: "heartbeat",
            campusId: actor.campusId,
            entityType: "Heartbeat",
            entityId: actor.id,
            actorId: null,
            summary: "keepalive",
            timestamp: new Date().toISOString(),
          });
        }, 25000);

        const cleanup = () => {
          clearInterval(heartbeatTimer);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // Ignore close errors
          }
        };

        request.signal.addEventListener("abort", cleanup);
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
