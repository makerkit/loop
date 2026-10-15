import { createFileRoute } from "@tanstack/react-router";

import { serveAttachment } from "#/lib/prds/attachments.server";

/**
 * Serves a file from a PRD's attachments folder (`.prds/<prd name>/`), e.g.
 * images in PRD Markdown. Protected by the request guard like every route.
 */
export const Route = createFileRoute("/attachments/$folder/$")({
  server: {
    handlers: {
      GET: ({ params }) => serveAttachment(params.folder, params._splat ?? ""),
    },
  },
});
