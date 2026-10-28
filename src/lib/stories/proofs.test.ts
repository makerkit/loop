import type { UserStory } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { criteriaWithProofs, reviewChecks } from "./proofs";

const story = {
  id: "US001",
  title: "Export",
  userStory: "",
  businessValue: "",
  acceptanceCriteria: ["Exports a CSV", "The email arrives", "Shows a toast"],
  status: "not_started",
  priority: "P1",
  estimatedComplexity: "S",
  dependencies: [],
  proofs: [
    { criterion: "Exports a CSV", kind: "integration", seam: "exportCsv" },
    { criterion: "The email arrives", kind: "post-deploy", reason: "Real provider" },
    { criterion: "Shows a toast", kind: "judge", rubric: ["Says what happened"] },
  ],
} satisfies UserStory;

describe("criteriaWithProofs", () => {
  it("pairs each criterion with its proof, in criteria order", () => {
    expect(criteriaWithProofs(story)).toEqual([
      {
        criterion: "Exports a CSV",
        proof: story.proofs[0],
        label: "Integration test",
        byHand: false,
      },
      {
        criterion: "The email arrives",
        proof: story.proofs[1],
        label: "You check it after deploy",
        byHand: true,
      },
      {
        criterion: "Shows a toast",
        proof: story.proofs[2],
        label: "Scored by the review agent",
        byHand: false,
      },
    ]);
  });

  it("leaves a criterion without a proof unlabelled", () => {
    expect(criteriaWithProofs({ ...story, proofs: [] })[0]).toMatchObject({
      proof: null,
      label: null,
      byHand: false,
    });
  });

  it("splits what the user checks from what the review agent scores", () => {
    const checks = reviewChecks(story);

    expect(checks.byHand.map((entry) => entry.criterion)).toEqual(["The email arrives"]);
    expect(checks.judged.map((entry) => entry.criterion)).toEqual(["Shows a toast"]);
  });
});
