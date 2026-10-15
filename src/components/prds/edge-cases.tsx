import { useServerFn } from "@tanstack/react-start";
import type { EdgeCase } from "@makerkit/prd";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";

import { MarkdownEditor } from "#/components/editor/markdown-editor";
import { Markdown } from "#/components/markdown";
import { Button } from "#/components/ui/button";
import { FieldError } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import {
  buildEdgeCasesValue,
  emptyEdgeCaseRow,
  parseEdgeCaseErrors,
  toEdgeCaseRows,
  type EdgeCaseErrors,
  type EdgeCaseRow,
} from "#/lib/prds/edge-case-edits";
import { decideOpenEdgeCase } from "#/lib/prds/prds.functions";
import { cn } from "#/lib/utils";

import { StoryPicker } from "#/components/stories/story-picker";

import { usePrdEdit } from "./prd-edit-context";
import { usePrdWrite } from "./use-prd-write";
import { ConflictNotice, useSectionSave } from "./use-section-save";

const STATUS_CLASSES: Record<EdgeCase["status"], string> = {
  decided: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  open: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

export function EdgeCaseStatus({ status }: { status: EdgeCase["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap",
        STATUS_CLASSES[status],
      )}
    >
      {status === "decided" ? "Decided" : "Open"}
    </span>
  );
}

/** What can go wrong and what should happen, as a table (rows on phones). */
export function EdgeCaseTable({ edgeCases }: { edgeCases: EdgeCase[] }) {
  const open = edgeCases.filter((edgeCase) => edgeCase.status === "open").length;

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">
        {edgeCases.length - open} decided · {open} open
      </p>

      <div className="overflow-hidden rounded-lg border">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_6rem] gap-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase sm:grid">
          <span>Case</span>
          <span>What should happen</span>
          <span>Status</span>
        </div>

        <ul className="divide-y">
          {edgeCases.map((edgeCase) => (
            <li
              key={edgeCase.id}
              className="grid gap-1.5 px-4 py-3 text-sm leading-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_6rem] sm:gap-4"
            >
              <span className="grid gap-0.5">
                <Markdown text={edgeCase.case} inline className="font-medium" />
                {edgeCase.storyIds?.length ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {edgeCase.storyIds.join(", ")}
                  </span>
                ) : null}
              </span>

              <span className="text-muted-foreground">
                {edgeCase.status === "decided" ? (
                  <Markdown text={edgeCase.expectedBehavior} inline />
                ) : (
                  <DecideEdgeCase edgeCaseId={edgeCase.id} />
                )}
              </span>

              <span>
                <EdgeCaseStatus status={edgeCase.status} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const NO_ERRORS: EdgeCaseErrors = { rows: {}, form: [] };

/**
 * Edits the edge cases as rows. Saves the whole list through
 * update_prd_section "edgeCases", based on the revision the user loaded.
 */
export function EdgeCasesEditor({
  latest,
  onDone,
}: {
  latest: React.ReactNode;
  onDone: () => void;
}) {
  const { prd } = usePrdEdit();
  const { submit, saving, conflict } = useSectionSave("edgeCases");
  const formId = useId();

  const [rows, setRows] = useState<EdgeCaseRow[]>(() => {
    const existing = toEdgeCaseRows(prd.edgeCases);

    return existing.length > 0 ? existing : [emptyEdgeCaseRow(`${formId}-0`)];
  });
  const [errors, setErrors] = useState(NO_ERRORS);
  const [nextKey, setNextKey] = useState(1);

  const update = (key: string, patch: Partial<EdgeCaseRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors(NO_ERRORS);

    const { value, rowIndexes } = buildEdgeCasesValue(rows);
    const outcome = await submit(value);

    if (outcome.status === "saved") {
      onDone();
    } else if (outcome.status === "invalid") {
      setErrors(parseEdgeCaseErrors(outcome.message, rowIndexes));
    } else if (outcome.status === "error") {
      setErrors({ rows: {}, form: [outcome.message] });
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border bg-muted/20 p-3" noValidate>
      {conflict ? <ConflictNotice latest={latest} /> : null}

      <ul className="grid gap-3">
        {rows.map((row, index) => {
          const error = errors.rows[index];

          return (
            <li
              key={row.key}
              className={cn(
                "grid gap-2 rounded-lg border bg-background p-3",
                error && "border-destructive/50",
              )}
            >
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Case"
                  placeholder="What can go wrong, e.g. The client pays part of the invoice"
                  value={row.case}
                  onChange={(event) => update(row.key, { case: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove case"
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                >
                  <Trash2Icon />
                </Button>
              </div>

              <MarkdownEditor
                mode="inline"
                ariaLabel="What should happen"
                name="What should happen"
                placeholder="What should happen"
                value={row.expectedBehavior}
                onChange={(expectedBehavior) => update(row.key, { expectedBehavior })}
              />

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div role="radiogroup" aria-label="Status" className="flex rounded-lg border p-0.5">
                  {(["open", "decided"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      role="radio"
                      aria-checked={row.status === status}
                      onClick={() => update(row.key, { status })}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground",
                        row.status === status && "bg-foreground text-background",
                      )}
                    >
                      {status === "open" ? "Open" : "Decided"}
                    </button>
                  ))}
                </div>

                <div className="min-w-60 flex-1">
                  <StoryPicker
                    ariaLabel="Stories it applies to"
                    placeholder="Applies to all stories; search to limit"
                    value={row.stories
                      .split(/[\s,]+/)
                      .map((id) => id.trim())
                      .filter(Boolean)}
                    onChange={(storyIds) => update(row.key, { stories: storyIds.join(", ") })}
                  />
                </div>
              </div>

              {error ? <FieldError>{error}</FieldError> : null}
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => {
          setRows((current) => [...current, emptyEdgeCaseRow(`${formId}-${nextKey}`)]);
          setNextKey((key) => key + 1);
        }}
      >
        <PlusIcon data-icon="inline-start" />
        Add case
      </Button>

      {errors.form.length > 0 ? (
        <FieldError>
          {errors.form.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </FieldError>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Decide an open edge case in place: what should happen. */
export function DecideEdgeCase({ edgeCaseId }: { edgeCaseId: string }) {
  const decide = useServerFn(decideOpenEdgeCase);
  const { run, pending, error } = usePrdWrite();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [behavior, setBehavior] = useState("");

  if (!open) {
    return (
      <span className="grid justify-items-start gap-1.5">
        <span className="italic">Not decided. The agent will ask instead of guessing.</span>
        <Button variant="outline" size="xs" onClick={() => setOpen(true)}>
          Decide
        </Button>
      </span>
    );
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={async (event) => {
        event.preventDefault();

        if (
          await run((base) => decide({ data: { ...base, edgeCaseId, expectedBehavior: behavior } }))
        ) {
          setOpen(false);
        }
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        What should happen
      </label>
      <Input
        id={inputId}
        autoFocus
        placeholder="What should happen"
        value={behavior}
        onChange={(event) => setBehavior(event.target.value)}
      />
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
      <span className="flex gap-2">
        <Button type="submit" size="xs" disabled={!behavior.trim() || pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </span>
    </form>
  );
}
