import type { StoryLogEntry, StructuredPRD, UserStory } from "@makerkit/prd";
import { Link } from "@tanstack/react-router";
import { CircleCheckIcon, HourglassIcon, PencilIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Markdown, PrdFileProvider } from "#/components/markdown";
import { AddAttachment } from "#/components/prds/attachment-editors";
import { AttachmentList } from "#/components/prds/attachments";
import { BulletList } from "#/components/prds/document-parts";
import { EdgeCaseStatus } from "#/components/prds/edge-cases";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "#/components/ui/sheet";
import type { StoryStep } from "#/lib/stories/moves";
import { criteriaWithProofs } from "#/lib/stories/proofs";

import { MoveStoryMenu } from "./move-story-menu";
import { ReopenStory } from "./reopen-story";
import { StoryEditor } from "./story-editor";
import { StoryReview } from "./story-review";
import { StoryStatusBadge } from "./story-status";

/** One story with everything needed to follow or review it. */
export function StoryDetails({
  filename,
  prd,
  story,
  waitingOn,
  startEditing = false,
  startStep,
}: {
  /** Open with the editor shown (e.g. from the document's Edit link). */
  startEditing?: boolean;
  /** Open at a step: sending a story in review back, or reopening a completed one. */
  startStep?: StoryStep;
  filename: string;
  prd: StructuredPRD;
  story: UserStory;
  waitingOn: string[];
}) {
  const [editing, setEditing] = useState(startEditing && story.status !== "completed");
  const phase = prd.customPhases.find((candidate) => candidate.userStoryIds.includes(story.id));
  const stories = new Map(prd.userStories.map((candidate) => [candidate.id, candidate]));
  const storyAttachments = prd.attachments.filter((attachment) =>
    story.attachmentIds?.includes(attachment.id),
  );
  const blockingQuestions = prd.openQuestions.filter((question) =>
    question.storyIds?.includes(story.id),
  );
  // Linked to this story, or to the whole PRD (no stories): same rule as get_story
  const storyEdgeCases = prd.edgeCases.filter(
    (edgeCase) => !edgeCase.storyIds?.length || edgeCase.storyIds.includes(story.id),
  );
  // Newest first: the latest hand-off is what matters most
  const log = [...(story.log ?? [])].reverse();

  return (
    <PrdFileProvider value={filename}>
      <SheetHeader className="gap-3 border-b px-6 py-5 pr-14">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{story.id}</span>
          <StoryStatusBadge status={story.status} />
          <span className="rounded border px-1 leading-4">{story.priority}</span>
          {phase ? <span>{phase.name}</span> : null}
          <span className="ml-auto flex items-center gap-1">
            {story.status !== "completed" && !editing ? (
              <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
                <PencilIcon data-icon="inline-start" />
                Edit
              </Button>
            ) : null}
            <MoveStoryMenu story={story} waitingOn={waitingOn} />
          </span>
        </div>
        <SheetTitle className="text-xl font-semibold tracking-tight">{story.title}</SheetTitle>
        {story.userStory ? (
          <SheetDescription>
            <Markdown text={story.userStory} inline />
          </SheetDescription>
        ) : null}
      </SheetHeader>

      <div className="grid content-start gap-8 overflow-y-auto px-6 py-6 [overflow-wrap:anywhere]">
        {editing ? (
          <StoryEditor story={story} onDone={() => setEditing(false)} />
        ) : (
          <>
            <StoryReview
              story={story}
              startSendingBack={startStep === "send-back"}
              onEditStory={() => setEditing(true)}
            />
            {story.status === "completed" ? (
              <ReopenStory story={story} startOpen={startStep === "reopen"} />
            ) : null}

            {waitingOn.length > 0 ? (
              <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                <HourglassIcon className="size-4" />
                Waiting for {waitingOn.join(", ")} to be completed.
              </p>
            ) : null}

            {blockingQuestions.length > 0 ? (
              <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="font-medium">
                  Waiting on {blockingQuestions.length === 1 ? "an answer" : "answers"}
                </span>
                <ul className="grid gap-1">
                  {blockingQuestions.map((question) => (
                    <li key={question.id}>
                      <span className="font-mono text-xs">{question.id}</span>{" "}
                      <Markdown text={question.question} inline />
                    </li>
                  ))}
                </ul>
                <Link
                  to="/prds/$filename"
                  params={{ filename }}
                  hash="open-questions"
                  className="w-fit text-xs font-medium underline underline-offset-4"
                >
                  Answer in the document
                </Link>
              </div>
            ) : null}

            <DetailSection title="Acceptance criteria">
              {story.acceptanceCriteria.length > 0 ? (
                <CriteriaList story={story} />
              ) : (
                <Empty>No acceptance criteria yet.</Empty>
              )}
            </DetailSection>

            <DetailSection title="Where it is tested">
              {story.testSeams?.length ? (
                <ul className="grid list-disc gap-1 pl-5 text-sm">
                  {story.testSeams.map((seam) => (
                    <li key={seam}>
                      <Markdown text={seam} inline />
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Not said yet.</Empty>
              )}
            </DetailSection>

            <NoteList title="Design notes" notes={story.designNotes} />
            <NoteList title="Security notes" notes={story.securityNotes} />

            {storyEdgeCases.length > 0 ? (
              <DetailSection title="Edge cases">
                <ul className="grid gap-2 text-sm">
                  {storyEdgeCases.map((edgeCase) => (
                    <li key={edgeCase.id} className="grid gap-1 rounded-lg border px-3 py-2">
                      <span className="flex items-start justify-between gap-2">
                        <Markdown text={edgeCase.case} inline className="font-medium" />
                        <EdgeCaseStatus status={edgeCase.status} />
                      </span>
                      <span className="text-muted-foreground">
                        {edgeCase.status === "decided" ? (
                          <Markdown text={edgeCase.expectedBehavior} inline />
                        ) : (
                          "Not decided yet."
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </DetailSection>
            ) : null}

            <DetailSection title="Attachments">
              {storyAttachments.length > 0 ? (
                <AttachmentList filename={filename} attachments={storyAttachments} />
              ) : (
                <Empty>No mockups or links for this story yet.</Empty>
              )}
              {story.status !== "completed" ? (
                <AddAttachment stories={prd.userStories} storyIds={[story.id]} />
              ) : null}
            </DetailSection>

            {story.dependencies.length > 0 ? (
              <DetailSection title="Depends on">
                <ul className="grid gap-2 text-sm">
                  {story.dependencies.map((id) => {
                    const dependency = stories.get(id);

                    return (
                      <li key={id} className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          to="/prds/$filename/stories"
                          params={{ filename }}
                          search={{ story: id }}
                          resetScroll={false}
                          className="hover:underline"
                        >
                          <span className="font-mono text-xs text-muted-foreground">{id}</span>{" "}
                          {dependency?.title ?? "Unknown story"}
                        </Link>
                        {dependency ? <StoryStatusBadge status={dependency.status} /> : null}
                      </li>
                    );
                  })}
                </ul>
              </DetailSection>
            ) : null}

            {story.notes?.trim() ? (
              <DetailSection title="Notes">
                <Markdown text={story.notes} />
              </DetailSection>
            ) : null}

            {story.verification ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleCheckIcon className="size-4 text-status-completed" />
                Checks passed on {story.verification.verifiedAt.slice(0, 10)}:{" "}
                {story.verification.checks.join(", ") || "no checks defined"}.
              </p>
            ) : null}

            <DetailSection title="Log">
              {log.length > 0 ? (
                <ol className="grid gap-6 border-l pl-5">
                  {log.map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="relative">
                      <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-muted-foreground/60" />
                      <LogEntry entry={entry} />
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty>Nothing logged yet.</Empty>
              )}
            </DetailSection>
          </>
        )}
      </div>
    </PrdFileProvider>
  );
}

/** The acceptance criteria, each with how it is proven when the story says. */
function CriteriaList({ story }: { story: UserStory }) {
  return (
    <ul className="grid list-disc gap-2 pl-5 text-[15px] leading-7 marker:text-muted-foreground">
      {criteriaWithProofs(story).map(({ criterion, proof, label, byHand }, index) => (
        <li key={index}>
          <Markdown text={criterion} inline />
          {proof ? (
            <span className="grid text-xs leading-5 text-muted-foreground">
              <span>
                <span className={byHand ? "font-medium text-foreground" : undefined}>{label}</span>
                {proof.seam ? (
                  <>
                    {" "}
                    · <code>{proof.seam}</code>
                  </>
                ) : null}
                {proof.reason ? (
                  <>
                    : <Markdown text={proof.reason} inline />
                  </>
                ) : null}
              </span>
              {proof.fallback ? (
                <span>
                  Tested instead: <Markdown text={proof.fallback} inline />
                </span>
              ) : null}
              {proof.rubric?.length ? (
                <span>
                  Rubric: <Markdown text={proof.rubric.join("; ")} inline />
                </span>
              ) : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function LogEntry({ entry }: { entry: StoryLogEntry }) {
  return (
    <div className="grid gap-3">
      <time dateTime={entry.at} className="text-xs text-muted-foreground">
        {formatLogDate(entry.at)}
      </time>

      {entry.deviations?.length ? (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Deviations from the plan</AlertTitle>
          <AlertDescription>
            <BulletList items={entry.deviations} />
          </AlertDescription>
        </Alert>
      ) : null}

      {entry.whatsNew.length > 0 ? (
        <div className="grid gap-1">
          <h4 className="text-xs font-medium text-muted-foreground">What's new</h4>
          <BulletList items={entry.whatsNew} />
        </div>
      ) : null}

      {entry.technicalNotes.length > 0 ? (
        <details className="grid gap-1">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Technical notes ({entry.technicalNotes.length})
          </summary>
          <BulletList items={entry.technicalNotes} className="mt-1" />
        </details>
      ) : null}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function formatLogDate(at: string) {
  const date = new Date(at);

  return Number.isNaN(date.getTime())
    ? at
    : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** A story's own design or security notes; hidden when it has none. */
function NoteList({ title, notes }: { title: string; notes: string[] | undefined }) {
  if (!notes?.length) return null;

  return (
    <DetailSection title={title}>
      <ul className="grid list-disc gap-1 pl-5 text-sm">
        {notes.map((note, index) => (
          <li key={index}>
            <Markdown text={note} inline />
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
