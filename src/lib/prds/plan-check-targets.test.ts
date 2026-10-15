import { checkPlan, normalizePrd } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { getPlanCheckTarget, storyAnchor } from "./plan-check-targets";

describe("getPlanCheckTarget", () => {
  it("links every section check_plan can report to a document section", () => {
    // An empty PRD with stories that trigger every story-level item
    const prd = normalizePrd(
      {
        introduction: { title: "Empty", overview: "" },
        openQuestions: ["Which browser?"],
        userStories: Array.from({ length: 6 }, (_, index) => ({
          id: `US00${index + 1}`,
          title: "Story",
          userStory: "",
          acceptanceCriteria: index === 0 ? [] : ["one"],
          status: index === 1 ? "blocked" : "not_started",
          priority: "P1",
        })),
      },
      "2026-10-15",
    );

    const { items } = checkPlan(prd);

    expect(items.length).toBeGreaterThan(5);

    for (const item of items) {
      expect(getPlanCheckTarget(item).section, item.section).not.toBeNull();
    }
  });

  it("links the stories an item is about", () => {
    const target = getPlanCheckTarget({
      id: "vague-stories",
      section: "userStories",
      message: "2 stories need more detailed acceptance criteria",
      severity: "recommended",
      storyIds: ["US001", "US004"],
    });

    expect(target).toEqual({
      section: { anchor: "stories", label: "Stories" },
      stories: [
        { id: "US001", anchor: storyAnchor("US001") },
        { id: "US004", anchor: storyAnchor("US004") },
      ],
    });
  });

  it("has no section link for a section the document does not show", () => {
    expect(
      getPlanCheckTarget({
        id: "x",
        section: "agentTaskPackets",
        message: "x",
        severity: "recommended",
      }).section,
    ).toBeNull();
  });
});
