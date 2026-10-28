import type { ManualMove } from "./moves";
import { createPrdService, type PrdVerificationResult, type StructuredPRD } from "@makerkit/prd";
import { createNodePrdDeps } from "@makerkit/prd/node";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createGit } from "#/lib/git/git";
import { parseGitStatus } from "#/lib/git/git-status";
import { runCommand } from "#/lib/git/run-command.server";

import { collectDeviations, createReviewService, sendBackNotes } from "./review";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";

let root: string;
let checksPass: boolean;

function sh(...args: string[]) {
  return execFileSync("git", args, { cwd: root }).toString();
}

function write(path: string, content = "x") {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), content);
}

const readPrd = () =>
  JSON.parse(readFileSync(join(root, ".prds", "notes.json"), "utf8")) as StructuredPRD;

function setup({ git = true } = {}) {
  root = mkdtempSync(join(tmpdir(), "loop-review-"));
  checksPass = true;

  write(
    ".prds/notes.json",
    JSON.stringify({
      introduction: { title: "Notes", overview: "x" },
      userStories: [
        {
          id: "US001",
          title: "Save a note",
          userStory: "",
          acceptanceCriteria: ["a", "b"],
          status: "review",
          priority: "P1",
          dependencies: [],
          notes: "Earlier note",
        },
        {
          id: "US002",
          title: "Share",
          userStory: "",
          acceptanceCriteria: ["a", "b"],
          status: "not_started",
          priority: "P1",
          dependencies: [],
        },
      ],
      metadata: { revision: 5 },
    }),
  );

  if (git) {
    sh("init", "-q", "-b", "main");
    sh("config", "user.name", "Test");
    sh("config", "user.email", "test@example.com");
    sh("config", "commit.gpgsign", "false");
    sh("config", "core.hooksPath", "/dev/null");
    write("README.md", "hello");
    sh("add", ".");
    sh("commit", "-q", "-m", "init");
  }

  const verify = async (): Promise<PrdVerificationResult> => ({
    passed: checksPass,
    checks: ["typecheck"],
    errors: checksPass ? 0 : 1,
    warnings: 0,
    diagnostics: [],
    messages: checksPass ? [] : [`typecheck: fail (${root}/src/a.ts: Type error)`],
  });

  return createReviewService({
    prd: createPrdService(createNodePrdDeps(root, { verifyCompletion: verify })),
    git: createGit({ run: runCommand, root, pathExists: async (path) => existsSync(path) }),
    root,
    today: () => "2026-10-15",
  });
}

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("approve", () => {
  beforeEach(() => undefined);

  it("completes the story and commits the chosen files with the PRD, leaving the rest alone", async () => {
    const review = setup();

    write("src/note.ts", "export {}");
    write("README.md", "story change");
    write("unrelated.txt", "user work");
    sh("add", "unrelated.txt");
    write("scratch.txt", "user work");

    const result = await review.approve({
      filename: "notes.json",
      storyId: "US001",
      paths: ["src/note.ts", "README.md"],
      expectedRevision: 5,
    });

    expect(result).toMatchObject({ status: "approved", commit: { sha: expect.any(String) } });
    expect(readPrd().userStories[0]?.status).toBe("completed");
    expect(sh("log", "-1", "--format=%s")).toBe("US001: Save a note\n");
    expect(sh("show", "--name-only", "--format=", "HEAD").trim().split("\n").sort()).toEqual([
      ".prds/notes.json",
      "README.md",
      "src/note.ts",
    ]);
    expect(parseGitStatus(sh("status", "--porcelain=v1", "-z", "--untracked-files=all"))).toEqual([
      { path: "unrelated.txt", kind: "added", staged: true },
      { path: "scratch.txt", kind: "untracked", staged: false },
    ]);
  });

  it("commits just the PRD file when the code is already committed", async () => {
    const review = setup();

    write("src/note.ts");
    sh("add", ".");
    sh("commit", "-q", "-m", "work");

    const result = await review.approve({
      filename: "notes.json",
      storyId: "US001",
      paths: [],
      expectedRevision: 5,
    });

    expect(result).toMatchObject({ status: "approved" });
    expect(sh("show", "--name-only", "--format=", "HEAD").trim()).toBe(".prds/notes.json");
  });

  it("is refused while the checks fail, without the absolute path; nothing changes", async () => {
    const review = setup();

    checksPass = false;
    write("src/note.ts");

    const result = await review.approve({
      filename: "notes.json",
      storyId: "US001",
      paths: ["src/note.ts"],
      expectedRevision: 5,
    });

    expect(result.status).toBe("refused");
    expect(result.status === "refused" && result.message).toContain("./src/a.ts: Type error");
    expect(result.status === "refused" && result.message).not.toContain(root);
    expect(readPrd().userStories[0]?.status).toBe("review");
    expect(sh("log", "--format=%s")).toBe("init\n");
  });

  it("is refused for a story that is not in review, or a stale revision", async () => {
    const review = setup();

    expect(
      await review.approve({
        filename: "notes.json",
        storyId: "US002",
        paths: [],
        expectedRevision: 5,
      }),
    ).toEqual({ status: "refused", message: "US002 is not in review." });
    expect(
      await review.approve({
        filename: "notes.json",
        storyId: "US001",
        paths: [],
        expectedRevision: 4,
      }),
    ).toEqual({ status: "conflict" });
  });

  it("is refused before completing when git could not commit", async () => {
    const review = setup();

    writeFileSync(join(root, ".git", "index.lock"), "");

    const result = await review.approve({
      filename: "notes.json",
      storyId: "US001",
      paths: [],
      expectedRevision: 5,
    });

    expect(result.status).toBe("refused");
    expect(readPrd().userStories[0]?.status).toBe("review");
  });

  it("says when the story was completed but the commit failed, and can commit again", async () => {
    const review = setup();

    mkdirSync(join(root, "hooks"));
    writeFileSync(
      join(root, "hooks", "pre-commit"),
      "#!/bin/sh\necho 'lint failed' >&2\nexit 1\n",
      {
        mode: 0o755,
      },
    );
    sh("config", "core.hooksPath", "hooks");
    write("src/note.ts");

    const result = await review.approve({
      filename: "notes.json",
      storyId: "US001",
      paths: ["src/note.ts"],
      expectedRevision: 5,
    });

    expect(result).toMatchObject({
      status: "approved",
      commit: null,
      commitError: expect.stringContaining("lint failed"),
    });
    expect(readPrd().userStories[0]?.status).toBe("completed");

    sh("config", "core.hooksPath", "/dev/null");

    expect(
      await review.commitAgain({
        filename: "notes.json",
        storyId: "US001",
        paths: ["src/note.ts"],
      }),
    ).toMatchObject({ status: "committed" });
    expect(sh("log", "-1", "--format=%s")).toBe("US001: Save a note\n");
  });

  it("completes without committing outside a git repository", async () => {
    const review = setup({ git: false });

    expect(
      await review.approve({
        filename: "notes.json",
        storyId: "US001",
        paths: [],
        expectedRevision: 5,
      }),
    ).toEqual({ status: "approved", commit: null, decisions: [] });
    expect(readPrd().userStories[0]?.status).toBe("completed");
  });

  it("records the deviations the user ticked as decisions in the PRD", async () => {
    const review = setup({ git: false });
    const prd = readPrd();

    prd.userStories[0]!.log = [
      {
        at: "2026-10-15T09:00:00Z",
        whatsNew: ["Saves"],
        technicalNotes: [],
        deviations: ["Saved to IndexedDB, for size", "Added a word count"],
      },
    ];
    write(".prds/notes.json", JSON.stringify(prd));

    expect(
      await review.approve({
        filename: "notes.json",
        storyId: "US001",
        paths: [],
        recordDeviations: ["Saved to IndexedDB, for size"],
        expectedRevision: 5,
      }),
    ).toEqual({ status: "approved", commit: null, decisions: ["DEC001"] });
    expect(readPrd().decisionLog).toEqual([
      expect.objectContaining({
        decision: "Saved to IndexedDB, for size",
        status: "accepted",
        topic: "story:US001:deviation",
      }),
    ]);
  });
});

