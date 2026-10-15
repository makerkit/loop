import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import type { RevisionedWriteResult } from "#/lib/prds/revisioned-write";

import { usePrdEdit } from "./prd-edit-context";

const CONFLICT_MESSAGE =
  "The PRD changed elsewhere, so this was not saved. The latest version is loaded; check it and try again.";

/**
 * Runs a revision-checked write (answer a question, decide an edge case...),
 * then reloads the page data. Gives the revision the user is looking at, and
 * turns a conflict into a message instead of overwriting.
 */
export function usePrdWrite() {
  const { filename, prd } = usePrdEdit();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(
    write: (base: { filename: string; expectedRevision: number }) => Promise<RevisionedWriteResult>,
  ) {
    setPending(true);
    setError(null);

    try {
      const result = await write({ filename, expectedRevision: prd.metadata.revision ?? 0 });

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

  return { run, pending, error };
}
