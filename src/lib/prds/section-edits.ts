import type { PrdSection, StructuredPRD } from "@makerkit/prd";

/**
 * What can be edited in the document view. Each edit maps to exactly one
 * `update_prd_section` section, so a save is one atomic PrdService write.
 * Pure: shared by the editor (client) and its tests.
 */

export interface EditField {
  key: string;
  label: string;
  /** `line`: one line of text; `text`: Markdown; `list`: one item per line. */
  kind: "line" | "text" | "list";
  /** Shown in an empty field, e.g. "Add an open question". */
  placeholder?: string;
}

export interface SectionEdit {
  section: PrdSection;
  fields: EditField[];
}

const list = (key: string, label: string, placeholder?: string): EditField => ({
  key,
  label,
  kind: "list",
  placeholder,
});
const text = (key: string, label: string): EditField => ({ key, label, kind: "text" });

/** Sections whose value is the list itself, not an object of fields. */
const LIST_SECTIONS = new Set<PrdSection>([
  "nonGoals",
  "outOfScope",
  "assumptions",
  "designGuidance",
  "securityConsiderations",
]);

export const SECTION_EDITS = {
  overview: {
    section: "introduction",
    fields: [{ key: "title", label: "Title", kind: "line" }, text("overview", "Overview")],
  },
  problem: {
    section: "problemStatement",
    fields: [
      text("problem", "Problem"),
      list("targetUsers", "Who it is for", "Add a user"),
      text("marketOpportunity", "Opportunity"),
    ],
  },
  solution: {
    section: "solutionOverview",
    fields: [
      text("description", "Solution"),
      list("keyFeatures", "Key features", "Add a feature"),
      list("successMetrics", "Success metrics", "Add a metric"),
    ],
  },
  nonGoals: { section: "nonGoals", fields: [list("nonGoals", "Non-goals", "Add a non-goal")] },
  outOfScope: {
    section: "outOfScope",
    fields: [list("outOfScope", "Out of scope", "Add an item")],
  },
  assumptions: {
    section: "assumptions",
    fields: [list("assumptions", "Assumptions", "Add an assumption")],
  },
  dataModel: {
    section: "technicalContracts",
    fields: [list("dataModels", "Entities", "Add an entity")],
  },
  services: {
    section: "technicalRequirements",
    fields: [list("integrationNeeds", "Services", "Add a service")],
  },
  quality: {
    section: "acceptanceCriteria",
    fields: [
      list("global", "Every story must", "Add a criterion"),
      list("qualityStandards", "Quality standards", "Add a standard"),
    ],
  },
  rollout: {
    section: "rolloutPlan",
    fields: [
      list("rolloutPhases", "Phases", "Add a phase"),
      list("featureFlags", "Feature flags", "Add a feature flag"),
      list("migrationPlan", "Migration", "Add a migration step"),
      list("rollbackConditions", "Roll back when", "Add a condition"),
    ],
  },
  measurement: {
    section: "measurementPlan",
    fields: [
      list("targetMetrics", "Targets", "Add a target"),
      list("baselineMetrics", "Baselines", "Add a baseline"),
      list("guardrailMetrics", "Guardrails", "Add a guardrail"),
      list("events", "Events", "Add an event"),
      list("dashboards", "Dashboards", "Add a dashboard"),
    ],
  },
  designGuidance: {
    section: "designGuidance",
    fields: [list("designGuidance", "Design guidance", "Add a guideline")],
  },
  permissions: {
    section: "technicalContracts",
    fields: [list("permissions", "Who can do what", "Add a permission")],
  },
  compliance: {
    section: "technicalRequirements",
    fields: [list("complianceRequirements", "Sensitive data and compliance", "Add a requirement")],
  },
  securityRules: {
    section: "securityConsiderations",
    fields: [list("securityConsiderations", "Security rules", "Add a rule")],
  },
} satisfies Record<string, SectionEdit>;

export type SectionEditId = keyof typeof SECTION_EDITS;

/** Sections Loop may write: the form-based ones above, and edge cases (own editor). */
export const EDITABLE_SECTIONS = [
  ...new Set([...Object.values(SECTION_EDITS).map((edit) => edit.section), "edgeCases"]),
] as [PrdSection, ...PrdSection[]];

/** The form values for an edit, from the PRD as loaded. */
export function readEditValues(edit: SectionEdit, prd: StructuredPRD): Record<string, string> {
  const current = prd[edit.section] as unknown;

  return Object.fromEntries(
    edit.fields.map((field) => {
      const value = LIST_SECTIONS.has(edit.section)
        ? current
        : (current as Record<string, unknown> | undefined)?.[field.key];

      if (field.kind === "list") {
        return [field.key, Array.isArray(value) ? value.join("\n") : ""];
      }

      return [field.key, typeof value === "string" ? value : ""];
    }),
  );
}

/**
 * The `value` to send to update_prd_section. List fields become one item per
 * non-empty line; a one-line field is trimmed. PrdService validates the result.
 */
export function buildSectionValue(edit: SectionEdit, values: Record<string, string>): unknown {
  const entries = edit.fields.map((field) => {
    const raw = values[field.key] ?? "";

    if (field.kind === "list") {
      return [field.key, toListItems(raw)] as const;
    }

    return [field.key, field.kind === "line" ? raw.trim() : raw] as const;
  });

  if (LIST_SECTIONS.has(edit.section)) {
    return entries[0]?.[1] ?? [];
  }

  return Object.fromEntries(entries);
}

function toListItems(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter((line) => line.length > 0);
}

export interface SectionEditErrors {
  /** Errors for a field, by field key. */
  fields: Record<string, string>;
  /** Errors that are not about one field. */
  form: string[];
}

/**
 * Splits PrdService's validation message (`Invalid value for section "x":
 * title: Too small...; other: ...`) into errors per field.
 */
export function parseSectionErrors(edit: SectionEdit, message: string): SectionEditErrors {
  const prefix = message.match(/^Invalid value for section "[^"]+": /)?.[0];

  if (!prefix) {
    return { fields: {}, form: [message] };
  }

  const errors: SectionEditErrors = { fields: {}, form: [] };
  const isListSection = LIST_SECTIONS.has(edit.section);

  for (const issue of message.slice(prefix.length).split("; ")) {
    const separator = issue.indexOf(": ");
    const path = separator === -1 ? "" : issue.slice(0, separator);
    const text = separator === -1 ? issue : issue.slice(separator + 2);
    const key = isListSection ? edit.fields[0]?.key : path.split(".")[0];
    const field = edit.fields.find((candidate) => candidate.key === key);

    if (field) {
      errors.fields[field.key] ??= describeIssue(field, text);
    } else {
      errors.form.push(text);
    }
  }

  return errors;
}

function describeIssue(field: EditField, issue: string) {
  if (field.kind === "line" && /too small|at least 1 character/i.test(issue)) {
    return `${field.label} can't be empty.`;
  }

  return `${field.label}: ${issue}`;
}
