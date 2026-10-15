import { createPrdService, type StructuredPRD } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { PRDS_DIR, createMemoryDeps } from "./testing/memory-prd-deps";
import { updateSection } from "./update-section";

const FILE = `${PRDS_DIR}/notes.json`;

function setup() {
  const { deps, fs } = createMemoryDeps({
    [FILE]: JSON.stringify({
      introduction: { title: "Notes", overview: "Old" },
      nonGoals: ["Sync"],
      metadata: { revision: 3 },
    }),
  });

  const service = createPrdService(deps);
  const read = () => JSON.parse(fs.get(FILE)!) as StructuredPRD;

  return { service, read };
}

describe("updateSection", () => {
  it("saves a change based on the current revision", async () => {
    const { service, read } = setup();

    const result = await updateSection(service, {
      filename: "notes.json",
      section: "nonGoals",
      value: ["Sync", "Sharing"],
      expectedRevision: 3,
    });

    expect(result).toEqual({ status: "saved", revision: 4 });
    expect(read().nonGoals).toEqual(["Sync", "Sharing"]);
  });

  it("reports a conflict and writes nothing when the PRD changed since it was loaded", async () => {
    const { service, read } = setup();

    // The agent changes the same section after the user opened the PRD
    await service.updatePrdSection({
      filename: "notes.json",
      section: "nonGoals",
      value: ["Agent"],
    });

    const result = await updateSection(service, {
      filename: "notes.json",
      section: "nonGoals",
      value: ["Stale"],
      expectedRevision: 3,
    });

    expect(result).toEqual({ status: "conflict" });
    expect(read().nonGoals).toEqual(["Agent"]);
    expect(read().metadata.revision).toBe(4);
  });

  it("reports values update_prd_section rejects", async () => {
    const { service, read } = setup();

    const result = await updateSection(service, {
      filename: "notes.json",
      section: "introduction",
      value: { title: "" },
      expectedRevision: 3,
    });

    expect(result).toMatchObject({ status: "invalid" });
    expect(result.status === "invalid" && result.message).toMatch(/section "introduction"/);
    expect(read().introduction.title).toBe("Notes");
  });

  it("throws other errors", async () => {
    const { service } = setup();

    await expect(
      updateSection(service, {
        filename: "missing.json",
        section: "nonGoals",
        value: [],
        expectedRevision: 0,
      }),
    ).rejects.toThrow(/not found/);
  });
});
