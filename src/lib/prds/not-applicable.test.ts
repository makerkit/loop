import { checkPlan, createPrdService, type StructuredPRD } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { getDocumentFlags } from "./document-sections";
import { markNotApplicable } from "./not-applicable";
import { PRDS_DIR, createMemoryDeps } from "./testing/memory-prd-deps";

const FILE = `${PRDS_DIR}/notes.json`;

function setup() {
  const { deps, fs } = createMemoryDeps({
    [FILE]: JSON.stringify({
      introduction: { title: "Notes", overview: "x" },
      metadata: { revision: 2 },
    }),
  });

  return {
    service: createPrdService(deps),
    read: () => JSON.parse(fs.get(FILE)!) as StructuredPRD,
  };
}

describe("markNotApplicable", () => {
  it("marks a part not applicable and back", async () => {
    const { service, read } = setup();

    expect(
      await markNotApplicable(service, {
        filename: "notes.json",
        topic: "rollout",
        notApplicable: true,
        reason: "Internal tool",
        expectedRevision: 2,
      }),
    ).toEqual({ status: "saved" });
    expect(read().notApplicable).toEqual({ rollout: "Internal tool" });

    await markNotApplicable(service, {
      filename: "notes.json",
      topic: "rollout",
      notApplicable: false,
      expectedRevision: 3,
    });
    expect(read().notApplicable).toEqual({});
  });

  it("reports a conflict when the PRD changed since it was loaded", async () => {
    const { service, read } = setup();

    expect(
      await markNotApplicable(service, {
        filename: "notes.json",
        topic: "rollout",
        notApplicable: true,
        expectedRevision: 1,
      }),
    ).toEqual({ status: "conflict" });
    expect(read().notApplicable ?? {}).toEqual({});
  });

  it("shows a not-applicable section as N/A and drops its plan check items", async () => {
    const { service } = setup();

    await markNotApplicable(service, {
      filename: "notes.json",
      topic: "rollout",
      notApplicable: true,
      expectedRevision: 2,
    });

    const { prd } = await service.get({ filename: "notes.json" });
    const flags = getDocumentFlags(prd, checkPlan(prd));

    expect(flags.sections.rollout).toEqual({ state: "na" });
    expect(flags.sectionItems.rollout ?? []).toEqual([]);
  });
});

describe("NOT_APPLICABLE_TOPICS", () => {
  it("matches @makerkit/prd", async () => {
    const { NOT_APPLICABLE_TOPICS: fromPackage } = await import("@makerkit/prd");
    const { NOT_APPLICABLE_TOPICS: local } = await import("./not-applicable");

    expect([...local]).toEqual([...fromPackage]);
  });
});
