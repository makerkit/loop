import { Link } from "@tanstack/react-router";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";

import { CopyInstruction } from "#/components/copy-instruction";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { START_INSTRUCTION } from "#/lib/agent/next-step";
import type { PrdListItem } from "#/lib/prds/list-project-prds";
import { STAGE_LABELS, type PrdStage } from "#/lib/prds/prd-overview";
import { cn } from "#/lib/utils";

export const SHAPE_PRD_INSTRUCTION = START_INSTRUCTION;

const STAGE_CLASSES: Record<PrdStage, string> = {
  planning: "bg-muted text-muted-foreground",
  ready: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  building: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  review: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};

const COLUMNS = "md:grid-cols-[minmax(0,1fr)_8rem_11rem_9rem_6rem]";

export function PrdList({ prds }: { prds: PrdListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div
        className={cn(
          "hidden gap-4 border-b bg-muted/40 px-5 py-2.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase md:grid",
          COLUMNS,
        )}
      >
        <span>PRD</span>
        <span>Stage</span>
        <span>Waiting on you</span>
        <span>Stories</span>
        <span className="text-right">Updated</span>
      </div>

      <ul className="divide-y">
        {prds.map((prd) => (
          <li key={prd.filename}>
            <PrdListRow prd={prd} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrdListRow({ prd }: { prd: PrdListItem }) {
  const { overview } = prd;

  return (
    <Link
      to="/prds/$filename"
      params={{ filename: prd.filename }}
      className={cn(
        "grid gap-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5 md:items-start md:gap-4",
        COLUMNS,
      )}
    >
      <span className="grid min-w-0 gap-1">
        <span className="font-medium">{prd.title || prd.filename}</span>
        {prd.summary ? (
          <span className="line-clamp-2 text-sm text-muted-foreground">{prd.summary}</span>
        ) : null}
        <span className="font-mono text-xs text-muted-foreground">{prd.filename}</span>
      </span>

      <span className="flex flex-wrap items-center gap-2 md:grid md:justify-items-start">
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
            STAGE_CLASSES[overview.stage],
          )}
        >
          {STAGE_LABELS[overview.stage]}
        </span>
        {!overview.readyToBuild && overview.stage !== "planning" ? (
          <span className="text-xs text-muted-foreground">Plan not ready</span>
        ) : null}
      </span>

      <WaitingOnYou overview={overview} />

      <span className="grid gap-1.5">
        {prd.total_stories === 0 ? (
          <span className="text-sm text-muted-foreground">No stories yet</span>
        ) : (
          <>
            <StorySegments completed={prd.completed_stories} total={prd.total_stories} />
            <span className="text-xs text-muted-foreground tabular-nums">
              {prd.completed_stories} of {prd.total_stories} done
              {prd.blocked_stories > 0 ? (
                <span className="text-destructive"> · {prd.blocked_stories} blocked</span>
              ) : null}
            </span>
          </>
        )}
      </span>

      <span className="text-xs text-muted-foreground tabular-nums md:text-right">
        <span className="md:hidden">Updated </span>
        {prd.last_updated}
      </span>
    </Link>
  );
}

function WaitingOnYou({ overview }: { overview: PrdListItem["overview"] }) {
  const parts = [
    overview.inReview > 0 ? `${overview.inReview} to review` : null,
    overview.openQuestions > 0
      ? `${overview.openQuestions} ${overview.openQuestions === 1 ? "question" : "questions"}`
      : null,
    overview.openEdgeCases > 0
      ? `${overview.openEdgeCases} edge ${overview.openEdgeCases === 1 ? "case" : "cases"}`
      : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return <span className="text-sm text-muted-foreground">Nothing</span>;
  }

  return (
    <span className="flex flex-wrap gap-1.5">
      {parts.map((part) => (
        <span
          key={part}
          className="inline-flex h-6 items-center rounded-full bg-amber-50 px-2 text-xs font-medium whitespace-nowrap text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {part}
        </span>
      ))}
    </span>
  );
}

/** Story progress as one segment per story (capped, so long PRDs stay compact). */
function StorySegments({ completed, total }: { completed: number; total: number }) {
  const segments = Math.min(total, 12);
  const filled = Math.round((completed / total) * segments);

  return (
    <span role="img" aria-label={`${completed} of ${total} stories done`} className="flex gap-0.5">
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-2 flex-1 rounded-[2px]",
            index < filled ? "bg-status-completed" : "bg-muted-foreground/15",
          )}
        />
      ))}
    </span>
  );
}

/**
 * First run, before any PRD exists: connect the agent, then plan a feature
 * with it. Loop shows the PRD as soon as the agent saves it (live updates).
 */
export function PrdListEmpty({
  hasPrdsDir,
  connectedAgents,
}: {
  hasPrdsDir: boolean;
  /** Agents whose project config has the PRD server (Codex's is global, so never listed). */
  connectedAgents: string[];
}) {
  const connected = connectedAgents.length > 0;

  return (
    <section className="grid gap-6 rounded-xl border bg-card p-6 sm:p-8">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold tracking-tight">No PRDs yet</h2>
        <p className="text-sm text-muted-foreground">
          {hasPrdsDir ? "The .prds folder is empty." : "This project has no .prds folder yet."} Plan
          your first feature with your coding agent in two steps.
        </p>
      </div>

      <ol className="grid gap-6">
        <FirstRunStep number={1} done={connected} title="Connect your agent">
          {connected ? (
            <p className="text-sm text-muted-foreground">
              {connectedAgents.join(" and ")} {connectedAgents.length === 1 ? "has" : "have"} the
              PRD tools.{" "}
              <Link to="/connect" className="underline underline-offset-4">
                Connect another agent
              </Link>
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Add the PRD tools to Claude Code, Codex, OpenCode or any agent that supports MCP.
              </p>
              <Button
                size="sm"
                className="w-fit"
                nativeButton={false}
                render={<Link to="/connect">Connect your agent</Link>}
              />
            </>
          )}
        </FirstRunStep>

        <FirstRunStep number={2} title="Plan a feature">
          <p className="text-sm text-muted-foreground">
            Run the shape_prd prompt in your agent, or give it this instruction. It asks you
            questions and writes the answers into a PRD, which appears here as soon as it is saved.
          </p>
          <CopyInstruction instruction={SHAPE_PRD_INSTRUCTION} />
        </FirstRunStep>
      </ol>
    </section>
  );
}

function FirstRunStep({
  number,
  title,
  done = false,
  children,
}: {
  number: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
          done && "border-transparent bg-emerald-600 text-white",
        )}
      >
        {done ? <CheckIcon className="size-3.5" aria-label="Done" /> : number}
      </span>
      <h3 className="text-sm leading-6 font-medium">{title}</h3>
      <div className="col-start-2 grid gap-3">{children}</div>
    </li>
  );
}

export function PrdListWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <Alert>
      <TriangleAlertIcon />
      <AlertTitle>
        {warnings.length === 1
          ? "One file could not be read"
          : `${warnings.length} files could not be read`}
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
