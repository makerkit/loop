import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { applyAgentConfig, getAgentSetup, testAgentConnection } from "./agents.server";

/** Detected agents, the PRD server to add, and the one the project already configures. */
export const getAgentSetupFn = createServerFn({ method: "GET" }).handler(() => getAgentSetup());

/** Writes the PRD server into .mcp.json (Claude Code) or opencode.json (OpenCode). */
export const applyAgentConfigFn = createServerFn({ method: "POST" })
  .validator(z.object({ agent: z.enum(["claude", "opencode"]) }))
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, ...(await applyAgentConfig(data.agent)) };
    } catch (error) {
      return {
        ok: false as const,
        reason: error instanceof Error ? error.message : "Could not write the file.",
      };
    }
  });

/** Starts the PRD server the way an agent would and lists its tools. */
export const testAgentConnectionFn = createServerFn({ method: "POST" }).handler(() =>
  testAgentConnection(),
);
