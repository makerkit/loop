import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { PrdFilenameSchema } from "#/lib/prds/prd-paths";
import { prdFileExists } from "#/lib/prds/project.server";

import { MANUAL_MOVES, type ManualMove } from "./moves";
import { lastProjectChange } from "#/lib/agent/activity";

import { getGitForProject, getReviewService, runProjectChecks } from "./review.server";

const StoryInput = z.object({
  filename: PrdFilenameSchema,
  storyId: z.string().regex(/^US\d+$/),
});

// Paths are only hints: the server keeps those git still reports as changed
const Paths = z.array(z.string().min(1).max(1000)).max(2000);
const Revision = z.number().int().min(0);

async function ensurePrd(filename: string) {
  if (!(await prdFileExists(filename))) {
    throw notFound();
  }
}

/** The git state for the approve view: changed files and what would block a commit. */
export const getReviewInfo = createServerFn({ method: "GET" })
  .validator(z.object({ filename: PrdFilenameSchema }))
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return getReviewService().info(data.filename);
  });

/** Runs the project checks so the user sees the result before approving. */
export const runChecks = createServerFn({ method: "POST" })
  .validator(z.object({ filename: PrdFilenameSchema }))
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return runProjectChecks();
  });

/** Approves a story in review: checks, completed, commit of the chosen files. */
export const approveStory = createServerFn({ method: "POST" })
  .validator(
    StoryInput.extend({
      paths: Paths,
      recordDeviations: z.array(z.string().min(1).max(5000)).max(100).optional(),
      expectedRevision: Revision,
    }),
  )
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return getReviewService().approve(data);
  });

/** Retries the commit for a story that was completed but not committed. */
export const commitStoryAgain = createServerFn({ method: "POST" })
  .validator(StoryInput.extend({ paths: Paths }))
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return getReviewService().commitAgain(data);
  });

/** Sends a story in review back to the agent with the user's notes. */
export const sendBackStory = createServerFn({ method: "POST" })
  .validator(
    StoryInput.extend({ feedback: z.string().trim().min(1).max(5000), expectedRevision: Revision }),
  )
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return getReviewService().sendBack(data);
  });

/** Reopens a completed story with the user's reason; nothing else. */
export const reopenStory = createServerFn({ method: "POST" })
  .validator(
    StoryInput.extend({ reason: z.string().trim().min(1).max(5000), expectedRevision: Revision }),
  )
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return getReviewService().reopen(data);
  });

/** Moves a story to blocked, research or not started; nothing else. */
export const moveStory = createServerFn({ method: "POST" })
  .validator(
    StoryInput.extend({
      to: z.enum(Object.keys(MANUAL_MOVES) as [ManualMove, ...ManualMove[]]),
      expectedRevision: Revision,
    }),
  )
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return getReviewService().move(data);
  });

/** When project files last changed (uncommitted, outside .prds), as a sign the agent is working. */
export const getProjectActivity = createServerFn({ method: "GET" }).handler(async () => {
  const { stat } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { getProjectRoot } = await import("#/lib/prds/project.server");
  const root = getProjectRoot();
  const state = await getGitForProject().state();
  const lastChangedAt = await lastProjectChange(state.files, (path) =>
    stat(join(root, path)).then(
      (stats) => stats.mtimeMs,
      () => null,
    ),
  );

  return { lastChangedAt, now: Date.now() };
});

const Line = z.string().trim().min(1).max(2000);

/** Edits a story: only the fields given change; dependencies are checked by PrdService. */
export const editStory = createServerFn({ method: "POST" })
  .validator(
    StoryInput.extend({
      changes: z
        .object({
          title: z.string().trim().min(1).max(300),
          userType: z.string().trim().min(1).max(300),
          action: z.string().trim().min(1).max(1000),
          benefit: z.string().trim().min(1).max(1000),
          acceptanceCriteria: z.array(Line).min(1).max(100),
          proofs: z
            .array(
              z
                .object({
                  criterion: Line,
                  kind: z.enum(["unit", "integration", "e2e", "judge", "manual", "post-deploy"]),
                  seam: Line.optional(),
                  reason: Line.optional(),
                  fallback: Line.optional(),
                  rubric: z.array(Line).max(20).optional(),
                })
                .strict(),
            )
            .max(100),
          testSeams: z.array(Line).max(50),
          designNotes: z.array(Line).max(50),
          securityNotes: z.array(Line).max(50),
          priority: z.enum(["P0", "P1", "P2", "P3"]),
          estimatedComplexity: z.enum(["XS", "S", "M", "L", "XL"]),
          dependencies: z.array(z.string().regex(/^US\d+$/)).max(100),
          phaseId: z
            .string()
            .regex(/^[A-Za-z0-9_-]{1,40}$/)
            .nullable(),
        })
        .partial()
        .strict(),
      expectedRevision: Revision,
    }),
  )
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return getReviewService().edit(data);
  });
