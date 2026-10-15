import type { CheckPlanOutput, StructuredPRD } from "@makerkit/prd";

/**
 * Where a PRD stands, for the PRD list. Pure.
 * - planning: the plan check still has required items, and nothing is being built
 * - ready: the plan is ready and no story has started
 * - building: a story is in research or in progress
 * - review: a story waits for the user's approval
 * - done: every story is completed
 */
export type PrdStage = "planning" | "ready" | "building" | "review" | "done";

export const STAGE_LABELS: Record<PrdStage, string> = {
  planning: "Planning",
  ready: "Ready to build",
  building: "Building",
  review: "In review",
  done: "Done",
};

export interface PrdOverview {
  stage: PrdStage;
  readyToBuild: boolean;
  requiredItems: number;
  recommendedItems: number;
  openQuestions: number;
  openEdgeCases: number;
  /** Stories in review: waiting for the user to approve or send back. */
  inReview: number;
  /** Questions, open edge cases or stories in review: something only the user can do. */
  waitingOnUser: boolean;
}

export function getPrdOverview(prd: StructuredPRD, check: CheckPlanOutput): PrdOverview {
  const stories = prd.userStories;
  const count = (...statuses: string[]) =>
    stories.filter((story) => statuses.includes(story.status)).length;

  const inReview = count("review");
  const openQuestions = prd.openQuestions.length;
  const openEdgeCases = prd.edgeCases.filter((edgeCase) => edgeCase.status === "open").length;

  let stage: PrdStage;

  if (stories.length > 0 && count("completed") === stories.length) {
    stage = "done";
  } else if (inReview > 0) {
    stage = "review";
  } else if (count("in_progress", "research") > 0) {
    stage = "building";
  } else {
    stage = check.ready_to_build ? "ready" : "planning";
  }

  return {
    stage,
    readyToBuild: check.ready_to_build,
    requiredItems: check.items.filter((item) => item.severity === "required").length,
    recommendedItems: check.items.filter((item) => item.severity === "recommended").length,
    openQuestions,
    openEdgeCases,
    inReview,
    waitingOnUser: openQuestions + openEdgeCases + inReview > 0,
  };
}
