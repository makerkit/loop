import type { ServerCommand } from "./agents";

/** A started process: what the probe needs from child_process. */
export interface ProbeProcess {
  write(line: string): void;
  onLine(listener: (line: string) => void): void;
  onExit(listener: (code: number | null) => void): void;
  stderr(): string;
  kill(): void;
}

export type SpawnServer = (command: string, args: string[]) => ProbeProcess;

export type ProbeResult =
  | { ok: true; tools: number; hasPrdTools: boolean; serverName: string | null }
  | { ok: false; reason: string };

const PRD_TOOLS = ["list_prds", "get_next_story", "update_story_status"];

/**
 * Starts the MCP server the way an agent would (stdio), runs the MCP
 * handshake and lists its tools, then stops it. Confirms the configuration
 * works; it cannot tell whether the agent itself has loaded it.
 */
export function probeServer(
  spawn: SpawnServer,
  server: Pick<ServerCommand, "command" | "args">,
  timeoutMs = 60_000,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let child: ProbeProcess;
    let done = false;
    let serverName: string | null = null;

    const finish = (result: ProbeResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child?.kill();
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ ok: false, reason: `The server did not answer within ${timeoutMs / 1000}s.` }),
      timeoutMs,
    );

    try {
      child = spawn(server.command, server.args);
    } catch (error) {
      finish({
        ok: false,
        reason: error instanceof Error ? error.message : "Could not start the server.",
      });
      return;
    }

    const send = (message: object) => child.write(`${JSON.stringify(message)}\n`);

    child.onExit((code) => {
      const detail = child.stderr().trim().split("\n").slice(-3).join(" ");

      finish({
        ok: false,
        reason: `The server stopped (exit code ${code ?? "unknown"})${detail ? `: ${detail}` : "."}`,
      });
    });

    child.onLine((line) => {
      let message: { id?: number; result?: Record<string, unknown>; error?: { message?: string } };

      try {
        message = JSON.parse(line);
      } catch {
        return; // servers may log non-JSON lines
      }

      if (message.error) {
        finish({ ok: false, reason: message.error.message ?? "The server returned an error." });
      } else if (message.id === 1) {
        const info = message.result?.serverInfo as { name?: unknown } | undefined;
        serverName = typeof info?.name === "string" ? info.name : null;
        send({ jsonrpc: "2.0", method: "notifications/initialized" });
        send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      } else if (message.id === 2) {
        const tools = Array.isArray(message.result?.tools)
          ? (message.result.tools as Array<{ name?: string }>)
          : [];
        const names = new Set(tools.map((tool) => tool.name));

        finish({
          ok: true,
          tools: tools.length,
          hasPrdTools: PRD_TOOLS.every((name) => names.has(name)),
          serverName,
        });
      }
    });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "makerkit-loop", version: "0.0.0" },
      },
    });
  });
}

/** The PRD server the project already configures (Claude Code first, then OpenCode), if any. */
export function configuredServer(mcpJson: string | null, opencodeJson: string | null) {
  const parse = (text: string | null) => {
    try {
      return text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  for (const entry of Object.values(
    (parse(mcpJson)?.mcpServers as Record<string, unknown>) ?? {},
  )) {
    const { command, args } = (entry ?? {}) as { command?: unknown; args?: unknown };

    if (
      typeof command === "string" &&
      Array.isArray(args) &&
      args.every((arg) => typeof arg === "string")
    ) {
      if (
        /prd-mcp|mcp-server\/build\/index\.|makerkit-mcp-server/.test([command, ...args].join(" "))
      ) {
        return { command, args: args as string[] };
      }
    }
  }

  for (const entry of Object.values((parse(opencodeJson)?.mcp as Record<string, unknown>) ?? {})) {
    const command = (entry as { command?: unknown } | null)?.command;

    if (
      Array.isArray(command) &&
      command.every((part) => typeof part === "string") &&
      command.length > 0
    ) {
      if (/prd-mcp|mcp-server\/build\/index\.|makerkit-mcp-server/.test(command.join(" "))) {
        return { command: command[0] as string, args: command.slice(1) as string[] };
      }
    }
  }

  return null;
}
