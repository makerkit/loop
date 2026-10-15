import type { PrdService, StoryLogEntry, UserStory } from "@makerkit/prd";

import type { Git } from "#/lib/git/git";
import type { GitChangedFile } from "#/lib/git/git-status";
import { sanitizeOutput } from "#/lib/git/sanitize";

import { canMove, type ManualMove } from "./moves";
import type { StoryChanges } from "./story-edit";

export interface ReviewDeps {
  prd: Pick<PrdService, "get" | "updateStoryStatus" | "updateUserStory">;
  git: Git;
  root: string;
  today(): string;
}

export interface ReviewInfo {
  isRepo: boolean;
  /** Changed files, with this PRD's own file marked: it is always committed. */
  files: Array<GitChangedFile & { isPrdFile: boolean }>;
  blockers: string[];
  prdPath: string;
}

export type ReviewResult =
  | { status: "approved"; commit: { sha: string } | null; commitError?: string }
  | { status: "sent-back" }
  | { status: "moved" }
  | { status: "reopened" }
  | { status: "edited" }
  | { status: "committed"; commit: { sha: string } }
  | { status: "conflict" }
  | { status: "refused"; message: string };

/** All deviations recorded across the story's log, oldest first. */
export function collectDeviations(log: StoryLogEntry[] | undefined) {
  return (log ?? []).flatMap((entry) => entry.deviations ?? []);
}

export function commitMessage(story: Pick<UserStory, "id" | "title">) {
  return `${story.id}: ${story.title}\n\nApproved in Makerkit Loop.`;
}

/** Feedback goes first, dated; earlier notes are kept below it. */
export function sendBackNotes(
  feedback: string,
  previous: string | undefined,
  date: string,
  label = "Sent back",
) {
  const entry = `${label} on ${date}:\n${feedback.trim()}`;

  return previous?.trim() ? `${entry}\n\n${previous.trim()}` : entry;
}

function isConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "PRD_REVISION_CONFLICT"
  );
}

/**
 * Approve, send back and move stories. Approval runs the project checks
 * (through PrdService), marks the story completed, then commits the files
 * the user chose plus the PRD file, leaving every other change alone.
 */
