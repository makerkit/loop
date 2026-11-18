import type { PrdRoadmap } from "@makerkit/prd";
import { Link } from "@tanstack/react-router";
import {
  CheckIcon,
  ChevronDownIcon,
  LayersIcon,
  PencilIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useId, useRef, useState } from "react";

import { CopyInstruction } from "#/components/copy-instruction";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { START_INSTRUCTION } from "#/lib/agent/next-step";
import type { PrdListItem } from "#/lib/prds/list-project-prds";
import { STAGE_LABELS, type PrdStage } from "#/lib/prds/prd-overview";
import { cn } from "#/lib/utils";
import { readSectionFields, SECTION_EDITS } from "#/lib/prds/section-edits";

import { RoadmapFields } from "./roadmap-fields";
import { SectionForm } from "./section-editor";

export const SHAPE_PRD_INSTRUCTION = START_INSTRUCTION;

const STAGE_CLASSES: Record<PrdStage, string> = {
  planning: "bg-muted text-muted-foreground",
  ready: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  building: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  review: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};

const CRITICALITY_CLASSES: Record<NonNullable<PrdRoadmap["criticality"]>, string> = {
  critical:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200",
  high: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
  medium:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200",
  low: "border-border bg-muted text-foreground",
};

const COLUMNS = "lg:grid-cols-[minmax(0,1fr)_7rem_7rem_10rem_7rem_5.5rem]";

