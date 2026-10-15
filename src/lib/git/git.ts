import { parseGitStatus, type GitChangedFile } from "./git-status";
import { sanitizeOutput } from "./sanitize";

/** Runs a command with an argument array (never a shell string). */
export type RunCommand = (
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number },
) => Promise<{ code: number; stdout: string; stderr: string }>;

export interface GitDeps {
  run: RunCommand;
  /** The project root; every command runs there. */
  root: string;
  pathExists(path: string): Promise<boolean>;
}

export interface GitState {
  isRepo: boolean;
  files: GitChangedFile[];
  /** Reasons a commit would fail now (conflicts, a merge in progress...). */
  blockers: string[];
}

const STATUS_TIMEOUT = 20_000;
// Pre-commit hooks can be slow; a signing prompt would otherwise hang forever
const COMMIT_TIMEOUT = 180_000;

export class GitError extends Error {}

/** Git for the approval step: read the changes, check a commit can succeed, commit chosen paths. */
export function createGit(deps: GitDeps) {
  const git = (args: string[], timeoutMs = STATUS_TIMEOUT) =>
    // Pathspec magic like ":(top)" in a file name must not change what is committed
    deps.run("git", ["--literal-pathspecs", ...args], { cwd: deps.root, timeoutMs });

  const clean = (text: string) => sanitizeOutput(text, deps.root).trim();

  async function gitPathExists(name: string) {
    const result = await git(["rev-parse", "--git-path", name]);

    if (result.code !== 0) {
      return false;
    }

    const path = result.stdout.trim();

    return deps.pathExists(path.startsWith("/") ? path : `${deps.root}/${path}`);
  }

  async function state(): Promise<GitState> {
    const repo = await git(["rev-parse", "--is-inside-work-tree"]);

    if (repo.code !== 0 || repo.stdout.trim() !== "true") {
      return { isRepo: false, files: [], blockers: [] };
    }

    const status = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);

    if (status.code !== 0) {
      throw new GitError(clean(status.stderr) || "Could not read the git changes.");
    }

    const files = parseGitStatus(status.stdout);
    const blockers: string[] = [];

    if (files.some((file) => file.kind === "conflict")) {
      blockers.push("There are unresolved merge conflicts.");
    }

    if (await gitPathExists("MERGE_HEAD")) {
      blockers.push("A merge is in progress.");
    }

    if ((await gitPathExists("rebase-merge")) || (await gitPathExists("rebase-apply"))) {
      blockers.push("A rebase is in progress.");
    }

    if (await gitPathExists("index.lock")) {
      blockers.push("Another git command is running (index.lock exists).");
    }

    const name = await git(["config", "user.name"]);
    const email = await git(["config", "user.email"]);

    if (!name.stdout.trim() || !email.stdout.trim()) {
      blockers.push("Git has no user name or email: run git config user.name and user.email.");
    }

    return { isRepo: true, files, blockers };
  }

  /**
   * Commits exactly `paths` (their working-tree content) and nothing else:
   * other staged or unstaged changes stay as they are.
   */
  async function commit(paths: string[], message: string) {
    if (paths.length === 0) {
      throw new GitError("Nothing to commit.");
    }

    const { files } = await state();
    const untracked = new Set(
      files.filter((file) => file.kind === "untracked").map((file) => file.path),
    );
    const toAdd = paths.filter((path) => untracked.has(path));

    if (toAdd.length > 0) {
      const add = await git(["add", "--", ...toAdd]);

      if (add.code !== 0) {
        throw new GitError(clean(add.stderr) || "Could not add the new files.");
      }
    }

    const result = await git(
      ["commit", "--no-edit", "-m", message, "--", ...paths],
      COMMIT_TIMEOUT,
    );

    if (result.code !== 0) {
      throw new GitError(clean(`${result.stderr}\n${result.stdout}`) || "The commit failed.");
    }

    const head = await git(["rev-parse", "--short", "HEAD"]);

    return { sha: head.stdout.trim() };
  }

  return { state, commit };
}

export type Git = ReturnType<typeof createGit>;
