import type { PrdDeps } from "@makerkit/prd";

/** Test helper: PrdDeps backed by memory, rooted at `/project`. */
export const ROOT = "/project";
export const PRDS_DIR = `${ROOT}/.prds`;

export function createMemoryDeps(files: Record<string, string>) {
  const fs = new Map(Object.entries(files));
  const dirs = new Set<string>();

  if (Object.keys(files).length > 0) {
    dirs.add(PRDS_DIR);
  }

  const deps: PrdDeps = {
    rootPath: ROOT,
    async readdir(path) {
      if (!dirs.has(path)) throw new Error("ENOENT");
      return [...fs.keys()]
        .filter((file) => file.startsWith(`${path}/`))
        .map((file) => file.slice(path.length + 1));
    },
    async readFile(path) {
      const content = fs.get(path);
      if (content === undefined) throw new Error("ENOENT");
      return content;
    },
    async writeFile(path, content) {
      fs.set(path, content);
    },
    async mkdir(path) {
      dirs.add(path);
    },
    async unlink(path) {
      fs.delete(path);
    },
    async fileExists(path) {
      return fs.has(path) || dirs.has(path);
    },
    now: () => new Date("2026-10-14T00:00:00Z"),
    verifyCompletion: async () => ({
      passed: true,
      checks: [],
      errors: 0,
      warnings: 0,
      diagnostics: [],
      messages: [],
    }),
  };

  return { deps, dirs, fs };
}
