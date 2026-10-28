import type { CriterionProof, UserStory } from "@makerkit/prd";

export const PROOF_KIND_LABELS: Record<CriterionProof["kind"], string> = {
  unit: "Unit test",
  integration: "Integration test",
  e2e: "End-to-end test",
  judge: "Scored by the review agent",
  manual: "You check it",
  "post-deploy": "You check it after deploy",
};

export interface CriterionWithProof {
  criterion: string;
  proof: CriterionProof | null;
  /** The kind of proof, in plain words. */
  label: string | null;
  /** Manual and post-deploy proofs: a person checks these, not a test or an agent. */
  byHand: boolean;
}

/** Each acceptance criterion with the proof the story gives for it, if any. */
export function criteriaWithProofs(story: UserStory): CriterionWithProof[] {
  return story.acceptanceCriteria.map((criterion) => {
    const proof = story.proofs?.find((entry) => entry.criterion === criterion) ?? null;

    return {
      criterion,
      proof,
      label: proof ? PROOF_KIND_LABELS[proof.kind] : null,
      byHand: proof?.kind === "manual" || proof?.kind === "post-deploy",
    };
  });
}

/** Criteria a person checks before approving, and those the review agent scores. */
export function reviewChecks(story: UserStory) {
  const criteria = criteriaWithProofs(story);

  return {
    byHand: criteria.filter((entry) => entry.byHand),
    judged: criteria.filter((entry) => entry.proof?.kind === "judge"),
  };
}
