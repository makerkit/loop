import { execFile } from "node:child_process";

import type { RunCommand } from "./git";

/**
 * Runs a command with an argument array (no shell), a timeout, and git set
 * to never wait for a password, editor or signing prompt. Server only.
 */
export const runCommand: RunCommand = (command, args, { cwd, timeoutMs }) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GIT_EDITOR: "true",
          LC_ALL: "C",
        },
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === "number"
            ? (error as { code: number }).code
            : error
              ? 1
              : 0;

        resolve({
          code,
          stdout: String(stdout),
          stderr: error?.killed ? `Timed out after ${timeoutMs / 1000}s.` : String(stderr),
        });
      },
    );
  });
