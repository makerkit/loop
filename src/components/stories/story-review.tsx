import type { UserStory } from "@makerkit/prd";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlertIcon, CircleCheckIcon, GitCommitIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { usePrdEdit } from "#/components/prds/prd-edit-context";
import { BulletList } from "#/components/prds/document-parts";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Textarea } from "#/components/ui/textarea";
import type { GitChangedFile } from "#/lib/git/git-status";
import type { ReviewInfo, ReviewResult } from "#/lib/stories/review";
import { collectDeviations, commitMessage } from "#/lib/stories/review";
import {
  approveStory,
  commitStoryAgain,
  getReviewInfo,
  runChecks,
  sendBackStory,
} from "#/lib/stories/stories.functions";
import { cn } from "#/lib/utils";

type Checks = Awaited<ReturnType<typeof runChecks>>;

const CONFLICT_MESSAGE =
  "The PRD changed elsewhere, so nothing was done. The latest version is loaded; review it and try again.";

/**
 * Approve or send back a story in review. Shows deviations first, then the
 * changed files to commit, the project checks and the commit message.
 */
export function StoryReview({
  story,
  startSendingBack = false,
}: {
  story: UserStory;
  /** Open with the send back form shown (a drop from Review onto In progress). */
  startSendingBack?: boolean;
}) {
  const { filename, prd } = usePrdEdit();
  const router = useRouter();
  const loadInfo = useServerFn(getReviewInfo);
  const check = useServerFn(runChecks);
  const approve = useServerFn(approveStory);
  const commitAgain = useServerFn(commitStoryAgain);
  const sendBack = useServerFn(sendBackStory);
  const feedbackId = useId();

  const [info, setInfo] = useState<ReviewInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checks, setChecks] = useState<Checks | null>(null);
  const [busy, setBusy] = useState<"checks" | "approve" | "send-back" | "commit" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [commitFailed, setCommitFailed] = useState<string[] | null>(null);
  const [sendingBack, setSendingBack] = useState(startSendingBack);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadInfo({ data: { filename } }).then(
      (result) => {
        if (cancelled) return;
        setInfo(result);
        // Every change except other PRDs' files starts selected; the user unticks unrelated work
        setSelected(
          new Set(
            result.files
              .filter((file) => !isOtherPrdFile(file, result.prdPath))
              .map((file) => file.path),
          ),
        );
      },
      (error: unknown) => {
        if (!cancelled)
          setInfoError(error instanceof Error ? error.message : "Could not read git.");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [filename, loadInfo]);

  const deviations = collectDeviations(story.log);
  const blocked = info?.isRepo === true && info.blockers.length > 0;

  async function handle(result: ReviewResult, paths: string[]) {
    await router.invalidate();

    if (result.status === "conflict") {
      setMessage({ tone: "error", text: CONFLICT_MESSAGE });
    } else if (result.status === "refused") {
      setMessage({ tone: "error", text: result.message });
    } else if (result.status === "approved" && result.commitError) {
      setCommitFailed(paths);
      setMessage({
        tone: "error",
        text: `Completed, but not committed: ${result.commitError}`,
      });
    } else if (result.status === "approved" || result.status === "committed") {
      setCommitFailed(null);
      setMessage({
        tone: "success",
        text: result.commit ? `Approved and committed (${result.commit.sha}).` : "Approved.",
      });
    }
  }

  // After "completed but not committed" the story is no longer in review
  if (story.status !== "review") {
    return commitFailed ? (
      <section className="grid gap-3">
        <Notice message={message} />
        <Button
          variant="outline"
          className="w-fit"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("commit");
            try {
              await handle(
                await commitAgain({ data: { filename, storyId: story.id, paths: commitFailed } }),
                commitFailed,
              );
            } finally {
              setBusy(null);
            }
          }}
        >
          <GitCommitIcon data-icon="inline-start" />
          {busy === "commit" ? "Committing…" : "Commit again"}
        </Button>
      </section>
    ) : message ? (
      <Notice message={message} />
    ) : null;
  }

  return (
    <section
      aria-labelledby="review-title"
      className="grid gap-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-500/20 dark:bg-amber-500/5"
    >
      <div className="grid gap-0.5">
        <h3 id="review-title" className="font-semibold">
          Review
        </h3>
        <p className="text-sm text-muted-foreground">
          The agent says this story is done. Approve it to mark it completed and commit it, or send
          it back with notes.
        </p>
      </div>

      <ReviewGroup title="Deviations from the plan">
        {deviations.length > 0 ? (
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>
              {deviations.length === 1
                ? "The agent recorded 1 deviation"
                : `The agent recorded ${deviations.length} deviations`}
            </AlertTitle>
            <AlertDescription>
              <BulletList items={deviations} className="text-sm leading-6" />
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">No deviations recorded.</p>
        )}
      </ReviewGroup>

      <ReviewGroup title="Files to commit">
        {infoError ? (
          <p className="text-sm text-destructive">{infoError}</p>
        ) : !info ? (
          <p className="text-sm text-muted-foreground">Reading git…</p>
        ) : !info.isRepo ? (
          <p className="text-sm text-muted-foreground">
            This project is not a git repository: approving marks the story completed without a
            commit.
          </p>
        ) : (
          <FileList
            info={info}
            selected={selected}
            onToggle={(path, checked) =>
              setSelected((current) => {
                const next = new Set(current);

                if (checked) next.add(path);
                else next.delete(path);

                return next;
              })
            }
          />
        )}

        {blocked ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Git cannot commit right now</AlertTitle>
            <AlertDescription>{info!.blockers.join(" ")}</AlertDescription>
          </Alert>
        ) : null}

        {info?.isRepo ? (
          <pre className="overflow-x-auto rounded-md bg-muted/60 px-3 py-2 font-mono text-xs whitespace-pre-wrap">
            {commitMessage(story)}
          </pre>
        ) : null}
      </ReviewGroup>

      <ReviewGroup title="Project checks">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("checks");
              try {
                setChecks(await check({ data: { filename } }));
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "checks" ? "Running checks…" : "Run checks"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Approving runs them too and is refused if they fail.
          </span>
        </div>
        {checks ? <ChecksResult checks={checks} /> : null}
      </ReviewGroup>

      <Notice message={message} />

      {sendingBack ? (
        <form
          className="grid gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy("send-back");
            try {
              await handle(
                await sendBack({
                  data: {
                    filename,
                    storyId: story.id,
                    feedback,
                    expectedRevision: prd.metadata.revision ?? 0,
                  },
                }),
                [],
              );
            } finally {
              setBusy(null);
            }
          }}
        >
          <label htmlFor={feedbackId} className="text-sm font-medium">
            What should the agent change?
          </label>
          <Textarea
            id={feedbackId}
            autoFocus
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="The agent reads these notes first when it picks the story up again."
            className="min-h-24 bg-background"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!feedback.trim() || busy !== null}>
              {busy === "send-back" ? "Sending back…" : "Send back"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSendingBack(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy !== null || !info || blocked}
            onClick={async () => {
              const paths = [...selected];

              setBusy("approve");
              setMessage(null);
              try {
                await handle(
                  await approve({
                    data: {
                      filename,
                      storyId: story.id,
                      paths,
                      expectedRevision: prd.metadata.revision ?? 0,
                    },
                  }),
                  paths,
                );
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "approve" ? "Running checks and approving…" : "Approve story"}
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => setSendingBack(true)}>
            Send back
          </Button>
        </div>
      )}
    </section>
  );
}

