import type { PlanCheckItem } from "@makerkit/prd";

/**
 * Where each PRD section is shown in the document view, as the id of its
 * section element. Plan check items link to these.
 */
const SECTION_ANCHORS: Record<string, { anchor: string; label: string }> = {
  introduction: { anchor: "overview", label: "Overview" },
  problemStatement: { anchor: "problem", label: "Problem" },
  solutionOverview: { anchor: "solution", label: "Solution" },
  nonGoals: { anchor: "scope", label: "Scope" },
  outOfScope: { anchor: "scope", label: "Scope" },
  assumptions: { anchor: "scope", label: "Scope" },
  technicalContracts: { anchor: "data-model", label: "Data model" },
  technicalRequirements: { anchor: "services", label: "Outside services" },
  acceptanceCriteria: { anchor: "quality", label: "Quality bar" },
  userStories: { anchor: "stories", label: "Stories" },
  edgeCases: { anchor: "edge-cases", label: "Edge cases" },
  designGuidance: { anchor: "design", label: "Design" },
  securityConsiderations: { anchor: "security", label: "Security" },
  customPhases: { anchor: "stories", label: "Stories" },
  rolloutPlan: { anchor: "rollout", label: "Rollout" },
  measurementPlan: { anchor: "measurement", label: "Measurement" },
  glossary: { anchor: "glossary", label: "Glossary" },
  decisionLog: { anchor: "decisions", label: "Decisions" },
  risks: { anchor: "risks", label: "Risks" },
  openQuestions: { anchor: "open-questions", label: "Open questions" },
};

export function storyAnchor(storyId: string) {
  return `story-${storyId}`;
}

export interface PlanCheckTarget {
  /** The document section to fix, or null when it is not shown. */
  section: { anchor: string; label: string } | null;
  /** The stories the item is about, each linking to the story. */
  stories: Array<{ id: string; anchor: string }>;
}

/** Items whose PRD section is shared, shown where the reader looks for them. */
const ITEM_ANCHORS: Record<string, { anchor: string; label: string }> = {
  // Permissions live in technicalContracts with the data model, but are security
  permissions: { anchor: "security", label: "Security" },
};

export function getPlanCheckTarget(item: PlanCheckItem): PlanCheckTarget {
  return {
    section: ITEM_ANCHORS[item.id] ?? SECTION_ANCHORS[item.section] ?? null,
    stories: (item.storyIds ?? []).map((id) => ({ id, anchor: storyAnchor(id) })),
  };
}
