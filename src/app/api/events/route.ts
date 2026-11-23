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

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (payload: RealtimeEventPayload) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
            );
          } catch {
            // Stream already closed
          }
        };

        // Initial connected heartbeat
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
