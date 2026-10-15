import type { EdgeCase } from "@makerkit/prd";

/** One row of the edge case editor. `stories` is free text, e.g. "US001, US003". Pure. */
export interface EdgeCaseRow {
  /** Stable React key; new rows have no id until saved. */
  key: string;
  id?: string;
  case: string;
  expectedBehavior: string;
  status: "open" | "decided";
  stories: string;
}

export function toEdgeCaseRows(edgeCases: EdgeCase[]): EdgeCaseRow[] {
  return edgeCases.map((edgeCase) => ({
    key: edgeCase.id,
    id: edgeCase.id,
    case: edgeCase.case,
    expectedBehavior: edgeCase.expectedBehavior,
    status: edgeCase.status,
    stories: (edgeCase.storyIds ?? []).join(", "),
  }));
}

export function emptyEdgeCaseRow(key: string): EdgeCaseRow {
  return { key, case: "", expectedBehavior: "", status: "open", stories: "" };
}

/**
 * The `value` for update_prd_section "edgeCases", and for each item the row it
 * came from (blank rows are left out), so validation errors can be shown on
 * the right row.
 */
export function buildEdgeCasesValue(rows: EdgeCaseRow[]) {
  const rowIndexes: number[] = [];

  const value = rows.flatMap((row, index) => {
    if (!row.case.trim() && !row.expectedBehavior.trim()) {
      return [];
    }

    rowIndexes.push(index);

    const storyIds = row.stories
      .split(/[\s,]+/)
      .map((id) => id.trim().toUpperCase())
      .filter(Boolean);

    return [
      {
        ...(row.id ? { id: row.id } : {}),
        case: row.case.trim(),
        expectedBehavior: row.expectedBehavior.trim(),
        status: row.status,
        ...(storyIds.length > 0 ? { storyIds } : {}),
      },
    ];
  });

  return { value, rowIndexes };
}

export interface EdgeCaseErrors {
  /** By row index. */
  rows: Record<number, string>;
  form: string[];
}

/** Splits PrdService's validation message into errors per row. */
export function parseEdgeCaseErrors(message: string, rowIndexes: number[]): EdgeCaseErrors {
  const prefix = message.match(/^Invalid value for section "edgeCases": /)?.[0];

  if (!prefix) {
    return { rows: {}, form: [message] };
  }

  const errors: EdgeCaseErrors = { rows: {}, form: [] };

  for (const issue of message.slice(prefix.length).split("; ")) {
    const match = issue.match(/^(\d+)(?:\.(\w+))?: (.*)$/);
    const row = match ? rowIndexes[Number(match[1])] : undefined;

    if (match && row !== undefined) {
      errors.rows[row] ??= match[3]!;
    } else {
      errors.form.push(issue);
    }
  }

  return errors;
}
