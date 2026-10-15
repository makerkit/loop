import type { StoryStatus } from "@makerkit/prd";

import { STATUS_LABELS } from "#/lib/prds/story-board";
import { cn } from "#/lib/utils";

const DOT_CLASSES: Record<StoryStatus, string> = {
  not_started: "bg-status-not-started",
  research: "bg-status-research",
  in_progress: "bg-status-in-progress",
  review: "bg-status-review",
  blocked: "bg-status-blocked",
  completed: "bg-status-completed",
};

/** Tinted pill colours; text is a darker shade of the status colour for contrast. */
const PILL_CLASSES: Record<StoryStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  research: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  review: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  blocked: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export function StatusDot({ status, className }: { status: StoryStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", DOT_CLASSES[status], className)}
    />
  );
}

/** A story's status as a small tinted pill. */
export function StoryStatusBadge({ status }: { status: StoryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap",
        PILL_CLASSES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
