import { watch } from "node:fs";
import { stat } from "node:fs/promises";

import { getPrdsDir, getProjectRoot } from "#/lib/prds/project.server";

import { createPrdsWatcher, type PrdsWatcher } from "./prds-watcher";

const globalForWatcher = globalThis as { __loopPrdsWatcher?: PrdsWatcher };

/** The one .prds watcher for this Loop process (kept across dev reloads). Server only. */
export function getPrdsWatcher() {
  globalForWatcher.__loopPrdsWatcher ??= createPrdsWatcher({
    projectRoot: getProjectRoot(),
    prdsDir: getPrdsDir(),
    exists: (path) =>
      stat(path).then(
        (stats) => stats.isDirectory(),
        () => false,
      ),
    watch: (dir, onChange, recursive) => {
      const watcher = watch(dir, { recursive }, (_event, file) =>
        onChange(file ? String(file) : null),
      );

      // A folder that disappears (e.g. .prds deleted) must not crash the server
      watcher.on("error", () => watcher.close());

      return () => watcher.close();
    },
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  });

  return globalForWatcher.__loopPrdsWatcher;
}
