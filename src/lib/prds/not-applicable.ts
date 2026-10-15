import type { MarkNotApplicableInput, PrdService } from "@makerkit/prd";

/** Same list as @makerkit/prd's, kept here so client-reachable code needs no runtime import. */
export const NOT_APPLICABLE_TOPICS = [
  "dataModel",
  "outsideServices",
  "security",
  "design",
  "qualityBar",
  "edgeCases",
  "rollout",
  "measurement",
  "glossary",
  "risks",
] as const satisfies readonly MarkNotApplicableInput["topic"][];

export type MarkNotApplicableResult = { status: "saved" } | { status: "conflict" };

/**
 * Marks a part of the PRD (not) applicable through PrdService, based on the
 * revision the user loaded. A conflict is a result, so the UI can reload and
 * say so; other failures throw.
 */
export async function markNotApplicable(
  service: Pick<PrdService, "markNotApplicable">,
  input: MarkNotApplicableInput & { expectedRevision: number },
): Promise<MarkNotApplicableResult> {
  try {
    await service.markNotApplicable(input);

    return { status: "saved" };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "PRD_REVISION_CONFLICT"
    ) {
      return { status: "conflict" };
    }

    throw error;
  }
}
