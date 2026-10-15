import { describe, expect, it } from "vitest";

import { lastProjectChange, timeAgo } from "./activity";

describe("lastProjectChange", () => {
  it("is the newest change outside .prds, ignoring deleted files", async () => {
    const times: Record<string, number> = {
      "src/a.ts": 100,
      "src/b.ts": 300,
      ".prds/notes.json": 900,
    };

    expect(
      await lastProjectChange(
        [
          { path: "src/a.ts", kind: "modified", staged: false },
          { path: "src/b.ts", kind: "untracked", staged: false },
          { path: ".prds/notes.json", kind: "modified", staged: false },
          { path: "gone.ts", kind: "deleted", staged: false },
        ],
        async (path) => times[path] ?? null,
      ),
    ).toBe(300);
  });

  it("is null without uncommitted changes", async () => {
    expect(await lastProjectChange([], async () => 1)).toBeNull();
  });
});

describe("timeAgo", () => {
  it("reads naturally", () => {
    expect(timeAgo(0, 5_000)).toBe("just now");
    expect(timeAgo(0, 40_000)).toBe("40 s ago");
    expect(timeAgo(0, 180_000)).toBe("3 min ago");
    expect(timeAgo(0, 7_200_000)).toBe("2 h ago");
  });
});
