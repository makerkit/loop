import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import type { StoryStep } from "#/lib/stories/moves";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }

  interface HistoryState {
    /** Opens a story at this step (set by the board; see the stories route). */
    step?: StoryStep;
  }
}