export function PrdList({
  prds,
  visiblePrds = prds,
  sectionOrder = "roadmap",
  filterKey = "",
}: {
  prds: PrdListItem[];
  visiblePrds?: PrdListItem[];
  sectionOrder?: "roadmap" | "title";
  filterKey?: string;
}) {
  const panelId = useId();
  const [editing, setEditing] = useState<{ filename: string } | null>(null);
  const activePrd = prds.find(({ filename }) => filename === editing?.filename);
  const trigger = useRef<HTMLButtonElement>(null);

  function editRoadmap(filename: string, button: HTMLButtonElement) {
    trigger.current = button;
    setEditing({ filename });
  }

  function closeEditor() {
    setEditing((current) => (current === editing ? null : current));
  }
  const visible = new Set(visiblePrds.map(({ filename }) => filename));
  const [collapsed, setCollapsed] = useState<{ filterKey: string; keys: Set<string> }>({
    filterKey,
    keys: new Set(),
  });
  const groups = new Map<
    string,
    { title: string; context: string; unassigned: boolean; prds: PrdListItem[] }
  >();

  for (const prd of prds) {
    const { plan, group, section } = prd.roadmap ?? {};
    const key = JSON.stringify([plan, group, section]);
    const existing = groups.get(key);
    if (existing) {
      if (visible.has(prd.filename)) existing.prds.push(prd);
    } else {
      groups.set(key, {
        title: section || group || plan || "Unassigned",
        context:
          (section ? [plan, group] : group ? [plan] : []).filter(Boolean).join(" / ") ||
          (section ? "Section" : group ? "Group" : plan ? "Plan" : ""),
        unassigned: !(plan || group || section),
        prds: visible.has(prd.filename) ? [prd] : [],
      });
    }
  }

  const grouped = [...groups.values()].some((group) => !group.unassigned);
  const sections = [...groups].filter(([, section]) => section.prds.length > 0);
  if (sectionOrder === "title") {
    sections.sort(
      ([, a], [, b]) =>
        Number(a.unassigned) - Number(b.unassigned) ||
        a.title.localeCompare(b.title) ||
        a.context.localeCompare(b.context),
    );
  }

  return (
    <>
      {!grouped && visiblePrds.length > 0 ? (
        <PrdListTable prds={visiblePrds} onEdit={editRoadmap} />
      ) : null}
      {grouped && sections.length > 0 ? (
        <div className="grid gap-4">
          {sections.map(([key, section], index) => {
            const id = panelId + "-" + index;
            const closed = collapsed.filterKey === filterKey && collapsed.keys.has(key);
            const done = section.prds.filter((prd) => prd.overview.stage === "done").length;

            return (
              <section
                key={key}
                className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs"
              >
                <h2>
                  <button
                    type="button"
                    aria-expanded={!closed}
                    aria-controls={id}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
                    onClick={() =>
                      setCollapsed((current) => {
                        const keys = new Set(current.filterKey === filterKey ? current.keys : []);
                        if (keys.has(key)) keys.delete(key);
                        else keys.add(key);
                        return { filterKey, keys };
                      })
                    }
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <LayersIcon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      {section.context ? (
                        <span className="truncate text-xs font-medium text-muted-foreground">
                          {section.context}
                        </span>
                      ) : null}
                      <span className="wrap-anywhere text-base font-semibold tracking-tight">
                        {section.title}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {done} of {section.prds.length} done
                    </span>
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        closed && "-rotate-90",
                      )}
                    />
                  </button>
                </h2>
                <div id={id} hidden={closed}>
                  {closed ? null : (
                    <PrdListTable prds={section.prds} onEdit={editRoadmap} embedded />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      <Dialog
        open={Boolean(activePrd)}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        {activePrd ? (
          <DialogContent
            className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
            finalFocus={() =>
              trigger.current?.isConnected
                ? trigger.current
                : document.querySelector<HTMLElement>('input[aria-label="Search PRDs"]')
            }
          >
            <DialogHeader>
              <DialogTitle>Edit roadmap</DialogTitle>
              <DialogDescription>{activePrd.title || activePrd.filename}</DialogDescription>
            </DialogHeader>
            <SectionForm
              key={activePrd.filename}
              edit={SECTION_EDITS.roadmap}
              filename={activePrd.filename}
              revision={activePrd.revision}
              initialValues={readSectionFields(SECTION_EDITS.roadmap, activePrd.roadmap)}
              latest={<RoadmapFields roadmap={activePrd.roadmap} />}
              onDone={closeEditor}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

type EditRoadmap = (filename: string, button: HTMLButtonElement) => void;

function PrdListTable({
  prds,
  onEdit,
  embedded = false,
}: {
  prds: PrdListItem[];
  onEdit: EditRoadmap;
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? "border-t" : "overflow-hidden rounded-xl border bg-card shadow-xs"}>
      <div
        className={cn(
          "hidden gap-4 border-b bg-muted/40 py-2.5 pr-13 pl-5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase lg:grid",
          COLUMNS,
        )}
      >
        <span>PRD</span>
        <span>Criticality</span>
        <span>Stage</span>
        <span>Waiting on you</span>
        <span>Stories</span>
        <span className="text-right">Updated</span>
      </div>

      <ul className="divide-y">
        {prds.map((prd) => (
          <li key={prd.filename} className="relative">
            <PrdListRow prd={prd} />
            <Button
              className="absolute top-3 right-2 text-muted-foreground"
              size="icon-sm"
              variant="ghost"
              title="Edit roadmap"
              aria-haspopup="dialog"
              aria-label={"Edit roadmap for " + (prd.title || prd.filename)}
              onClick={(event) => onEdit(prd.filename, event.currentTarget)}
            >
              <PencilIcon aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrdListRow({ prd }: { prd: PrdListItem }) {
  const { overview } = prd;
  const criticality = prd.roadmap?.criticality;

  return (
    <Link
      to="/prds/$filename"
      params={{ filename: prd.filename }}
      className={cn(
        "grid gap-3 py-4 pr-13 pl-4 transition-colors hover:bg-muted/40 sm:pl-5 lg:items-start lg:gap-4",
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

      <span className="flex items-center gap-2 text-xs">
        <span className="font-medium text-muted-foreground lg:sr-only">Criticality</span>
        {criticality ? (
          <Badge variant="outline" className={cn("capitalize", CRITICALITY_CLASSES[criticality])}>
            {criticality}
          </Badge>
        ) : (
          <span className="text-muted-foreground">Unspecified</span>
        )}
      </span>

      <span className="flex flex-wrap items-center gap-2 lg:grid lg:justify-items-start">
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

      <span className="text-xs text-muted-foreground tabular-nums lg:text-right">
        <span className="lg:hidden">Updated </span>
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
          {hasPrdsDir ? "The PRD directory is empty." : "This project has no PRD directory yet."}{" "}
          Plan your first feature with your coding agent in two steps.
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
