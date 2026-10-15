import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { configuredServer, probeServer } from "./probe";
import { spawnInProject } from "./probe.server";

const LOCAL_PRD_MCP = "/Users/giancarlo/Code/makerkit/packages/prd-mcp/dist/bin.mjs";

describe("probeServer", () => {
  it.runIf(existsSync(LOCAL_PRD_MCP))("lists the PRD tools of a real prd-mcp server", async () => {
    const result = await probeServer(spawnInProject(process.cwd()), {
      command: "node",
      args: [LOCAL_PRD_MCP],
    });

    expect(result).toMatchObject({ ok: true, hasPrdTools: true });
    expect(result.ok && result.tools).toBeGreaterThan(10);
  });

  it("reports a server that cannot start", async () => {
    const result = await probeServer(spawnInProject(process.cwd()), {
      command: "node",
      args: ["-e", "console.error('boom'); process.exit(3)"],
    });

    expect(result).toEqual({ ok: false, reason: "The server stopped (exit code 3): boom" });
  });

  it("reports a server that never answers", async () => {
    const result = await probeServer(
      spawnInProject(process.cwd()),
      { command: "node", args: ["-e", "setInterval(() => {}, 1000)"] },
      500,
    );

    expect(result).toEqual({ ok: false, reason: "The server did not answer within 0.5s." });
  });
});

describe("configuredServer", () => {
  it("skips null server entries in hand-edited configs", () => {
    expect(
      configuredServer(
        JSON.stringify({ mcpServers: { broken: null } }),
        JSON.stringify({ mcp: { broken: null } }),
      ),
    ).toBeNull();
  });

  it("finds the PRD server in .mcp.json or opencode.json", () => {
    expect(
      configuredServer(
        JSON.stringify({
          mcpServers: {
            x: { command: "npx", args: ["other"] },
            prd: { command: "npx", args: ["-y", "@makerkit/prd-mcp"] },
          },
        }),
        null,
      ),
    ).toEqual({ command: "npx", args: ["-y", "@makerkit/prd-mcp"] });
    expect(
      configuredServer(
        null,
        JSON.stringify({
          mcp: { prd: { command: ["node", "packages/mcp-server/build/index.cjs"] } },
        }),
      ),
    ).toEqual({ command: "node", args: ["packages/mcp-server/build/index.cjs"] });
    expect(configuredServer(null, null)).toBeNull();
  });
});
