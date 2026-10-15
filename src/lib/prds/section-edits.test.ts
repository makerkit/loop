import { PrdSectionValueSchemas, normalizePrd } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import {
  SECTION_EDITS,
  buildSectionValue,
  parseSectionErrors,
  readEditValues,
} from "./section-edits";

const prd = normalizePrd(
  {
    introduction: { title: "Notes", overview: "Take **notes**" },
    problemStatement: { problem: "Lost ideas", marketOpportunity: "", targetUsers: ["Writers"] },
    nonGoals: ["Sync", "Sharing"],
    rolloutPlan: {
      rolloutPhases: ["Beta"],
      featureFlags: [],
      migrationPlan: [],
      rollbackConditions: [],
    },
  },
  "2026-10-15",
);

describe("section edits", () => {
  it("reads every edit's values and builds a value update_prd_section accepts", () => {
    for (const [id, edit] of Object.entries(SECTION_EDITS)) {
      const value = buildSectionValue(edit, readEditValues(edit, prd));

      // The overview's title must not be empty; this PRD has one
      expect(PrdSectionValueSchemas[edit.section].safeParse(value).success, id).toBe(true);
    }
  });

  it("round-trips lists as one item per line", () => {
    const edit = SECTION_EDITS.nonGoals;

    expect(readEditValues(edit, prd)).toEqual({ nonGoals: "Sync\nSharing" });
    expect(buildSectionValue(edit, { nonGoals: "Sync\n\n  - Sharing  \r\n* Export\n" })).toEqual([
      "Sync",
      "Sharing",
      "Export",
    ]);
  });

  it("builds an object for object sections, including empty lists", () => {
    expect(
      buildSectionValue(SECTION_EDITS.problem, {
        problem: "Lost ideas\n\nMore detail",
        targetUsers: "",
        marketOpportunity: "Big",
      }),
    ).toEqual({ problem: "Lost ideas\n\nMore detail", targetUsers: [], marketOpportunity: "Big" });
  });

  it("trims a one-line field", () => {
    expect(buildSectionValue(SECTION_EDITS.overview, { title: "  Notes  ", overview: "" })).toEqual(
      {
        title: "Notes",
        overview: "",
      },
    );
  });
});

describe("parseSectionErrors", () => {
  it("assigns PrdService's validation issues to fields", () => {
    const value = buildSectionValue(SECTION_EDITS.overview, { title: " ", overview: "x" });
    const result = PrdSectionValueSchemas.introduction.safeParse(value);

    expect(result.success).toBe(false);

    const message = `Invalid value for section "introduction": ${result
      .error!.issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
      .join("; ")}`;

    expect(parseSectionErrors(SECTION_EDITS.overview, message)).toEqual({
      fields: { title: "Title can't be empty." },
      form: [],
    });
  });

  it("assigns list section issues to the list field", () => {
    expect(
      parseSectionErrors(
        SECTION_EDITS.nonGoals,
        'Invalid value for section "nonGoals": 0: Too small: expected string to have >=1 characters',
      ).fields,
    ).toHaveProperty("nonGoals");
  });

  it("keeps other errors for the whole form", () => {
    expect(parseSectionErrors(SECTION_EDITS.overview, "Disk full")).toEqual({
      fields: {},
      form: ["Disk full"],
    });
  });
});
