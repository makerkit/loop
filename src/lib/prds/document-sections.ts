import type {
  CheckPlanOutput,
  NotApplicableTopic,
  PlanCheckItem,
  StructuredPRD,
} from "@makerkit/prd";

import { getPlanCheckTarget } from "./plan-check-targets";

/**
 * The document view's sections in order, and what the plan check says about
 * each: where its items belong (the section, or individual stories) and the
 * state shown in the table of contents. Pure.
 */

const blank = (...values: Array<string | string[]>) =>
  values.every((value) => (Array.isArray(value) ? value.length === 0 : value.trim().length === 0));

export const DOCUMENT_SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    isEmpty: (p: StructuredPRD) => blank(p.introduction.overview),
  },
  {
    id: "problem",
    title: "Problem",
    isEmpty: (p: StructuredPRD) =>
      blank(
        p.problemStatement.problem,
        p.problemStatement.targetUsers,
        p.problemStatement.marketOpportunity,
      ),
  },
  {
    id: "solution",
    title: "Solution",
    isEmpty: (p: StructuredPRD) =>
      blank(
        p.solutionOverview.description,
        p.solutionOverview.keyFeatures,
        p.solutionOverview.successMetrics,
      ),
  },
  {
    id: "scope",
    title: "Scope",
    isEmpty: (p: StructuredPRD) => blank(p.nonGoals, p.outOfScope, p.assumptions),
  },
  {
    id: "data-model",
    title: "Data model",
    isEmpty: (p: StructuredPRD) => blank(p.technicalContracts.dataModels),
  },
  {
    id: "services",
    title: "Outside services",
    isEmpty: (p: StructuredPRD) => blank(p.technicalRequirements.integrationNeeds),
  },
  {
    id: "security",
    title: "Security",
    isEmpty: (p: StructuredPRD) =>
      blank(
        p.technicalContracts.permissions,
        p.technicalRequirements.complianceRequirements,
        p.securityConsiderations,
      ),
  },
  {
    id: "design",
    title: "Design",
    isEmpty: (p: StructuredPRD) =>
      p.designGuidance.length === 0 &&
      !p.decisionLog.some((entry) => entry.topic?.startsWith("design")),
  },
  {
    id: "attachments",
    title: "Attachments",
    isEmpty: (p: StructuredPRD) => p.attachments.length === 0,
  },
  {
    id: "quality",
    title: "Quality bar",
    isEmpty: (p: StructuredPRD) =>
      blank(p.acceptanceCriteria.global, p.acceptanceCriteria.qualityStandards),
  },
  { id: "stories", title: "Stories", isEmpty: (p: StructuredPRD) => p.userStories.length === 0 },
  {
    id: "edge-cases",
    title: "Edge cases",
    isEmpty: (p: StructuredPRD) => p.edgeCases.length === 0,
  },
  {
    id: "rollout",
    title: "Rollout",
    isEmpty: (p: StructuredPRD) =>
      blank(
        p.rolloutPlan.rolloutPhases,
        p.rolloutPlan.featureFlags,
        p.rolloutPlan.migrationPlan,
        p.rolloutPlan.rollbackConditions,
      ),
  },
  {
    id: "measurement",
    title: "Measurement",
    isEmpty: (p: StructuredPRD) =>
      blank(
        p.measurementPlan.targetMetrics,
        p.measurementPlan.baselineMetrics,
        p.measurementPlan.guardrailMetrics,
        p.measurementPlan.events,
        p.measurementPlan.dashboards,
      ),
  },
  { id: "glossary", title: "Glossary", isEmpty: (p: StructuredPRD) => p.glossary.length === 0 },
  {
    id: "decisions",
    title: "Decisions",
    isEmpty: (p: StructuredPRD) => p.decisionLog.length === 0,
  },
  { id: "risks", title: "Risks", isEmpty: (p: StructuredPRD) => p.risks.length === 0 },
  {
    id: "open-questions",
    title: "Open questions",
    // No open questions is the good state, not a missing section
    isEmpty: () => false,
  },
] as const;