function isOtherPrdFile(file: GitChangedFile, prdPath: string) {
  const folder = `${prdPath.replace(/\.json$/, "")}/`;

  return file.path.startsWith(".prds/") && file.path !== prdPath && !file.path.startsWith(folder);
}

const KIND_LABELS: Record<GitChangedFile["kind"], string> = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
  copied: "Copied",
  untracked: "New",
  conflict: "Conflict",
};

function FileList({
  info,
  selected,
  onToggle,
}: {
  info: ReviewInfo;
  selected: Set<string>;
  onToggle: (path: string, checked: boolean) => void;
}) {
  const hasPrdFile = info.files.some((file) => file.isPrdFile);

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">
        Untick changes that are not part of this story: they stay exactly as they are. The PRD file
        is always committed with the story.
      </p>
      <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border bg-background text-sm">
        {!hasPrdFile ? <FileRow path={info.prdPath} kind="Status update" checked disabled /> : null}
        {info.files.map((file) => {
          const otherPrd = isOtherPrdFile(file, info.prdPath);

          return (
            <FileRow
              key={file.path}
              path={file.previousPath ? `${file.previousPath} → ${file.path}` : file.path}
              kind={otherPrd ? "Other PRD, not committed" : KIND_LABELS[file.kind]}
              checked={file.isPrdFile || (!otherPrd && selected.has(file.path))}
              disabled={file.isPrdFile || otherPrd}
              onChange={(checked) => onToggle(file.path, checked)}
            />
          );
        })}
      </ul>
    </div>
  );
}

function FileRow({
  path,
  kind,
  checked,
  disabled = false,
  onChange,
}: {
  path: string;
  kind: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <li className={cn("flex items-center gap-2 px-3 py-1.5", disabled && "text-muted-foreground")}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange?.(value === true)}
      />
      <label htmlFor={id} className="min-w-0 flex-1 truncate font-mono text-xs" title={path}>
        {path}
      </label>
      <span className="shrink-0 text-xs text-muted-foreground">{kind}</span>
    </li>
  );
}

function ChecksResult({ checks }: { checks: Checks }) {
  return (
    <div
      className={cn(
        "grid gap-1 rounded-lg border px-3 py-2 text-sm",
        checks.passed
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
          : "border-red-200 bg-red-50 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200",
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        {checks.passed ? (
          <CircleCheckIcon className="size-4" />
        ) : (
          <CircleAlertIcon className="size-4" />
        )}
        {checks.passed
          ? `Checks passed${checks.checks.length ? `: ${checks.checks.join(", ")}` : ""}`
          : "Checks failed"}
      </span>
      {checks.messages.map((line) => (
        <span key={line} className="font-mono text-xs break-words">
          {line}
        </span>
      ))}
    </div>
  );
}

function Notice({ message }: { message: { tone: "error" | "success"; text: string } | null }) {
  if (!message) {
    return null;
  }

  return (
    <p
      role="status"
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        message.tone === "error"
          ? "bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-200"
          : "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200",
      )}
    >
      {message.text}
    </p>
  );
}

function ReviewGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <h4 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h4>
      {children}
    </div>
  );
}
