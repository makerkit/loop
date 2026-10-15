import { createFileRoute } from "@tanstack/react-router";

import { getPrdsWatcher } from "#/lib/live/watcher.server";

const HEARTBEAT_MS = 20_000;

/**
 * Server-sent events: tells the open page when PRD files change, so it can
 * reload its data. Protected by the request guard like every route; the
 * .prds watcher runs only while at least one page is connected.
 */
export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const encoder = new TextEncoder();
        let cleanup = () => undefined as void;

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (text: string) => {
              try {
                controller.enqueue(encoder.encode(text));
              } catch {
                cleanup();
              }
            };

            // Reconnect after 2s if the connection drops
            send("retry: 2000\n\n");

            const unsubscribe = getPrdsWatcher().subscribe((files) => {
              send(`event: prds\ndata: ${JSON.stringify({ files })}\n\n`);
            });
            const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

            cleanup = () => {
              clearInterval(heartbeat);
              unsubscribe();
              cleanup = () => undefined;
            };

            request.signal.addEventListener("abort", () => {
              cleanup();
              try {
                controller.close();
              } catch {
                // already closed
              }
            });
          },
          cancel() {
            cleanup();
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-store",
            connection: "keep-alive",
          },
        });
      },
    },
  },
});
