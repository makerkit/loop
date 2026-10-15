import { describe, expect, it } from "vitest";

import type { StoryStatus, StructuredPRD, UserStory } from "@makerkit/prd";

import { dropOn, movesFrom, noDropReason, startedDependents } from "./moves";

describe("movesFrom", () => {
  it("offers every status but completed, nothing from completed, and review to in progress only by sending back", () => {
    expect(movesFrom("not_started")).toEqual(["research", "in_progress", "review", "blocked"]);
    expect(movesFrom("in_progress")).toEqual(["not_started", "research", "review", "blocked"]);
    expect(movesFrom("review")).toEqual(["not_started", "research", "blocked"]);
    expect(movesFrom("blocked")).toEqual(["not_started", "research", "in_progress", "review"]);
    expect(movesFrom("completed")).toEqual([]);
  });
});

describe("dropOn", () => {
  it("moves to any column but completed", () => {
    expect(dropOn("not_started", "in_progress")).toEqual({ kind: "move", to: "in_progress" });
    expect(dropOn("in_progress", "review")).toEqual({ kind: "move", to: "review" });
    expect(dropOn("blocked", "not_started")).toEqual({ kind: "move", to: "not_started" });
  });

  it("opens the story to approve, send back or reopen it", () => {
    expect(dropOn("review", "completed")).toEqual({ kind: "open" });
    expect(dropOn("review", "in_progress")).toEqual({ kind: "open", step: "send-back" });
    expect(dropOn("completed", "not_started")).toEqual({ kind: "open", step: "reopen" });
  });

  it("refuses completing without review, other moves out of completed, and the same column", () => {
    expect(dropOn("in_progress", "completed")).toBeNull();
    expect(dropOn("completed", "in_progress")).toBeNull();
    expect(dropOn("not_started", "not_started")).toBeNull();
  });

  it("refuses work statuses while dependencies are not completed", () => {
    expect(dropOn("not_started", "in_progress", ["US002"])).toBeNull();
    expect(dropOn("in_progress", "review", ["US002"])).toBeNull();
    expect(dropOn("review", "completed", ["US002"])).toBeNull();
    expect(dropOn("not_started", "blocked", ["US002"])).toEqual({ kind: "move", to: "blocked" });
  });
});

describe("noDropReason", () => {
  it("says what the story waits for, or that completed is reached by approving", () => {
    expect(noDropReason("in_progress", ["US002", "US003"])).toBe("Waits for US002, US003");
    expect(noDropReason("blocked", ["US002"])).toBeNull();
    expect(noDropReason("completed")).toBe("Approve a story in review");
    expect(noDropReason("in_progress")).toBeNull();
  });
});

describe("startedDependents", () => {
  it("lists stories that depend on it and have started or finished", () => {
    const story = (id: string, status: StoryStatus, dependencies: string[] = []) =>
      ({ id, status, dependencies }) as unknown as UserStory;
    const prd = {
      userStories: [
        story("US001", "completed"),
        story("US002", "in_progress", ["US001"]),
        story("US003", "not_started", ["US001"]),
        story("US004", "completed", ["US001"]),
        story("US005", "review", ["US009"]),
      ],
    } as unknown as StructuredPRD;

    expect(startedDependents(prd, "US001").map((s) => s.id)).toEqual(["US002", "US004"]);
  });
});