export function createReviewService(deps: ReviewDeps) {
  const clean = (text: string) => sanitizeOutput(text, deps.root);

  async function loadStory(filename: string, storyId: string) {
    const { prd } = await deps.prd.get({ filename });
    const story = prd.userStories.find((candidate) => candidate.id === storyId);

    if (!story) {
      throw new Error(`Story ${storyId} not found.`);
    }

    return story;
  }

  async function info(filename: string): Promise<ReviewInfo> {
    const prdPath = `.prds/${filename}`;
    const state = await deps.git.state();

    return {
      isRepo: state.isRepo,
      blockers: state.blockers,
      prdPath,
      files: state.files.map((file) => ({ ...file, isPrdFile: file.path === prdPath })),
    };
  }

  /**
   * The paths to commit: the chosen ones that git still reports as changed
   * (renames bring their old path), plus this PRD's file. Never trusts the
   * browser's list on its own.
   */
  async function pathsToCommit(filename: string, chosen: string[]) {
    const prdPath = `.prds/${filename}`;
    const folder = filename.replace(/\.json$/, "");
    const { files } = await deps.git.state();
    const wanted = new Set(chosen);
    const paths = new Set<string>();

    for (const file of files) {
      // Other PRDs' files are never committed with this story; its own attachments may be
      const otherPrd = file.path.startsWith(".prds/") && !file.path.startsWith(`.prds/${folder}/`);

      if (file.path === prdPath || (wanted.has(file.path) && !otherPrd)) {
        paths.add(file.path);

        if (file.previousPath) {
          paths.add(file.previousPath);
        }
      }
    }

    return [...paths];
  }

  async function commit(filename: string, story: UserStory, chosen: string[]) {
    const paths = await pathsToCommit(filename, chosen);

    return deps.git.commit(paths, commitMessage(story));
  }

  return {
    info,

    async approve(input: {
      filename: string;
      storyId: string;
      paths: string[];
      expectedRevision: number;
    }): Promise<ReviewResult> {
      const story = await loadStory(input.filename, input.storyId);

      if (story.status !== "review") {
        return { status: "refused", message: `${story.id} is not in review.` };
      }

      const git = await deps.git.state();

      // A commit that cannot succeed must not leave a completed, uncommitted story
      if (git.isRepo && git.blockers.length > 0) {
        return { status: "refused", message: git.blockers.join(" ") };
      }

      try {
        await deps.prd.updateStoryStatus({
          filename: input.filename,
          storyId: input.storyId,
          status: "completed",
          expectedRevision: input.expectedRevision,
        });
      } catch (error) {
        if (isConflict(error)) {
          return { status: "conflict" };
        }

        return {
          status: "refused",
          message: clean(error instanceof Error ? error.message : "The checks failed."),
        };
      }

      if (!git.isRepo) {
        return { status: "approved", commit: null };
      }

      try {
        return {
          status: "approved",
          commit: await commit(input.filename, story, input.paths),
        };
      } catch (error) {
        return {
          status: "approved",
          commit: null,
          commitError: clean(error instanceof Error ? error.message : "The commit failed."),
        };
      }
    },

    /** After "completed but not committed": try the commit again. */
    async commitAgain(input: {
      filename: string;
      storyId: string;
      paths: string[];
    }): Promise<ReviewResult> {
      const story = await loadStory(input.filename, input.storyId);

      if (story.status !== "completed") {
        return { status: "refused", message: `${story.id} is not completed.` };
      }

      try {
        return { status: "committed", commit: await commit(input.filename, story, input.paths) };
      } catch (error) {
        return {
          status: "refused",
          message: clean(error instanceof Error ? error.message : "The commit failed."),
        };
      }
    },

    async sendBack(input: {
      filename: string;
      storyId: string;
      feedback: string;
      expectedRevision: number;
    }): Promise<ReviewResult> {
      const story = await loadStory(input.filename, input.storyId);

      if (story.status !== "review") {
        return { status: "refused", message: `${story.id} is not in review.` };
      }

      try {
        await deps.prd.updateStoryStatus({
          filename: input.filename,
          storyId: input.storyId,
          status: "in_progress",
          notes: sendBackNotes(input.feedback, story.notes, deps.today()),
          expectedRevision: input.expectedRevision,
        });

        return { status: "sent-back" };
      } catch (error) {
        if (isConflict(error)) {
          return { status: "conflict" };
        }

        return { status: "refused", message: clean(error instanceof Error ? error.message : "") };
      }
    },

    /**
     * Reopens a completed story: back to not started, with the reason first in
     * its notes for the agent. PrdService clears its completion date and check
     * results; its log and the approval commit stay.
     */
    async reopen(input: {
      filename: string;
      storyId: string;
      reason: string;
      expectedRevision: number;
    }): Promise<ReviewResult> {
      const story = await loadStory(input.filename, input.storyId);

      if (story.status !== "completed") {
        return { status: "refused", message: `${story.id} is not completed.` };
      }

      try {
        await deps.prd.updateStoryStatus({
          filename: input.filename,
          storyId: input.storyId,
          status: "not_started",
          notes: sendBackNotes(input.reason, story.notes, deps.today(), "Reopened"),
          expectedRevision: input.expectedRevision,
        });

        return { status: "reopened" };
      } catch (error) {
        if (isConflict(error)) {
          return { status: "conflict" };
        }

        return { status: "refused", message: clean(error instanceof Error ? error.message : "") };
      }
    },

    /** Edits a story's fields (only those given); completed stories are read-only. */
    async edit(input: {
      filename: string;
      storyId: string;
      changes: StoryChanges;
      expectedRevision: number;
    }): Promise<ReviewResult> {
      const story = await loadStory(input.filename, input.storyId);

      if (story.status === "completed") {
        return {
          status: "refused",
          message: `${story.id} is completed and can no longer be edited.`,
        };
      }

      if (Object.keys(input.changes).length === 0) {
        return { status: "edited" };
      }

      try {
        await deps.prd.updateUserStory({
          ...input.changes,
          filename: input.filename,
          storyId: input.storyId,
          expectedRevision: input.expectedRevision,
        });

        return { status: "edited" };
      } catch (error) {
        if (isConflict(error)) {
          return { status: "conflict" };
        }

        return { status: "refused", message: clean(error instanceof Error ? error.message : "") };
      }
    },

    async move(input: {
      filename: string;
      storyId: string;
      to: ManualMove;
      expectedRevision: number;
    }): Promise<ReviewResult> {
      const story = await loadStory(input.filename, input.storyId);

      if (!canMove(story.status, input.to)) {
        return {
          status: "refused",
          message: `${story.id} cannot move from ${story.status} to ${input.to} here.`,
        };
      }

      try {
        await deps.prd.updateStoryStatus({
          filename: input.filename,
          storyId: input.storyId,
          status: input.to,
          expectedRevision: input.expectedRevision,
        });

        return { status: "moved" };
      } catch (error) {
        if (isConflict(error)) {
          return { status: "conflict" };
        }

        return { status: "refused", message: clean(error instanceof Error ? error.message : "") };
      }
    },
  };
}

export type ReviewService = ReturnType<typeof createReviewService>;
