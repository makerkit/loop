import type { PrdSection } from "@makerkit/prd";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { updatePrdSection } from "#/lib/prds/prds.functions";

import { usePrdEdit } from "./prd-edit-context";

export type SaveOutcome =
  | { status: "saved" }
  | { status: "invalid"; message: string }
  | { status: "conflict" }
  | { status: "error"; message: string };

/**
 * Saves one section through update_prd_section with the revision the user
 * started from. On a conflict nothing is saved and the latest PRD is loaded;
 * saving again then means "my version, knowing the latest one".
 */
export function useSectionSave(section: PrdSection) {
  const { filename, prd } = usePrdEdit();
  const router = useRouter();
  const save = useServerFn(updatePrdSection);

  const [baseRevision, setBaseRevision] = useState<number | null>(prd.metadata.revision ?? 0);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(value: unknown): Promise<SaveOutcome> {
    setSaving(true);

    try {
      const result = await save({
        data: {
          filename,
          section,
          value,
          expectedRevision: baseRevision ?? prd.metadata.revision ?? 0,
        },
      });

      if (result.status === "conflict") {
        await router.invalidate();
        setConflict(true);
        setBaseRevision(null);

        return { status: "conflict" };
      }

      if (result.status === "saved") {
        await router.invalidate();

        return { status: "saved" };
      }

      return result;
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Could not save the change.",
      };
    } finally {
      setSaving(false);
    }
  }

  return { submit, saving, conflict };
}

/** Shown in an editor after a conflict, with the section as currently saved. */
export function ConflictNotice({ latest }: { latest: React.ReactNode }) {
  return (
    <>
      <Alert>
        <CircleAlertIcon />
        <AlertTitle>The PRD changed while you were editing</AlertTitle>
        <AlertDescription>
          Your edit was not saved. The latest version is shown below your changes. Save again to
          replace it with your changes, or cancel to keep it.
        </AlertDescription>
      </Alert>
      <div className="grid gap-2 rounded-md border bg-background p-3">
        <span className="text-xs font-medium text-muted-foreground">Latest version</span>
        {latest}
      </div>
    </>
  );
}
