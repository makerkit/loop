import { checkPlan, normalizePrd } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { firstParagraph } from "./list-project-prds";
import { getPrdOverview } from "./prd-overview";

const story = (id: string, status: string) => ({
  id,
  title: id,
  userStory: "",
  acceptanceCriteria: ["a", "b"],
  status,
  priority: "P1",
  testSeams: ["x"],
});

function overview(statuses: string[], extra: Record<string, unknown> = {}) {
  const prd = normalizePrd(
    {
      introduction: { title: "T", overview: "x" },
      nonGoals: ["n"],
      outOfScope: ["o"],
      edgeCases: [{ id: "EC001", case: "c", expectedBehavior: "b", status: "decided" }],
      userStories: statuses.map((status, index) => story(`US00${index + 1}`, status)),
      ...extra,
    },
    "2026-10-15",
  );

  return getPrdOverview(prd, checkPlan(prd));
}

describe("getPrdOverview", () => {
  it("is planning while required plan items are missing and nothing is built", () => {
    expect(overview([])).toMatchObject({ stage: "planning", readyToBuild: false });
    expect(
      overview(["not_started"], { edgeCases: [{ id: "EC001", case: "c", status: "open" }] }),
    ).toMatchObject({ stage: "planning", openEdgeCases: 1, waitingOnUser: true });
  });

  it("is ready to build once the plan is ready and nothing has started", () => {
    expect(overview(["not_started", "not_started"])).toMatchObject({
      stage: "ready",
      readyToBuild: true,
      waitingOnUser: false,
    });
  });

  it("follows the stories: building, then review, then done", () => {
    expect(overview(["completed", "in_progress"]).stage).toBe("building");
    expect(overview(["in_progress", "review"])).toMatchObject({
      stage: "review",
      inReview: 1,
      waitingOnUser: true,
    });
    expect(overview(["completed", "completed"]).stage).toBe("done");
  });

  it("counts open questions as waiting on the user", () => {
    expect(overview(["not_started"], { openQuestions: ["Which plan?"] })).toMatchObject({
      openQuestions: 1,
      waitingOnUser: true,
    });
  });
});

describe("firstParagraph", () => {
  it("keeps the first paragraph as short plain text", () => {
    expect(firstParagraph("**Send** reminders to [clients](https://x.y).\n\nMore detail")).toBe(
      "Send reminders to clients.",
    );
    expect(firstParagraph("a ".repeat(200)).length).toBeLessThanOrEqual(160);
  });
});
