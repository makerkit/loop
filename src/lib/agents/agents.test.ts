import { describe, expect, it } from "vitest";

import { applyConfig, chooseServer, detectAgents, isPrdServer, type ServerCommand } from "./agents";

const PRD: ServerCommand = {
  kind: "prd",
  name: "prd",
  command: "npx",
  args: ["-y", "@makerkit/prd-mcp"],
};

function deps(files: Record<string, string>, onPath: string[] = []) {
  return {
    readProjectFile: async (path: string) => files[path] ?? null,
    isOnPath: async (binary: string) => onPath.includes(binary),
  };
}

describe("chooseServer", () => {
  it("uses the kit's MCP server inside a kit", async () => {
    expect(
      await chooseServer(
        deps({
          "packages/mcp-server/package.json": JSON.stringify({
            name: "@kit/mcp-server",
            main: "./build/index.cjs",
          }),
          "packages/mcp-server/build/index.cjs": "",
        }),
      ),
    ).toEqual({
      kind: "kit",
      name: "makerkit",
      command: "node",
      args: ["packages/mcp-server/build/index.cjs"],
    });
  });

  it("says how to build the kit's server when it is not built", async () => {
    expect(
      await chooseServer(
        deps({
          "tooling/mcp-server/package.json": JSON.stringify({
            name: "@kit/mcp-server",
            main: "build/index.mjs",
          }),
        }),
      ),
    ).toMatchObject({
      kind: "kit",
      args: ["tooling/mcp-server/build/index.mjs"],
      needsBuild: expect.any(String),
    });
  });

  it("uses @makerkit/prd-mcp elsewhere", async () => {
    expect(await chooseServer(deps({}))).toEqual(PRD);
  });
});

describe("detectAgents", () => {
  it("reports installed agents and whether the project connects them", async () => {
    const agents = await detectAgents(
      deps(
        {
          ".mcp.json": JSON.stringify({
            mcpServers: {
              prd: { command: "node", args: ["../makerkit/packages/prd-mcp/dist/bin.mjs"] },
            },
          }),
          "opencode.json": JSON.stringify({ mcp: { other: { type: "local", command: ["x"] } } }),
        },
        ["claude", "opencode"],
      ),
      PRD,
    );

    expect(agents.map(({ id, installed, connected }) => ({ id, installed, connected }))).toEqual([
      { id: "claude", installed: true, connected: true },
      { id: "codex", installed: false, connected: "unknown" },
      { id: "opencode", installed: true, connected: false },
    ]);
    expect(agents[1]!.manual).toBe("codex mcp add prd -- npx -y @makerkit/prd-mcp");
  });

  it("does not offer to rewrite JSONC or broken files", async () => {
    const agents = await detectAgents(
      deps({ ".mcp.json": "{ broken", "opencode.jsonc": '{ // comment\n "mcp": {} }' }),
      PRD,
    );

    expect(agents[0]!.cannotApply).toMatch(/not valid JSON/);
    expect(agents[2]!.cannotApply).toMatch(/opencode.jsonc/);
  });
});

describe("applyConfig", () => {
  it("adds the server to .mcp.json and keeps the others", () => {
    const result = JSON.parse(
      applyConfig("claude", JSON.stringify({ mcpServers: { other: { command: "x" } } }), PRD),
    );

    expect(result.mcpServers).toEqual({
      other: { command: "x" },
      prd: { type: "stdio", command: "npx", args: ["-y", "@makerkit/prd-mcp"] },
    });
  });

  it("creates opencode.json when there is none", () => {
    expect(JSON.parse(applyConfig("opencode", null, PRD))).toEqual({
      $schema: "https://opencode.ai/config.json",
      mcp: { prd: { type: "local", command: ["npx", "-y", "@makerkit/prd-mcp"], enabled: true } },
    });
  });

  it("refuses to rewrite a file that is not JSON", () => {
    expect(() => applyConfig("claude", "{ nope", PRD)).toThrow(/not valid JSON/);
  });
});

describe("isPrdServer", () => {
  it("recognises the PRD and kit servers", () => {
    expect(isPrdServer("npx", ["-y", "@makerkit/prd-mcp"])).toBe(true);
    expect(isPrdServer("node", ["packages/mcp-server/build/index.cjs"])).toBe(true);
    expect(isPrdServer("npx", ["next-devtools-mcp"])).toBe(false);
  });
});