describe("send back and move", () => {
  it("sends a story back with dated feedback above the earlier notes", async () => {
    const review = setup();

    expect(
      await review.sendBack({
        filename: "notes.json",
        storyId: "US001",
        feedback: "The empty state is missing.",
        expectedRevision: 5,
      }),
    ).toEqual({ status: "sent-back" });

    const story = readPrd().userStories[0]!;

    expect(story.status).toBe("in_progress");
    expect(story.notes).toBe(
      "Sent back on 2026-10-15:\nThe empty state is missing.\n\nEarlier note",
    );
  });

  it("moves between any statuses but completed", async () => {
    const review = setup({ git: false });
    const move = (storyId: string, to: ManualMove, expectedRevision: number) =>
      review.move({ filename: "notes.json", storyId, to, expectedRevision });

    expect(await move("US002", "in_progress", 5)).toEqual({ status: "moved" });
    expect(await move("US002", "review", 6)).toEqual({ status: "moved" });
    expect(await move("US002", "not_started", 7)).toEqual({ status: "moved" });
    expect(readPrd().userStories[1]?.status).toBe("not_started");

    // Back to the agent only by sending back, with notes
    expect(await move("US001", "in_progress", 8)).toMatchObject({ status: "refused" });

    // A completed story only goes back by reopening it with a reason
    await review.approve({
      filename: "notes.json",
      storyId: "US001",
      paths: [],
      expectedRevision: 8,
    });
    expect(readPrd().userStories[0]?.status).toBe("completed");
    expect(await move("US001", "in_progress", readPrd().metadata.revision ?? 0)).toMatchObject({
      status: "refused",
    });
  });
});

