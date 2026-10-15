import type { RequestGuardConfig } from "./request-guard";

const DEFAULT_PORT = 3000;

const globalForSession = globalThis as { __loopSessionToken?: string };

/**
 * The session token and port for this Loop process. Server only.
 *
 * The launcher (bin/loop.mjs) or the dev server plugin in vite.config.ts sets
 * LOOP_SESSION_TOKEN and LOOP_PORT before the server starts. The token is
 * read once, kept in memory (across dev module reloads) and removed from the
 * environment, so commands Loop runs (git, the project's checks) never see it.
 * If there is none, one is generated and the URL to open is printed.
 */
export function getSessionConfig(): RequestGuardConfig {
  let token = globalForSession.__loopSessionToken;

  if (!token) {
    const fromEnv = process.env.LOOP_SESSION_TOKEN;

    token = fromEnv || generateSessionToken();
    globalForSession.__loopSessionToken = token;
    delete process.env.LOOP_SESSION_TOKEN;

    if (!fromEnv) {
      console.info(`Open Loop at http://127.0.0.1:${getPort()}/?token=${token}`);
    }
  }

  return { token, port: getPort() };
}

export function generateSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getPort() {
  const value = process.env.LOOP_PORT ?? process.env.NITRO_PORT ?? process.env.PORT;
  const port = Number(value);

  return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
}
