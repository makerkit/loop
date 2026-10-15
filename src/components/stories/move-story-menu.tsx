import type { UserStory } from "@makerkit/prd";
import { MoreHorizontalIcon } from "lucide-react";

import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { dropOn, MOVE_LABELS, movesFrom, type StoryStep } from "#/lib/stories/moves";
import { cn } from "#/lib/utils";

import { StatusDot } from "./story-status";
import { useMoveStory } from "./use-move-story";

const STEP_LABELS: Record<StoryStep, string> = {
  "send-back": "Send back…",
  reopen: "Reopen…",
};

/**
 * "Move to…": the status changes a person may make. Completed is only reached
 * by approving a story in review. Moves that wait for dependencies are shown
 * disabled. With `onStep` (on the board), it also offers sending a story in
 * review back and reopening a completed one, which open the story.
 */
export function MoveStoryMenu({
  story,
  waitingOn = [],
  onStep,
  className,
}: {
  story: UserStory;
  /** The story's dependencies that are not completed yet. */
  waitingOn?: string[];
  onStep?: (step: StoryStep) => void;
  className?: string;
}) {
  const { moveTo, pending, error } = useMoveStory();
  const moves = movesFrom(story.status);
  // Sending back needs the story's dependencies completed, like dragging it
  const stepDrop = onStep
    ? dropOn(story.status, story.status === "review" ? "in_progress" : "not_started", waitingOn)
    : null;
  const step = stepDrop?.kind === "open" ? (stepDrop.step ?? null) : null;

  if (moves.length === 0 && !step) {
    return null;
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Move ${story.id}`}
              disabled={pending}
              className="text-muted-foreground"
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {moves.length > 0 ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {moves.map((to) => (
                <DropdownMenuItem
                  key={to}
                  disabled={dropOn(story.status, to, waitingOn) === null}
                  onClick={() => void moveTo(story.id, to)}
                >
                  <StatusDot status={to} />
                  {MOVE_LABELS[to]}
                </DropdownMenuItem>
              ))}
              {waitingOn.length > 0 ? (
                <DropdownMenuLabel className="font-normal">
                  Waits for {waitingOn.join(", ")}
                </DropdownMenuLabel>
              ) : null}
            </DropdownMenuGroup>
          ) : null}
          {step && onStep ? (
            <>
              {moves.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onClick={() => onStep(step)}>{STEP_LABELS[step]}</DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
