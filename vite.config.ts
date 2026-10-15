import { defineConfig, type Plugin } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { randomBytes } from "node:crypto";

const PORT = 3000;

/**
 * Dev only: generate the session token before the server starts and print the
 * URL to open, since every request without the token is rejected.
 */
function loopSession(): Plugin {
  return {
    name: "loop-session",
    apply: "serve",
    enforce: "pre",
    // Runs before Nitro starts its dev worker, which copies process.env
    config() {
      process.env.LOOP_SESSION_TOKEN ||= randomBytes(32).toString("base64url");
      process.env.LOOP_PORT = String(PORT);
    },
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const url = `http://127.0.0.1:${process.env.LOOP_PORT}/?token=${process.env.LOOP_SESSION_TOKEN}`;

        setTimeout(() => server.config.logger.info(`\n  Open Loop: ${url}\n`), 100);
      });
    },
  };
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    // Loop is localhost-only; the request guard expects exactly this host and port
    host: "127.0.0.1",
    port: PORT,
    strictPort: true,
  },
  plugins: [
    loopSession(),
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
