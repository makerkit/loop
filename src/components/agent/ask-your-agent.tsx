import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRightIcon, CircleCheckIcon, MessageSquareTextIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { CopyInstruction } from "#/components/copy-instruction";
import { Button } from "#/components/ui/button";
import { timeAgo } from "#/lib/agent/activity";
import type { NextStep } from "#/lib/agent/next-step";
import { getProjectActivity } from "#/lib/stories/stories.functions";

/**
 * The next step for this PRD: what to ask the agent (ready to copy), or,
 * when it is the user's turn, where to go.
 */
export function AskYourAgent({ filename, step }: { filename: string; step: NextStep }) {
  return (
    <section
      aria-labelledby="ask-your-agent-title"
      className="grid gap-3 rounded-xl border border-l-4 border-l-brand bg-card px-4 py-4 shadow-xs sm:px-5"
    >
      <h2
        id="ask-your-agent-title"
        className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-brand uppercase"
      >
        <MessageSquareTextIcon className="size-3.5" />
        {step.kind === "review" ? "Your turn" : "Ask your agent"}
      </h2>

      <StepBody filename={filename} step={step} />
    </section>
  );
}

function StepBody({ filename, step }: { filename: string; step: NextStep }) {
  switch (step.kind) {
    case "review":
      return (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm">
            <span className="font-mono text-muted-foreground">{step.storyId}</span>{" "}
            <span className="font-medium">{step.title}</span> is waiting for your review.
          </p>

          <Button
            size="sm"
            nativeButton={false}
            render={
              <Link
                to="/prds/$filename/stories"
                params={{ filename }}
                search={{ story: step.storyId }}
                resetScroll={false}
              />
            }
          >
            Review story
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      );

    case "continue":
      if (step.sentBack) {
        return <InstructionBody step={step} />;
      }

      return (
        <>
          <p className="text-sm">
            <span className="font-mono text-muted-foreground">{step.storyId}</span>{" "}
            <span className="font-medium">{step.title}</span> is in progress. <AgentActivity />
          </p>
          <p className="text-sm text-muted-foreground">If your agent stopped, give it this:</p>
          <CopyInstruction instruction={step.instruction} />
          <SlashHint />
        </>
      );

    case "implement":
      return <InstructionBody step={step} />;

    case "shape":
      return (
        <>
          <p className="text-sm">
            The plan is not ready to build yet.{" "}
            <span className="text-muted-foreground">{step.reason}</span>
          </p>
          <CopyInstruction instruction={step.instruction} />
          <SlashHint />
        </>
      );

    case "waiting":
      return <p className="text-sm text-muted-foreground">{step.reason}</p>;

    case "done":
      return (
        <p className="flex items-center gap-2 text-sm">
          <CircleCheckIcon className="size-4 text-status-completed" />
          All stories are completed.
        </p>
      );
  }
}

/** A story to implement, or one sent back: the instruction is the next step. */
function InstructionBody({
  step,
}: {
  step: Extract<NextStep, { kind: "continue" | "implement" }>;
}) {
  return (
    <>
      <p className="text-sm">
        {step.kind === "continue"
          ? step.sentBack
            ? "You sent this story back. Ask the agent to address your notes:"
            : "A story is in progress. Ask the agent to finish it before starting another:"
          : "The next story is ready to build:"}{" "}
        <span className="font-mono text-muted-foreground">{step.storyId}</span>{" "}
        <span className="font-medium">{step.title}</span>
      </p>
      <CopyInstruction instruction={step.instruction} />
      <SlashHint />
    </>
  );
}

const ACTIVITY_POLL_MS = 15_000;

/**
 * "Your agent is probably working on it: files last changed 40 s ago."
 * Loop never talks to the agent; recent changes to project files are the
 * best sign it has. Fetched in the browser only, and refreshed while shown.
 */
function AgentActivity() {
  const load = useServerFn(getProjectActivity);
  const [activity, setActivity] = useState<{ lastChangedAt: number | null; now: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      load().then(
        (result) => !cancelled && setActivity(result),
        () => undefined,
      );

    void refresh();
    const interval = setInterval(refresh, ACTIVITY_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [load]);

  if (!activity) {
    return null;
  }

  if (activity.lastChangedAt === null) {
    return (
      <span className="text-muted-foreground">No uncommitted changes in the project yet.</span>
    );
  }

  const ago = timeAgo(activity.lastChangedAt, activity.now);
  const recent = activity.now - activity.lastChangedAt < 5 * 60_000;

  return (
    <span className="text-muted-foreground">
      {recent ? "Your agent is probably working on it: project" : "Project"} files last changed{" "}
      {ago}.
    </span>
  );
}

function SlashHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Paste it in your agent. Most agents also offer these PRD prompts as slash commands, e.g.{" "}
      <code className="rounded bg-muted px-1 font-mono">/implement_story</code>.
    </p>
  );
}
