import type { StructuredPRD } from "@makerkit/prd";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

import { Markdown } from "#/components/markdown";

import { DecideEdgeCase } from "./edge-cases";
import { QuestionCards } from "./open-questions";

/** What only the user can unblock: open questions, open edge cases, stories to review. */
export function waitingOnYou(prd: StructuredPRD) {
  return {
    questions: prd.openQuestions,
    edgeCases: prd.edgeCases.filter((edgeCase) => edgeCase.status === "open"),
    inReview: prd.userStories.filter((story) => story.status === "review"),
  };
}

export function waitingCount(prd: StructuredPRD) {
  const { questions, edgeCases, inReview } = waitingOnYou(prd);

  return questions.length + edgeCases.length + inReview.length;
}

/**
 * First on the PRD page: everything that waits on the user, answerable in
 * place. Hidden when nothing does.
 */
export function WaitingOnYouPanel({ filename, prd }: { filename: string; prd: StructuredPRD }) {
  const { questions, edgeCases, inReview } = waitingOnYou(prd);
  const total = questions.length + edgeCases.length + inReview.length;

  if (total === 0) {
    return null;
  }

  return (
    <section
      id="waiting-on-you"
      aria-labelledby="waiting-on-you-title"
      className="grid gap-5 rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-xs dark:border-amber-500/20 dark:bg-amber-500/5"
    >
      <div className="grid gap-0.5">
        <h2 id="waiting-on-you-title" className="font-semibold">
          Waiting on you
        </h2>
        <p className="text-sm text-muted-foreground">
          The agent asks instead of guessing, so these hold up the work until you answer.
        </p>
      </div>

      {inReview.length > 0 ? (
        <Group
          title={`${inReview.length} ${inReview.length === 1 ? "story" : "stories"} to review`}
        >
          <ul className="grid gap-2">
            {inReview.map((story) => (
              <li key={story.id}>
                <Link
                  to="/prds/$filename/stories"
                  params={{ filename }}
                  search={{ story: story.id }}
                  className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="font-mono text-xs text-muted-foreground">{story.id}</span>
                  <span className="flex-1 font-medium">{story.title}</span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {questions.length > 0 ? (
        <Group
          title={`${questions.length} open ${questions.length === 1 ? "question" : "questions"}`}
        >
          <QuestionCards questions={questions} />
        </Group>
      ) : null}

      {edgeCases.length > 0 ? (
        <Group title={`${edgeCases.length} open edge ${edgeCases.length === 1 ? "case" : "cases"}`}>
          <ul className="grid gap-3">
            {edgeCases.map((edgeCase) => (
              <li
                key={edgeCase.id}
                className="grid gap-2 rounded-lg border bg-background p-4 text-sm"
              >
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{edgeCase.id}</span>
                  {edgeCase.storyIds?.length ? (
                    <span>Applies to {edgeCase.storyIds.join(", ")}</span>
                  ) : (
                    <span>Applies to all stories</span>
                  )}
                </span>
                <Markdown text={edgeCase.case} inline className="text-[15px] font-medium" />
                <span className="text-muted-foreground">
                  <DecideEdgeCase edgeCaseId={edgeCase.id} />
                </span>
              </li>
            ))}
          </ul>
        </Group>
      ) : null}
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}
