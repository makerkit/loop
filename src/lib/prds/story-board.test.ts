import { normalizePrd, pickNextStory } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { buildStoryBoard, groupStoriesByPhase, visibleColumns } from "./story-board";

const story = (id: string, status: string, dependencies: string[] = [], priority = "P1") => ({
  id,
  title: `Story ${id}`,
  userStory: "",
  acceptanceCriteria: ["a", "b"],
  status,
  priority,
  dependencies,
});

const prd = normalizePrd(
  {
    introduction: { title: "Board", overview: "" },
    userStories: [
      story("US001", "completed"),
      story("US002", "not_started", ["US001"]),
      story("US003", "not_started", ["US002"]),
      story("US004", "in_progress", ["US001"]),
      story("US005", "not_started", [], "P0"),
      story("US006", "review"),
    ],
    customPhases: [
      // Listed out of order on purpose: `order` decides build order
      { id: "P2", name: "Polish", description: "", color: "", order: 1, userStoryIds: ["US005"] },
      {
        id: "P1",
        name: "Foundation",
        description: "",
        color: "",
        order: 0,
        userStoryIds: ["US001", "US003", "US002"],
      },
    ],
  },
  "2026-10-15",
);

describe("groupStoriesByPhase", () => {
  it("orders phases by build order and keeps each phase's story order", () => {
    expect(
      groupStoriesByPhase(prd).map((group) => [group.name, group.items.map((s) => s.id)]),
    ).toEqual([
      ["Foundation", ["US001", "US003", "US002"]],
      ["Polish", ["US005"]],
      ["Not in a phase", ["US004", "US006"]],
    ]);
  });
});

describe("buildStoryBoard", () => {
  const board = buildStoryBoard(prd, pickNextStory(prd));
  const column = (status: string) => board.find((c) => c.status === status)!;
  const cards = (status: string) => column(status).groups.flatMap((group) => group.items);

  it("has columns by status, hiding research and blocked when empty", () => {
    expect(visibleColumns(board).map((c) => [c.label, c.count])).toEqual([
      ["Not started", 3],
      ["In progress", 1],
      ["Review", 1],
      ["Completed", 1],
    ]);
  });

  it("groups each column by phase in build order", () => {
    expect(
      column("not_started").groups.map((g) => [g.name, g.items.map((c) => c.story.id)]),
    ).toEqual([
      ["Foundation", ["US003", "US002"]],
      ["Polish", ["US005"]],
    ]);
  });

  it("highlights the next ready story and says what waiting stories wait for", () => {
    const byId = Object.fromEntries(cards("not_started").map((card) => [card.story.id, card]));

    // US002 is ready too, but the next story follows phase order first
    expect(byId.US002).toMatchObject({ isNext: true, waitingOn: [] });
    expect(byId.US003).toMatchObject({ isNext: false, waitingOn: ["US002"] });
    expect(byId.US005).toMatchObject({ isNext: false, waitingOn: [] });
  });

  it("shows a blocked column when a story is blocked", () => {
    const blocked = normalizePrd({ userStories: [story("US001", "blocked")] }, "2026-10-15");

    expect(
      visibleColumns(buildStoryBoard(blocked, pickNextStory(blocked))).map((c) => c.status),
    ).toContain("blocked");
  });

  it("says what any unfinished story waits for, not only stories that have not started", () => {
    const chain = normalizePrd(
      {
        userStories: [
          story("US001", "in_progress"),
          story("US002", "blocked", ["US001"]),
          story("US003", "completed", ["US001"]),
        ],
      },
      "2026-10-15",
    );
    const all = buildStoryBoard(chain, pickNextStory(chain)).flatMap((c) =>
      c.groups.flatMap((g) => g.items),
    );

    expect(Object.fromEntries(all.map((card) => [card.story.id, card.waitingOn]))).toEqual({
      US001: [],
      US002: ["US001"],
      US003: [],
    });
  });

  it("shows an empty research or blocked column when it is a drop target", () => {
    expect(visibleColumns(board, (status) => status === "research").map((c) => c.status)).toEqual([
      "not_started",
      "research",
      "in_progress",
      "review",
      "completed",
    ]);
  });
});
