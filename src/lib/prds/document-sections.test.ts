import { checkPlan, normalizePrd } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { getDocumentFlags } from "./document-sections";

const story = (id: string, criteria: string[], status = "not_started") => ({
  id,
  title: id,
  userStory: "",
  acceptanceCriteria: criteria,
  status,
  priority: "P1",
  testSeams: ["x"],
});

const prd = normalizePrd(
  {
    introduction: { title: "Flags", overview: "Written" },
    nonGoals: ["Sync"],
    openQuestions: ["Which browser?"],
    userStories: [
      story("US001", []),
      story("US002", ["one"]),
      story("US003", ["a", "b"], "blocked"),
    ],
  },
  "2026-10-15",
);

const flags = getDocumentFlags(prd, checkPlan(prd));

describe("getDocumentFlags", () => {
  it("marks sections with plan check items, written sections and empty ones", () => {
    expect(flags.sections.overview).toEqual({ state: "done" });
    expect(flags.sections.glossary).toEqual({ state: "empty" });
    // Missing out-of-scope is recommended; no non-goals AND no out-of-scope would be required
    expect(flags.sections.scope).toMatchObject({ state: "issues", required: false });
    expect(flags.sections["open-questions"]).toMatchObject({ state: "issues", count: 1 });
    expect(flags.sections.stories).toMatchObject({ state: "issues", required: true });
  });

  it("puts story-level items on the stories, in a few words", () => {
    expect(flags.stories.US001).toEqual([
      { label: "No acceptance criteria", severity: "required" },
    ]);
    expect(flags.stories.US002).toEqual([
      { label: "Needs more detailed acceptance criteria", severity: "recommended" },
    ]);
    expect(flags.stories.US003).toEqual([{ label: "Blocked", severity: "recommended" }]);
  });

  it("does not repeat story-level items under the section heading", () => {
    expect(flags.sectionItems.stories ?? []).toEqual([]);
    expect(flags.sectionItems["open-questions"]?.map((item) => item.id)).toEqual([
      "open-questions",
    ]);
  });

  it("keeps open edge cases under the Edge cases heading as well as on their stories", () => {
    const withEdgeCases = normalizePrd(
      {
        ...prd,
        edgeCases: [{ id: "EC001", case: "Partial payment", status: "open", storyIds: ["US001"] }],
      },
      "2026-10-15",
    );
    const result = getDocumentFlags(withEdgeCases, checkPlan(withEdgeCases));

    expect(result.sectionItems["edge-cases"]?.map((item) => item.id)).toEqual(["open-edge-cases"]);
    expect(result.stories.US001).toContainEqual({ label: "Open edge case", severity: "required" });
  });
});
