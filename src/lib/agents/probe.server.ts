import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import type { SpawnServer } from "./probe";

/** Starts an MCP server in the project folder with an argument array (no shell). Server only. */
export function spawnInProject(root: string): SpawnServer {
  return (command, args) => {
    const env = { ...process.env };

    // The session token must never reach other processes
    delete env.LOOP_SESSION_TOKEN;

    const child = spawn(command, args, { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr = (stderr + String(chunk)).slice(-4000);
    });

    const lines = createInterface({ input: child.stdout });

    return {
      write: (line) => child.stdin.write(line),
      onLine: (listener) => lines.on("line", listener),
      onExit: (listener) => {
        child.on("exit", listener);
        child.on("error", () => listener(null));
      },
      stderr: () => stderr,
      kill: () => {
        child.kill();
      },
    };
  };
}
