import type { PrdService, UpdatePrdSectionInput } from "@makerkit/prd";

export type UpdatePrdSectionResult =
  | { status: "saved"; revision: number }
  /** The PRD changed since `expectedRevision` was read; nothing was written. */
  | { status: "conflict" }
  /** update_prd_section rejected the value, e.g. an empty title. */
  | { status: "invalid"; message: string };

/**
 * Changes one section through PrdService (update_prd_section rules), based on
 * the revision the user loaded. Conflicts and invalid values are results, not
 * errors, so the editor can show them inline. Other failures throw.
 */
export async function updateSection(
  service: Pick<PrdService, "updatePrdSection" | "get">,
  input: UpdatePrdSectionInput & { expectedRevision: number },
): Promise<UpdatePrdSectionResult> {
  try {
    await service.updatePrdSection(input);
  } catch (error) {
    if (isRevisionConflict(error)) {
      return { status: "conflict" };
    }

    if (error instanceof Error && error.message.startsWith("Invalid value for section")) {
      return { status: "invalid", message: error.message };
    }

    throw error;
  }

  const { prd } = await service.get({ filename: input.filename });

  return { status: "saved", revision: prd.metadata.revision ?? 0 };
}

/** PrdRevisionConflictError, matched by code so this file needs no runtime import. */
function isRevisionConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "PRD_REVISION_CONFLICT"
  );
}
