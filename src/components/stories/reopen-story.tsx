import type { UserStory } from "@makerkit/prd";
import { useServerFn } from "@tanstack/react-start";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";

import { usePrdEdit } from "#/components/prds/prd-edit-context";
import { usePrdWrite } from "#/components/prds/use-prd-write";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import { startedDependents } from "#/lib/stories/moves";
import { reopenStory } from "#/lib/stories/stories.functions";

/**
 * "Reopen story" on a completed story: back to not started with a reason the
 * agent reads first. Warns about stories already built on top of it.
 */
export function ReopenStory({
  story,
  startOpen = false,
}: {
  story: UserStory;
  /** Open with the reason form shown (a drop from Completed onto Not started). */
  startOpen?: boolean;
}) {
  const { prd } = usePrdEdit();
  const reopen = useServerFn(reopenStory);
  const { run, pending, error } = usePrdWrite();
  const id = useId();
  const [open, setOpen] = useState(startOpen);
  const [reason, setReason] = useState("");
  const dependents = startedDependents(prd, story.id);

  if (!open) {
    return (
      <div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <RotateCcwIcon data-icon="inline-start" />
          Reopen story
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3 rounded-lg border bg-muted/20 p-3"
      onSubmit={(event) => {
        event.preventDefault();

        void run(async (base) => {
          const result = await reopen({ data: { ...base, storyId: story.id, reason } });

          if (result.status === "refused") {
            throw new Error(result.message);
          }

          return result.status === "conflict" ? { status: "conflict" } : { status: "saved" };
        });
      }}
    >
      {dependents.length > 0 ? (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Stories built on this one</AlertTitle>
          <AlertDescription>
            {dependents.map((dependent) => `${dependent.id} ${dependent.title}`).join(", ")} depend
            on it and have already started. They keep their status; check them once this story is
            done again.
          </AlertDescription>
        </Alert>
      ) : null}

      <label htmlFor={`${id}-reason`} className="text-sm font-medium">
        Why reopen it?
      </label>
      <Textarea
        id={`${id}-reason`}
        autoFocus
        value={reason}
        maxLength={5000}
        onChange={(event) => setReason(event.target.value)}
        placeholder="The agent reads this first when it picks the story up again."
        className="min-h-24 bg-background"
      />
      <p className="text-xs text-muted-foreground">
        The story goes back to Not started. Its log and the approval commit stay.
      </p>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!reason.trim() || pending}>
          {pending ? "Reopening…" : "Reopen story"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
