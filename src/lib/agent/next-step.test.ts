import { checkPlan, normalizePrd, pickNextStory } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { nextStep } from "./next-step";

const story = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Story ${id}`,
  userStory: "",
  acceptanceCriteria: ["a", "b"],
  status,
  priority: "P1",
  dependencies: [],
  testSeams: ["x"],
  ...extra,
});

function step(stories: ReturnType<typeof story>[], extra: Record<string, unknown> = {}) {
  const prd = normalizePrd(
    {
      introduction: { title: "Notes", overview: "x" },
      nonGoals: ["n"],
      outOfScope: ["o"],
      edgeCases: [{ id: "EC001", case: "c", expectedBehavior: "b", status: "decided" }],
      userStories: stories,
      ...extra,
    },
    "2026-10-15",
  );

  return nextStep("notes.json", prd, pickNextStory(prd), checkPlan(prd));
}

describe("nextStep", () => {
  it("suggests implementing the next ready story", () => {
    expect(step([story("US001", "completed"), story("US002", "not_started")])).toEqual({
      kind: "implement",
      storyId: "US002",
      title: "Story US002",
      instruction: "Implement story US002 from notes.json with the implement_story prompt",
    });
  });

  it("points to the review when a story waits for approval, before anything else", () => {
    expect(
      step([
        story("US001", "review"),
        story("US002", "in_progress"),
        story("US003", "not_started"),
      ]),
    ).toEqual({ kind: "review", storyId: "US001", title: "Story US001" });
  });

  it("finishes a started story before starting another, reading the notes when sent back", () => {
    expect(step([story("US001", "in_progress"), story("US002", "not_started")])).toMatchObject({
      kind: "continue",
      storyId: "US001",
      sentBack: false,
    });

    const sentBack = step([
      story("US001", "in_progress", { notes: "Sent back on 2026-10-15:\nAdd the empty state" }),
    ]);

    expect(sentBack).toMatchObject({ kind: "continue", sentBack: true });
    expect(sentBack.kind === "continue" && sentBack.instruction).toContain("read its notes first");
  });

  it("asks to finish shaping a plan that is not ready", () => {
    expect(step([story("US001", "not_started")], { edgeCases: [] })).toEqual({
      kind: "shape",
      reason: expect.stringContaining("what can go wrong"),
      instruction: "Use the shape_prd prompt to finish the plan in notes.json",
    });
  });

  it("says when everything is done, or why nothing is ready", () => {
    expect(step([story("US001", "completed")])).toEqual({ kind: "done" });
    expect(step([story("US001", "blocked")])).toEqual({
      kind: "waiting",
      reason: "US001 is blocked; unblock it to continue.",
    });
  });
});
