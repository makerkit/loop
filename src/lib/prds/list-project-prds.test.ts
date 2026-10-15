import { createPrdService } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { listProjectPrds } from "./list-project-prds";
import { PRDS_DIR, createMemoryDeps } from "./testing/memory-prd-deps";

const prd = (title: string, statuses: string[]) =>
  JSON.stringify({
    introduction: { title, overview: "" },
    userStories: statuses.map((status, index) => ({
      id: `US00${index + 1}`,
      title: `Story ${index + 1}`,
      userStory: "",
      acceptanceCriteria: [],
      status,
      priority: "P1",
    })),
    // Stored in the file by PrdService on every write
    progress: {
      total: statuses.length,
      completed: statuses.filter((s) => s === "completed").length,
      blocked: statuses.filter((s) => s === "blocked").length,
      overall: statuses.length
        ? Math.round((statuses.filter((s) => s === "completed").length / statuses.length) * 100)
        : 0,
    },
  });

function list(files: Record<string, string>) {
  const { deps, dirs } = createMemoryDeps(files);
  const service = createPrdService(deps);

  return {
    dirs,
    result: listProjectPrds({
      prdsDirExists: async () => dirs.has(PRDS_DIR),
      listPrds: () => service.list(),
      loadPrd: async (filename) => {
        const { prd } = await service.get({ filename });

        return { prd, check: await service.checkPlan(filename) };
      },
    }),
  };
}

describe("listProjectPrds", () => {
  it("reports a project without a .prds folder, without creating it", async () => {
    const { dirs, result } = list({});

    expect(await result).toEqual({ hasPrdsDir: false, prds: [], warnings: [] });
    expect(dirs.has(PRDS_DIR)).toBe(false);
  });

  it("lists each PRD with its title, progress and story counts", async () => {
    const { result } = list({
      [`${PRDS_DIR}/notes.json`]: prd("Notes", [
        "completed",
        "in_progress",
        "blocked",
        "not_started",
      ]),
      [`${PRDS_DIR}/billing.json`]: prd("Billing", []),
    });

    const { hasPrdsDir, prds, warnings } = await result;

    expect(hasPrdsDir).toBe(true);
    expect(warnings).toEqual([]);
    expect(prds.map((p) => p.filename)).toEqual(["billing.json", "notes.json"]);
    expect(prds[1]).toMatchObject({
      title: "Notes",
      total_stories: 4,
      completed_stories: 1,
      blocked_stories: 1,
    });
    expect(prds[1].progress).toBe(25);
    expect(prds[0]).toMatchObject({ title: "Billing", total_stories: 0, progress: 0 });
  });

  it("shows unreadable files as warnings and still lists the rest", async () => {
    const { result } = list({
      [`${PRDS_DIR}/broken.json`]: "{ not json",
      [`${PRDS_DIR}/notes.json`]: prd("Notes", ["not_started"]),
      [`${PRDS_DIR}/readme.md`]: "# not a PRD",
    });

    const { prds, warnings } = await result;

    expect(prds.map((p) => p.filename)).toEqual(["notes.json"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("broken.json");
  });
});