export type DocumentSectionId = (typeof DOCUMENT_SECTIONS)[number]["id"];

export function isSectionEmpty(prd: StructuredPRD, id: DocumentSectionId) {
  return DOCUMENT_SECTIONS.find((section) => section.id === id)!.isEmpty(prd);
}

/** The not-applicable topic (see @makerkit/prd) of each optional document section. */
export const SECTION_TOPICS: Partial<Record<DocumentSectionId, NotApplicableTopic>> = {
  "data-model": "dataModel",
  services: "outsideServices",
  security: "security",
  design: "design",
  quality: "qualityBar",
  "edge-cases": "edgeCases",
  rollout: "rollout",
  measurement: "measurement",
  glossary: "glossary",
  risks: "risks",
};

/** Why a section does not apply ("" when no reason was given), or null when it applies. */
export function notApplicableReason(prd: StructuredPRD, id: string) {
  const topic = SECTION_TOPICS[id as DocumentSectionId];

  return topic === undefined ? null : (prd.notApplicable[topic] ?? null);
}

/**
 * `issues`: the plan check has items here; `done`: written, nothing missing;
 * `empty`: not written; `na`: marked not applicable.
 */
export type SectionState =
  | { state: "issues"; count: number; required: boolean }
  | { state: "done" }
  | { state: "empty" }
  | { state: "na" };

export interface DocumentFlags {
  sections: Record<string, SectionState>;
  /** Items about a section as a whole, shown under its heading. */
  sectionItems: Record<string, PlanCheckItem[]>;
  /** Short flags per story, shown on the story. */
  stories: Record<string, StoryFlag[]>;
}

export interface StoryFlag {
  label: string;
  severity: PlanCheckItem["severity"];
}

/** What each per-story check means for one story, in a few words. */
const STORY_FLAG_LABELS: Record<string, string> = {
  "stories-without-criteria": "No acceptance criteria",
  "vague-stories": "Needs more detailed acceptance criteria",
  "test-seams": "Doesn't say where it is tested",
  "unproven-criteria": "Doesn't say how each criterion is proven",
  "e2e-proofs": "End-to-end proof without a reason",
  "untested-proofs": "Mostly checked by hand",
  phases: "Not in a phase",
  "blocked-stories": "Blocked",
  "open-edge-cases": "Open edge case",
};

export function getDocumentFlags(prd: StructuredPRD, check: CheckPlanOutput): DocumentFlags {
  const sectionItems: Record<string, PlanCheckItem[]> = {};
  const stories: Record<string, StoryFlag[]> = {};

  for (const item of check.items) {
    const target = getPlanCheckTarget(item);

    if (target.stories.length > 0) {
      for (const story of target.stories) {
        (stories[story.id] ??= []).push({
          label: STORY_FLAG_LABELS[item.id] ?? item.message,
          severity: item.severity,
        });
      }
    }

    if (target.section) {
      (sectionItems[target.section.anchor] ??= []).push(item);
    }
  }

  const sections = Object.fromEntries(
    DOCUMENT_SECTIONS.map((section): [string, SectionState] => {
      const items = sectionItems[section.id] ?? [];

      if (items.length === 0 && notApplicableReason(prd, section.id) !== null) {
        return [section.id, { state: "na" }];
      }

      if (items.length > 0) {
        return [
          section.id,
          {
            state: "issues",
            count: items.length,
            required: items.some((item) => item.severity === "required"),
          },
        ];
      }

      return [section.id, { state: section.isEmpty(prd) ? "empty" : "done" }];
    }),
  );

  // In the Stories section, story-level items are shown on each story rather
  // than again under the heading. Elsewhere (e.g. open edge cases) the
  // section is where they are fixed, so they stay.
  if (sectionItems.stories) {
    sectionItems.stories = sectionItems.stories.filter((item) => !item.storyIds?.length);
  }

  return { sections, sectionItems, stories };
}
