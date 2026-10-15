/**
 * Which coding agents are on this machine, whether the project already
 * connects them to the PRD tools, and the configuration that would. Pure:
 * file reads and PATH lookups are injected.
 *
 * Loop only writes inside the project, so it can apply project config
 * (Claude Code's .mcp.json, OpenCode's opencode.json). Codex only has a
 * global config, so Loop shows the command to run instead.
 */

export type AgentId = "claude" | "codex" | "opencode";

/** The command that starts the PRD MCP server, run from the project root. */
export interface ServerCommand {
  /** "kit": the kit's own MCP server (PRD tools plus kit tools). */
  kind: "kit" | "prd";
  name: string;
  command: string;
  args: string[];
  /** For the kit server: when its build output is missing. */
  needsBuild?: string;
}

export interface AgentStatus {
  id: AgentId;
  name: string;
  installed: boolean;
  /** true / false from project config; "unknown" when the config is global (Codex). */
  connected: boolean | "unknown";
  /** The project file Loop can write, if any. */
  configFile: string | null;
  /** Why the config file cannot be written automatically (e.g. JSONC with comments). */
  cannotApply?: string;
  /** What to run or add by hand. */
  manual: string;
}

export interface AgentDeps {
  /** Reads a file relative to the project root; null when it does not exist. */
  readProjectFile(path: string): Promise<string | null>;
  isOnPath(binary: string): Promise<boolean>;
}

const KIT_SERVER_DIRS = ["packages/mcp-server", "tooling/mcp-server"];

/** Inside a Makerkit kit, its own MCP server; elsewhere @makerkit/prd-mcp. */
export async function chooseServer(
  deps: Pick<AgentDeps, "readProjectFile">,
): Promise<ServerCommand> {
  for (const dir of KIT_SERVER_DIRS) {
    const text = await deps.readProjectFile(`${dir}/package.json`);
    const manifest = text ? safeJson(text) : null;

    if (
      manifest &&
      typeof manifest === "object" &&
      (manifest as { name?: unknown }).name === "@kit/mcp-server"
    ) {
      const main = (manifest as { main?: unknown }).main;
      const entry = `${dir}/${typeof main === "string" ? main.replace(/^\.\//, "") : "build/index.js"}`;
      const built = (await deps.readProjectFile(entry)) !== null;

      return {
        kind: "kit",
        name: "makerkit",
        command: "node",
        args: [entry],
        ...(built ? {} : { needsBuild: `pnpm --filter @kit/mcp-server build` }),
      };
    }
  }

  return { kind: "prd", name: "prd", command: "npx", args: ["-y", "@makerkit/prd-mcp"] };
}

/** True when an MCP server entry looks like the PRD tools (prd-mcp or the kit's server). */
export function isPrdServer(command: unknown, args: unknown) {
  const parts = [command, ...(Array.isArray(args) ? args : [])]
    .filter((part): part is string => typeof part === "string")
    .join(" ");

  return /prd-mcp|mcp-server\/build\/index\.|makerkit-mcp-server/.test(parts);
}

function claudeConnected(text: string | null) {
  const servers = text
    ? (safeJson(text) as { mcpServers?: Record<string, unknown> } | null)?.mcpServers
    : null;

  return Object.values(servers ?? {}).some((server) => {
    const entry = server as { command?: unknown; args?: unknown };

    return isPrdServer(entry?.command, entry?.args);
  });
}

function opencodeConnected(text: string | null) {
  const servers = text ? (safeJson(text) as { mcp?: Record<string, unknown> } | null)?.mcp : null;

  return Object.values(servers ?? {}).some((server) => {
    const command = (server as { command?: unknown })?.command;

    return Array.isArray(command) && isPrdServer(command[0], command.slice(1));
  });
}

export function shellLine(server: ServerCommand) {
  return [server.command, ...server.args].map(quoteArg).join(" ");
}

function quoteArg(arg: string) {
  return /^[A-Za-z0-9@%+=:,./_-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

export async function detectAgents(deps: AgentDeps, server: ServerCommand): Promise<AgentStatus[]> {
  const [claudeInstalled, codexInstalled, opencodeInstalled] = await Promise.all([
    deps.isOnPath("claude"),
    deps.isOnPath("codex"),
    deps.isOnPath("opencode"),
  ]);
  const mcpJson = await deps.readProjectFile(".mcp.json");
  const opencodeJson = await deps.readProjectFile("opencode.json");
  const opencodeJsonc = await deps.readProjectFile("opencode.jsonc");

  return [
    {
      id: "claude",
      name: "Claude Code",
      installed: claudeInstalled,
      connected: claudeConnected(mcpJson),
      configFile: ".mcp.json",
      ...(mcpJson !== null && safeJson(mcpJson) === null
        ? { cannotApply: ".mcp.json is not valid JSON; fix it or add the server by hand." }
        : {}),
      manual: `claude mcp add ${server.name} --scope project -- ${shellLine(server)}`,
    },
    {
      id: "codex",
      name: "Codex",
      installed: codexInstalled,
      connected: "unknown",
      configFile: null,
      cannotApply: "Codex keeps MCP servers in ~/.codex/config.toml, outside the project.",
      manual: `codex mcp add ${server.name} -- ${shellLine(server)}`,
    },
    {
      id: "opencode",
      name: "OpenCode",
      installed: opencodeInstalled,
      connected: opencodeConnected(opencodeJson ?? stripJsonComments(opencodeJsonc)),
      configFile: "opencode.json",
      ...(opencodeJsonc !== null
        ? {
            cannotApply:
              "This project uses opencode.jsonc (with comments); add the server by hand.",
          }
        : opencodeJson !== null && safeJson(opencodeJson) === null
          ? { cannotApply: "opencode.json is not valid JSON; fix it or add the server by hand." }
          : {}),
      manual: JSON.stringify(
        {
          mcp: {
            [server.name]: {
              type: "local",
              command: [server.command, ...server.args],
              enabled: true,
            },
          },
        },
        null,
        2,
      ),
    },
  ];
}

/**
 * The new content of a project config file with the PRD server added (other
 * servers and settings kept). Throws when the existing file is not JSON.
 */
export function applyConfig(
  agent: "claude" | "opencode",
  existing: string | null,
  server: ServerCommand,
) {
  const parsed = existing === null ? {} : safeJson(existing);

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${agent === "claude" ? ".mcp.json" : "opencode.json"} is not valid JSON.`);
  }

  const config = parsed as Record<string, unknown>;

  if (agent === "claude") {
    const servers = { ...(config.mcpServers as Record<string, unknown> | undefined) };

    servers[server.name] = { type: "stdio", command: server.command, args: server.args };

    return `${JSON.stringify({ ...config, mcpServers: servers }, null, 2)}\n`;
  }

  const servers = { ...(config.mcp as Record<string, unknown> | undefined) };

  servers[server.name] = {
    type: "local",
    command: [server.command, ...server.args],
    enabled: true,
  };

  return `${JSON.stringify(
    { $schema: "https://opencode.ai/config.json", ...config, mcp: servers },
    null,
    2,
  )}\n`;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Enough JSONC support to read an opencode.jsonc for detection (never to rewrite it). */
function stripJsonComments(text: string | null) {
  return text === null ? null : text.replace(/\/\*[\s\S]*?\*\/|(^|[^:"])\/\/.*$/gm, "$1");
}
