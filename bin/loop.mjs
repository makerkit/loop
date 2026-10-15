#!/usr/bin/env node
// `npx @makerkit/loop`: starts Loop's server for the current folder on
// 127.0.0.1, opens the browser with the session link, stops on Ctrl+C.

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { HELP, choosePort, openCommand, parseArgs, projectNotes } from "./launcher.mjs";

const HOST = "127.0.0.1";
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = join(packageRoot, ".output", "server", "index.mjs");

const options = parseArgs(process.argv.slice(2));

if (options.error) {
  console.error(`${options.error}\n\n${HELP}`);
  process.exit(1);
}

if (options.help) {
  console.log(HELP);
  process.exit(0);
}

if (!existsSync(serverEntry)) {
  console.error("Loop is not built: run `pnpm build` in the Loop package first.");
  process.exit(1);
}

/** @param {number} port */
function isFree(port) {
  return new Promise((resolve) => {
    const probe = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => probe.close(() => resolve(true)))
      .listen(port, HOST);
  });
}

/** A port the OS picks, when none of the preferred ones is free. */
function anyFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
      .once("error", reject)
      .listen(0, HOST, () => {
        const address = probe.address();
        probe.close(() => resolve(typeof address === "object" && address ? address.port : 0));
      });
  });
}

const projectRoot = realpathSync(process.cwd());
let port = options.port;

if (port !== null && !(await isFree(port))) {
  console.error(`Port ${port} is already in use. Pick another one with --port, or leave it out.`);
  process.exit(1);
}

port ??= (await choosePort(isFree)) || (await anyFreePort());

const token = randomBytes(32).toString("base64url");
const url = `http://${HOST}:${port}/?token=${token}`;

Object.assign(process.env, {
  HOST,
  PORT: String(port),
  LOOP_PORT: String(port),
  LOOP_PROJECT_ROOT: projectRoot,
  // Read once by the server and then removed from the environment
  LOOP_SESSION_TOKEN: token,
  NODE_ENV: "production",
});

// The server prints its own "Listening on" line; Ctrl+C stops it gracefully
await import(pathToFileURL(serverEntry).href);

// Wait until it answers (403 without the cookie means it is up)
for (let attempt = 0; attempt < 50; attempt++) {
  try {
    await fetch(`http://${HOST}:${port}/`, { redirect: "manual" });
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

console.log(`\n  Makerkit Loop is running for ${projectRoot}\n`);
console.log(`  Open: ${url}\n`);

for (const note of projectNotes({
  hasPrds: existsSync(join(projectRoot, ".prds")),
  hasPackageJson: existsSync(join(projectRoot, "package.json")),
  hasGit: existsSync(join(projectRoot, ".git")),
})) {
  console.log(`  ${note}`);
}

console.log("\n  Press Ctrl+C to stop.\n");

const open = options.open ? openCommand(process.platform, url) : null;

if (open) {
  execFile(open.command, open.args, () => {
    // If the browser cannot be opened, the printed link is enough
  });
}
