import { createScriptVerifier } from "@makerkit/prd/node";
import { access } from "node:fs/promises";

import { createGit } from "#/lib/git/git";
import { runCommand } from "#/lib/git/run-command.server";
import { sanitizeOutput } from "#/lib/git/sanitize";
import { getPrdService, getProjectRoot } from "#/lib/prds/project.server";

import { createReviewService } from "./review";

/** Git for the project Loop was started in. Server only. */
export function getGitForProject() {
  return createGit({
    run: runCommand,
    root: getProjectRoot(),
    pathExists: (path) =>
      access(path).then(
        () => true,
        () => false,
      ),
  });
}

/** The review service for the project Loop was started in. Server only. */
export function getReviewService() {
  const root = getProjectRoot();

  return createReviewService({
    prd: getPrdService(),
    git: getGitForProject(),
    root,
    today: () => new Date().toISOString().slice(0, 10),
  });
}

/** Runs the project checks (typecheck, lint) the completion check uses, for display. */
export async function runProjectChecks() {
  const root = getProjectRoot();
  const result = await createScriptVerifier(root)();

  return {
    passed: result.passed,
    checks: result.checks,
    messages: result.messages.map((message) => sanitizeOutput(message, root)),
  };
}
