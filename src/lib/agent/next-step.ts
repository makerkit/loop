import type { CheckPlanOutput, GetNextStoryOutput, StructuredPRD } from "@makerkit/prd";

/**
 * What the user should do next for a PRD, and the exact instruction to give
 * their agent when it is the agent's turn. Pure.
 *
 * Order: a story waiting for review comes first (the user's turn), then a
 * story already started (finish it before starting another), then a plan
 * that is not ready, then the next ready story.
 */
export type NextStep =
  | { kind: "review"; storyId: string; title: string }
  | { kind: "continue"; storyId: string; title: string; sentBack: boolean; instruction: string }
  | { kind: "shape"; reason: string; instruction: string }
  | { kind: "implement"; storyId: string; title: string; instruction: string }
  | { kind: "waiting"; reason: string }
  | { kind: "done" };

export const START_INSTRUCTION =
  "Use the shape_prd prompt to plan a new feature with me and save it as a PRD in .prds";

export function nextStep(
  filename: string,
  prd: StructuredPRD,
  next: GetNextStoryOutput,
  check: CheckPlanOutput,
): NextStep {
  const stories = prd.userStories;
  const inReview = stories.find((story) => story.status === "review");

  if (inReview) {
    return { kind: "review", storyId: inReview.id, title: inReview.title };
  }

  const started = stories.find(
    (story) => story.status === "in_progress" || story.status === "research",
  );

  if (started) {
    const sentBack = started.notes?.startsWith("Sent back on ") ?? false;

    return {
      kind: "continue",
      storyId: started.id,
      title: started.title,
      sentBack,
      instruction: sentBack
        ? `Continue story ${started.id} from ${filename}: it was sent back, so read its notes first and fix what they ask`
        : `Continue story ${started.id} from ${filename} with the implement_story prompt`,
    };
  }

  if (!check.ready_to_build) {
    const first = check.items.find((item) => item.severity === "required");

    return {
      kind: "shape",
      reason: first?.message ?? "The plan is not ready to build.",
      instruction: `Use the shape_prd prompt to finish the plan in ${filename}`,
    };
  }

  if (next.story) {
    return {
      kind: "implement",
      storyId: next.story.id,
      title: next.story.title,
      instruction: `Implement story ${next.story.id} from ${filename} with the implement_story prompt`,
    };
  }

  if (stories.length > 0 && stories.every((story) => story.status === "completed")) {
    return { kind: "done" };
  }

  const blocked = stories.filter((story) => story.status === "blocked");

  return {
    kind: "waiting",
    reason:
      blocked.length > 0
        ? `${blocked.map((story) => story.id).join(", ")} ${blocked.length === 1 ? "is" : "are"} blocked; unblock ${blocked.length === 1 ? "it" : "them"} to continue.`
        : "No story is ready: the remaining ones wait for others to be completed.",
  };
}
