import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createGit, GitError } from "./git";
import { parseGitStatus } from "./git-status";
import { runCommand } from "./run-command.server";
import { sanitizeOutput } from "./sanitize";

let root: string;

// Commands run by the code under test must not see this machine's git config either
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";

// A repo isolated from the machine's git config: no global hooks, no signing
function sh(...args: string[]) {
  return execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  }).toString();
}

function write(path: string, content = "x") {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "loop-git-"));
  sh("init", "-q", "-b", "main");
  sh("config", "user.name", "Test");
  sh("config", "user.email", "test@example.com");
  sh("config", "commit.gpgsign", "false");
  sh("config", "core.hooksPath", "/dev/null");
  write("README.md", "hello");
  write("old name.txt", "rename me");
  write("remove.txt", "bye");
  sh("add", ".");
  sh("commit", "-q", "-m", "init");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const git = () =>
  createGit({
    run: (command, args, options) => runCommand(command, args, options).then((result) => result),
    root,
    pathExists: async (path) => existsSync(path),
  });

describe("parseGitStatus", () => {
  it("reads renames, untracked files and odd names exactly", () => {
    expect(
      parseGitStatus("R  new.txt\0old.txt\0?? dir/a b.txt\0 M -flag.md\0 D gone\0UU c.txt\0"),
    ).toEqual([
      { path: "new.txt", previousPath: "old.txt", kind: "renamed", staged: true },
      { path: "dir/a b.txt", kind: "untracked", staged: false },
      { path: "-flag.md", kind: "modified", staged: false },
      { path: "gone", kind: "deleted", staged: false },
      { path: "c.txt", kind: "conflict", staged: false },
    ]);
  });
});

describe("git state and commit", () => {
  it("lists every changed file, including files inside new folders", async () => {
    write("README.md", "changed");
    write("src/new/file one.ts");
    write("-dash.ts");
    write(":(top)magic.ts");
    unlinkSync(join(root, "remove.txt"));

    const state = await git().state();

    expect(state.isRepo).toBe(true);
    expect(state.blockers).toEqual([]);
    expect(state.files.map((file) => `${file.kind} ${file.path}`).sort()).toEqual([
      "deleted remove.txt",
      "modified README.md",
      "untracked -dash.ts",
      "untracked :(top)magic.ts",
      "untracked src/new/file one.ts",
    ]);
  });

  it("commits only the chosen paths and leaves other changes, staged or not, alone", async () => {
    write("README.md", "story change");
    write("src/new/file one.ts");
    write(":(top)magic.ts");
    write("-dash.ts");
    write("unrelated.txt", "user work");
    sh("add", "unrelated.txt");
    write("also-unrelated.txt", "user work");

    const { sha } = await git().commit(
      ["README.md", "src/new/file one.ts", ":(top)magic.ts", "-dash.ts"],
      "US009: Approve or send back a story",
    );

    expect(sha).toMatch(/^[0-9a-f]+$/);
    expect(sh("log", "-1", "--format=%s")).toContain("US009: Approve or send back a story");
    expect(sh("show", "--name-only", "--format=", "HEAD").trim().split("\n").sort()).toEqual([
      "-dash.ts",
      ":(top)magic.ts",
      "README.md",
      "src/new/file one.ts",
    ]);

    const after = parseGitStatus(sh("status", "--porcelain=v1", "-z", "--untracked-files=all"));
    expect(after).toEqual([
      { path: "unrelated.txt", kind: "added", staged: true },
      { path: "also-unrelated.txt", kind: "untracked", staged: false },
    ]);
  });

  it("commits a rename when both of its paths are given", async () => {
    renameSync(join(root, "old name.txt"), join(root, "new name.txt"));
    sh("add", "-A");

    await git().commit(["new name.txt", "old name.txt"], "Rename");

    expect(sh("status", "--porcelain")).toBe("");
  });

  it("reports blockers that would make a commit fail", async () => {
    sh("config", "--unset", "user.email");
    writeFileSync(join(root, ".git", "index.lock"), "");

    const { blockers } = await git().state();

    expect(blockers).toEqual([
      "Another git command is running (index.lock exists).",
      "Git has no user name or email: run git config user.name and user.email.",
    ]);
  });

  it("explains a failing pre-commit hook without the absolute path", async () => {
    mkdirSync(join(root, "hooks"));
    writeFileSync(
      join(root, "hooks", "pre-commit"),
      `#!/bin/sh\necho "lint failed in ${root}/src/a.ts" >&2\nexit 1\n`,
      { mode: 0o755 },
    );
    sh("config", "core.hooksPath", "hooks");
    write("README.md", "change");

    await expect(git().commit(["README.md"], "x")).rejects.toThrow(GitError);
    await expect(git().commit(["README.md"], "x")).rejects.toThrow("lint failed in ./src/a.ts");
  });

  it("is not a repo outside git", async () => {
    const outside = mkdtempSync(join(tmpdir(), "loop-nogit-"));

    try {
      const state = await createGit({
        run: runCommand,
        root: outside,
        pathExists: async (path) => existsSync(path),
      }).state();

      expect(state).toEqual({ isRepo: false, files: [], blockers: [] });
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("sanitizeOutput", () => {
  it("removes the project path and secrets", () => {
    expect(
      sanitizeOutput(
        "error in /home/me/app/src/x.ts token=abc123 Bearer xyz.abc ghp_aaaaaaaaaaaaaaaaaaaaaaaa",
        "/home/me/app",
      ),
    ).toBe("error in ./src/x.ts token=[REDACTED_TOKEN] Bearer [REDACTED_TOKEN] [REDACTED_TOKEN]");
  });
});
