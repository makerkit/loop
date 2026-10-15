import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BanIcon, Undo2Icon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "#/components/ui/popover";
import {
  SECTION_TOPICS,
  notApplicableReason,
  type DocumentSectionId,
} from "#/lib/prds/document-sections";
import { setNotApplicable } from "#/lib/prds/prds.functions";
import { cn } from "#/lib/utils";

import { usePrdEdit } from "./prd-edit-context";

const CONFLICT_MESSAGE = "The PRD changed elsewhere. The latest version is loaded; try again.";

/**
 * Whether an optional section is marked not applicable, and the action to
 * change it. Sections that always apply (overview, stories...) have no topic.
 */
export function useSectionApplicability(sectionId: string) {
  const { filename, prd } = usePrdEdit();
  const router = useRouter();
  const save = useServerFn(setNotApplicable);
  const topic = SECTION_TOPICS[sectionId as DocumentSectionId];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(notApplicable: boolean, reason?: string) {
    if (!topic) {
      return false;
    }

    setPending(true);
    setError(null);

    try {
      const result = await save({
        data: {
          filename,
          topic,
          notApplicable,
          reason,
          expectedRevision: prd.metadata.revision ?? 0,
        },
      });

      await router.invalidate();

      if (result.status === "conflict") {
        setError(CONFLICT_MESSAGE);

        return false;
      }

      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the change.");

      return false;
    } finally {
      setPending(false);
    }
  }

  return {
    canMark: topic !== undefined,
    reason: notApplicableReason(prd, sectionId),
    change,
    pending,
    error,
  };
}

/** Header action: mark the section not applicable, with an optional reason. */
export function NotApplicableAction({
  sectionId,
  title,
  className,
}: {
  sectionId: string;
  title: string;
  className?: string;
}) {
  const { canMark, reason, change, pending, error } = useSectionApplicability(sectionId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputId = useId();

  if (!canMark || reason !== null) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Mark ${title} as N/A`}
            className={cn("text-muted-foreground", className)}
          />
        }
      >
        <BanIcon data-icon="inline-start" />
        Mark as N/A
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80">
        <form
          className="grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();

            if (await change(true, text)) {
              setOpen(false);
              setText("");
            }
          }}
        >
          <PopoverHeader>
            <PopoverTitle>{title} does not apply</PopoverTitle>
            <PopoverDescription>
              The plan check stops asking for it and the agent will not build it.
            </PopoverDescription>
          </PopoverHeader>

          <Input
            id={inputId}
            aria-label="Reason"
            placeholder="Why, e.g. Internal tool, no rollout"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Mark as N/A"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Shown in place of a section's content while it is marked not applicable. */
export function NotApplicableBody({ sectionId }: { sectionId: string }) {
  const { reason, change, pending, error } = useSectionApplicability(sectionId);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <BanIcon className="size-4 shrink-0" />
          <span>
            Not applicable
            {reason ? <span className="text-foreground/80"> · {reason}</span> : null}
          </span>
        </span>

        <Button variant="ghost" size="xs" disabled={pending} onClick={() => void change(false)}>
          <Undo2Icon data-icon="inline-start" />
          Mark applicable
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
