import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { recentEvents, subscribe } from "@/lib/events/bus";
import type { DomainEvent } from "@/lib/events/types";

export const dynamic = "force-dynamic";

/**
 * Server-sent events stream for the shared domain-event layer.
 *
 * One connection per browser tab replaces per-section polling: the dashboard,
 * activity feed and copilot all read from this single stream. SSE (not a
 * WebSocket) because the traffic is strictly server -> client and SSE
 * reconnects on its own.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const url = new URL(request.url);
  const lastEventId =
    request.headers.get("last-event-id") ?? url.searchParams.get("since") ?? undefined;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const sendEvent = (event: DomainEvent) => {
        write(`id: ${event.id}\nevent: domain\ndata: ${JSON.stringify(event)}\n\n`);
      };

      // Tell the client the stream is live before anything else, so the UI can
      // show a real connected state rather than guessing.
      write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

      // Replay anything that fired while this tab was disconnected.
      for (const event of recentEvents(lastEventId)) sendEvent(event);

      unsubscribe = subscribe({
        id: crypto.randomUUID(),
        userEmail: user.email ?? null,
        send: sendEvent,
      });

      // Comment frames keep proxies from closing an idle stream.
      heartbeat = setInterval(() => write(`: ping\n\n`), 25_000);

      const abort = () => {
        closed = true;
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", abort);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
