import type { StoryStatus, StructuredPRD } from "@makerkit/prd";

/**
 * Status changes a person makes from the board, keyed by target status: any
 * status but completed, from any status but completed, except review to in
 * progress, which is sending a story back with notes for the agent. Completed
 * happens only by approving a story in review, and a completed story goes back
 * only by reopening it with a reason.
 * PrdService still refuses work statuses while dependencies are incomplete.
 * Pure; enforced on the server.
 */
export const MANUAL_MOVES = {
  not_started: ["research", "in_progress", "review", "blocked"],
  research: ["not_started", "in_progress", "review", "blocked"],
  in_progress: ["not_started", "research", "blocked"],
  review: ["not_started", "research", "in_progress", "blocked"],
  blocked: ["not_started", "research", "in_progress", "review"],
} as const satisfies Partial<Record<StoryStatus, readonly StoryStatus[]>>;

export type ManualMove = keyof typeof MANUAL_MOVES;

export const MOVE_LABELS: Record<ManualMove, string> = {
  not_started: "Not started",
  research: "Research",
  in_progress: "In progress",
  review: "Review",
  blocked: "Blocked",
};

export function canMove(from: StoryStatus, to: ManualMove) {
  return (MANUAL_MOVES[to] as readonly StoryStatus[]).includes(from);
}

/** The moves offered for a story in `status`. */
export function movesFrom(status: StoryStatus): ManualMove[] {
  return (Object.keys(MANUAL_MOVES) as ManualMove[]).filter((to) => canMove(status, to));
}

/** A step in the story view that needs more from the person than a move. */
export type StoryStep = "send-back" | "reopen";

/**
 * What dropping a story on a board column does: a manual move, or opening the
 * story at the step that needs more from the person: approving a story in
 * review, sending it back with notes for the agent, or reopening a completed
 * one with a reason. Null when not allowed.
 */
export type BoardDrop = { kind: "move"; to: ManualMove } | { kind: "open"; step?: StoryStep };

/** Statuses PrdService refuses while a story's dependencies are not completed. */
const WORK_STATUSES: StoryStatus[] = ["in_progress", "review", "completed"];

/** `waitingOn`: the story's dependencies that are not completed yet. */
export function dropOn(
  from: StoryStatus,
  to: StoryStatus,
  waitingOn: readonly string[] = [],
): BoardDrop | null {
  if (waitingOn.length > 0 && WORK_STATUSES.includes(to)) {
    return null;
  }

  // Back to the agent: with notes on what to change, not a silent move
  if (from === "review" && to === "in_progress") {
    return { kind: "open", step: "send-back" };
  }

  if (from === "review" && to === "completed") {
    return { kind: "open" };
  }

  if (from === "completed" && to === "not_started") {
    return { kind: "open", step: "reopen" };
  }

  const move = movesFrom(from).find((allowed) => allowed === to);

  return move ? { kind: "move", to: move } : null;
}

/** Why a column takes no drops, shown while dragging. */
export function noDropReason(to: StoryStatus, waitingOn: readonly string[] = []) {
  if (waitingOn.length > 0 && WORK_STATUSES.includes(to)) {
    return `Waits for ${waitingOn.join(", ")}`;
  }

  return to === "completed" ? "Approve a story in review" : null;
}

/**
 * Stories built on top of `storyId`: they depend on it and work on them has
 * started or finished. Reopening `storyId` leaves their status alone, so the
 * user is told which ones to recheck.
 */
export function startedDependents(prd: StructuredPRD, storyId: string) {
  return prd.userStories.filter(
    (story) =>
      story.dependencies.includes(storyId) &&
      (story.status === "in_progress" || story.status === "review" || story.status === "completed"),
  );
}
