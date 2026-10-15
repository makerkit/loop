import { createPrdService, type PrdService } from "@makerkit/prd";
import { createNodePrdDeps } from "@makerkit/prd/node";
import { realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

let projectRoot: string | undefined;
let prdService: PrdService | undefined;

/**
 * The project Loop works on: the directory it was started in. Server only.
 * Resolved once; paths sent by the browser are never used.
 */
export function getProjectRoot() {
  projectRoot ??= realpathSync(resolve(process.env.LOOP_PROJECT_ROOT ?? process.cwd()));

  return projectRoot;
}

export function getProjectName() {
  return basename(getProjectRoot());
}

export function getPrdsDir() {
  return join(getProjectRoot(), ".prds");
}

export async function prdsDirExists() {
  try {
    return (await stat(getPrdsDir())).isDirectory();
  } catch {
    return false;
  }
}

/** `filename` must already be validated with PrdFilenameSchema. */
export async function prdFileExists(filename: string) {
  try {
    return (await stat(join(getPrdsDir(), filename))).isFile();
  } catch {
    return false;
  }
}

export function getPrdService() {
  prdService ??= createPrdService(createNodePrdDeps(getProjectRoot()));

  return prdService;
}
