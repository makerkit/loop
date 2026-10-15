import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";

import { sanitizeOutput } from "#/lib/git/sanitize";
import { getProjectRoot } from "#/lib/prds/project.server";

import { applyConfig, chooseServer, detectAgents } from "./agents";
import { configuredServer, probeServer } from "./probe";
import { spawnInProject } from "./probe.server";

/** The only files Loop reads or writes for agent setup, relative to the project root. */
const CONFIG_FILES = { claude: ".mcp.json", opencode: "opencode.json" } as const;

async function readProjectFile(path: string) {
  try {
    return await readFile(join(getProjectRoot(), path), "utf8");
  } catch {
    return null;
  }
}

/** Whether a command exists on PATH (it is not run). */
async function isOnPath(binary: string) {
  const extensions = process.platform === "win32" ? [".cmd", ".exe", ""] : [""];

  for (const dir of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      try {
        await access(join(dir, `${binary}${extension}`), constants.X_OK);

        return true;
      } catch {
        // keep looking
      }
    }
  }

  return false;
}

export async function getAgentSetup() {
  const server = await chooseServer({ readProjectFile });
  const agents = await detectAgents({ readProjectFile, isOnPath }, server);
  const configured = configuredServer(
    await readProjectFile(CONFIG_FILES.claude),
    await readProjectFile(CONFIG_FILES.opencode),
  );

  return { server, agents, configured };
}

/** Adds the PRD server to the agent's project config file, keeping everything else in it. */
export async function applyAgentConfig(agent: keyof typeof CONFIG_FILES) {
  const server = await chooseServer({ readProjectFile });
  const file = CONFIG_FILES[agent];

  if (agent === "opencode" && (await readProjectFile("opencode.jsonc")) !== null) {
    throw new Error("This project uses opencode.jsonc; add the server by hand.");
  }

  const content = applyConfig(agent, await readProjectFile(file), server);

  await writeFile(join(getProjectRoot(), file), content, "utf8");

  return { file };
}

/** Starts the configured (or recommended) server and lists its tools. */
export async function testAgentConnection() {
  const { server, configured } = await getAgentSetup();
  const target = configured ?? server;

  const root = getProjectRoot();
  const result = await probeServer(spawnInProject(root), target);

  return {
    command: sanitizeOutput([target.command, ...target.args].join(" "), root),
    result: result.ok ? result : { ...result, reason: sanitizeOutput(result.reason, root) },
  };
}