describe("reopen", () => {
  it("reopens a completed story with the reason first in its notes", async () => {
    const review = setup({ git: false });

    await review.approve({
      filename: "notes.json",
      storyId: "US001",
      paths: [],
      expectedRevision: 5,
    });

    const before = readPrd();

    expect(
      await review.reopen({
        filename: "notes.json",
        storyId: "US001",
        reason: "Notes vanish after a reload.",
        expectedRevision: before.metadata.revision ?? 0,
      }),
    ).toEqual({ status: "reopened" });

    const story = readPrd().userStories[0]!;

    expect(story.status).toBe("not_started");
    expect(story.completedAt).toBeUndefined();
    expect(story.verification).toBeUndefined();
    expect(story.notes).toMatch(/^Reopened on 2026-10-15:\nNotes vanish after a reload\./);
    expect(story.log).toEqual(before.userStories[0]!.log);
  });

  it("refuses stories that are not completed, and stale reopens", async () => {
    const review = setup({ git: false });

    expect(
      await review.reopen({
        filename: "notes.json",
        storyId: "US001",
        reason: "Why",
        expectedRevision: 5,
      }),
    ).toEqual({ status: "refused", message: "US001 is not completed." });

    await review.approve({
      filename: "notes.json",
      storyId: "US001",
      paths: [],
      expectedRevision: 5,
    });

    expect(
      await review.reopen({
        filename: "notes.json",
        storyId: "US001",
        reason: "Why",
        expectedRevision: 5,
      }),
    ).toEqual({ status: "conflict" });
    expect(readPrd().userStories[0]?.status).toBe("completed");
  });
});

describe("helpers", () => {
  it("collects deviations from every log entry", () => {
    expect(
      collectDeviations([
        { at: "1", whatsNew: ["a"], technicalNotes: [], deviations: ["First"] },
        { at: "2", whatsNew: ["b"], technicalNotes: [] },
        { at: "3", whatsNew: ["c"], technicalNotes: [], deviations: ["Second"] },
      ]),
    ).toEqual(["First", "Second"]);
  });

  it("starts notes with the feedback", () => {
    expect(sendBackNotes(" Fix it ", undefined, "2026-10-15")).toBe(
      "Sent back on 2026-10-15:\nFix it",
    );
  });
});

describe("edit", () => {
  it("edits only the given fields, refuses cycles and completed stories", async () => {
    const review = setup();

    expect(
      await review.edit({
        filename: "notes.json",
        storyId: "US002",
        changes: { title: "Share a note", dependencies: ["US001"] },
        expectedRevision: 5,
      }),
    ).toEqual({ status: "edited" });
    expect(readPrd().userStories[1]).toMatchObject({
      title: "Share a note",
      dependencies: ["US001"],
    });

    const cycle = await review.edit({
      filename: "notes.json",
      storyId: "US001",
      changes: { dependencies: ["US002"] },
      expectedRevision: 6,
    });

    expect(cycle.status).toBe("refused");
    expect(
      await review.edit({
        filename: "notes.json",
        storyId: "US002",
        changes: { title: "x" },
        expectedRevision: 5,
      }),
    ).toEqual({ status: "conflict" });
  });
});
