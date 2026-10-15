import { PrdSectionValueSchemas } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import {
  buildEdgeCasesValue,
  emptyEdgeCaseRow,
  parseEdgeCaseErrors,
  toEdgeCaseRows,
} from "./edge-case-edits";

describe("edge case edits", () => {
  it("round-trips edge cases through rows", () => {
    const rows = toEdgeCaseRows([
      {
        id: "EC001",
        case: "Bounce",
        expectedBehavior: "Pause",
        status: "decided",
        storyIds: ["US001", "US003"],
      },
      { id: "EC002", case: "Partial payment", expectedBehavior: "", status: "open" },
    ]);

    expect(rows[0]!.stories).toBe("US001, US003");

    const { value } = buildEdgeCasesValue(rows);

    expect(value).toEqual([
      {
        id: "EC001",
        case: "Bounce",
        expectedBehavior: "Pause",
        status: "decided",
        storyIds: ["US001", "US003"],
      },
      { id: "EC002", case: "Partial payment", expectedBehavior: "", status: "open" },
    ]);
    expect(PrdSectionValueSchemas.edgeCases.safeParse(value).success).toBe(true);
  });

  it("leaves out blank rows and normalises story ids", () => {
    const { value, rowIndexes } = buildEdgeCasesValue([
      emptyEdgeCaseRow("a"),
      { ...emptyEdgeCaseRow("b"), case: " Timeout ", stories: "us002 US004," },
    ]);

    expect(value).toEqual([
      { case: "Timeout", expectedBehavior: "", status: "open", storyIds: ["US002", "US004"] },
    ]);
    expect(rowIndexes).toEqual([1]);
  });

  it("puts validation errors on the row they are about", () => {
    const rows = [
      emptyEdgeCaseRow("blank"),
      { ...emptyEdgeCaseRow("b"), case: "Bounce", status: "decided" as const },
    ];
    const { value, rowIndexes } = buildEdgeCasesValue(rows);
    const result = PrdSectionValueSchemas.edgeCases.safeParse(value);

    expect(result.success).toBe(false);

    const message = `Invalid value for section "edgeCases": ${result
      .error!.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")}`;

    expect(parseEdgeCaseErrors(message, rowIndexes)).toEqual({
      rows: { 1: "A decided edge case needs its expectedBehavior" },
      form: [],
    });
  });

  it("keeps errors that are not about one row for the form", () => {
    expect(
      parseEdgeCaseErrors('Invalid value for section "edgeCases": unknown stories US999', []),
    ).toEqual({ rows: {}, form: ["unknown stories US999"] });
  });
});
