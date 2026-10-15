import type { DecisionLogEntry, GlossaryTerm, RiskItem, StructuredPRD } from "@makerkit/prd";

import { Markdown, PrdFileProvider } from "#/components/markdown";
import { type DocumentFlags, isSectionEmpty } from "#/lib/prds/document-sections";
import { SECTION_EDITS, type SectionEdit } from "#/lib/prds/section-edits";
import { cn } from "#/lib/utils";

import {
  BulletList,
  DocumentSection,
  OptionalList,
  OptionalText,
  SUBSECTION_CLASS,
  SUBSECTION_TITLE_CLASS,
} from "./document-parts";
import { DocumentFlagsProvider } from "./document-flags";
import { AddAttachment } from "./attachment-editors";
import { AttachmentList } from "./attachments";
import { DocumentStories } from "./document-stories";
import { EdgeCaseTable, EdgeCasesEditor } from "./edge-cases";
import { OpenQuestions } from "./open-questions";
import { EditableSection, EditableSubsection } from "./editable-section";
import { PrdEditProvider } from "./prd-edit-context";

/** A PRD as a readable document. Markdown in PRD text is rendered safely. */
export function PrdDocument({
  filename,
  prd,
  flags,
}: {
  filename: string;
  prd: StructuredPRD;
  flags: DocumentFlags;
}) {
  const { problemStatement: problem, solutionOverview: solution } = prd;

  return (
    <PrdFileProvider value={filename}>
      <PrdEditProvider value={{ filename, prd }}>
        <DocumentFlagsProvider value={flags}>
          <article className="grid min-w-0 gap-10 rounded-xl border bg-card px-5 py-8 shadow-xs [overflow-wrap:anywhere] sm:px-10 sm:py-10">
            <EditableSection
              id="overview"
              title="Overview"
              edit={SECTION_EDITS.overview}
              isEmpty={isSectionEmpty(prd, "overview")}
            >
              <OptionalText text={prd.introduction.overview} />
            </EditableSection>

            <EditableSection
              id="problem"
              title="Problem"
              edit={SECTION_EDITS.problem}
              isEmpty={isSectionEmpty(prd, "problem")}
            >
              <OptionalText text={problem.problem} />
              <OptionalList title="Who it is for" items={problem.targetUsers} />
              <OptionalText title="Opportunity" text={problem.marketOpportunity} />
            </EditableSection>

            <EditableSection
              id="solution"
              title="Solution"
              edit={SECTION_EDITS.solution}
              isEmpty={isSectionEmpty(prd, "solution")}
            >
              <OptionalText text={solution.description} />
              <OptionalList title="Key features" items={solution.keyFeatures} />
              <OptionalList title="Success metrics" items={solution.successMetrics} />
            </EditableSection>

            <DocumentSection id="scope" title="Scope">
              <EditableList title="Non-goals" edit={SECTION_EDITS.nonGoals} items={prd.nonGoals} />
              <EditableList
                title="Out of scope"
                edit={SECTION_EDITS.outOfScope}
                items={prd.outOfScope}
              />
              <EditableList
                title="Assumptions"
                edit={SECTION_EDITS.assumptions}
                items={prd.assumptions}
              />
            </DocumentSection>

            <EditableSection
              id="data-model"
              title="Data model"
              edit={SECTION_EDITS.dataModel}
              isEmpty={isSectionEmpty(prd, "data-model")}
            >
              <BulletList items={prd.technicalContracts.dataModels} />
            </EditableSection>

            <EditableSection
              id="services"
              title="Outside services"
              edit={SECTION_EDITS.services}
              isEmpty={isSectionEmpty(prd, "services")}
            >
              <BulletList items={prd.technicalRequirements.integrationNeeds} />
            </EditableSection>

            <DocumentSection id="security" title="Security">
              <EditableList
                title="Who can do what"
                edit={SECTION_EDITS.permissions}
                items={prd.technicalContracts.permissions}
              />
              <EditableList
                title="Sensitive data and compliance"
                edit={SECTION_EDITS.compliance}
                items={prd.technicalRequirements.complianceRequirements}
              />
              <EditableList
                title="Security rules"
                edit={SECTION_EDITS.securityRules}
                items={prd.securityConsiderations}
              />
            </DocumentSection>

            <DocumentSection id="design" title="Design">
              <EditableList
                title="Guidance"
                edit={SECTION_EDITS.designGuidance}
                items={prd.designGuidance}
              />
              <DesignDecisions decisions={prd.decisionLog} />
            </DocumentSection>

            <DocumentSection id="attachments" title="Attachments">
              {prd.attachments.length > 0 ? (
                <AttachmentList
                  filename={filename}
                  attachments={prd.attachments}
                  stories={prd.userStories}
                  editable
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No attachments yet. Add mockups, screenshots or links the agent should follow.
                </p>
              )}
              <AddAttachment stories={prd.userStories} />
            </DocumentSection>

            <EditableSection
              id="quality"
              title="Quality bar"
              edit={SECTION_EDITS.quality}
              isEmpty={isSectionEmpty(prd, "quality")}
            >
              <OptionalList title="Every story must" items={prd.acceptanceCriteria.global} />
              <OptionalList
                title="Quality standards"
                items={prd.acceptanceCriteria.qualityStandards}
              />
            </EditableSection>

            <DocumentSection id="stories" title="Stories" isEmpty={isSectionEmpty(prd, "stories")}>
              <DocumentStories filename={filename} prd={prd} />
            </DocumentSection>

            <EditableSection
              id="edge-cases"
              title="Edge cases"
              edit={(props) => <EdgeCasesEditor {...props} />}
              isEmpty={isSectionEmpty(prd, "edge-cases")}
            >
              <EdgeCaseTable edgeCases={prd.edgeCases} />
            </EditableSection>

            <EditableSection
              id="rollout"
              title="Rollout"
              edit={SECTION_EDITS.rollout}
              isEmpty={isSectionEmpty(prd, "rollout")}
            >
              <OptionalList title="Phases" items={prd.rolloutPlan.rolloutPhases} />
              <OptionalList title="Feature flags" items={prd.rolloutPlan.featureFlags} />
              <OptionalList title="Migration" items={prd.rolloutPlan.migrationPlan} />
              <OptionalList title="Roll back when" items={prd.rolloutPlan.rollbackConditions} />
            </EditableSection>

            <EditableSection
              id="measurement"
              title="Measurement"
              edit={SECTION_EDITS.measurement}
              isEmpty={isSectionEmpty(prd, "measurement")}
            >
              <OptionalList title="Targets" items={prd.measurementPlan.targetMetrics} />
              <OptionalList title="Baselines" items={prd.measurementPlan.baselineMetrics} />
              <OptionalList title="Guardrails" items={prd.measurementPlan.guardrailMetrics} />
              <OptionalList title="Events" items={prd.measurementPlan.events} />
              <OptionalList title="Dashboards" items={prd.measurementPlan.dashboards} />
            </EditableSection>

            <DocumentSection
              id="glossary"
              title="Glossary"
              isEmpty={isSectionEmpty(prd, "glossary")}
            >
              <Glossary terms={prd.glossary} />
            </DocumentSection>

            <DocumentSection
              id="decisions"
              title="Decisions"
              isEmpty={isSectionEmpty(prd, "decisions")}
            >
              <Decisions decisions={prd.decisionLog} />
            </DocumentSection>

            <DocumentSection id="risks" title="Risks" isEmpty={isSectionEmpty(prd, "risks")}>
              <Risks risks={prd.risks} />
            </DocumentSection>

            <DocumentSection id="open-questions" title="Open questions">
              <OpenQuestions questions={prd.openQuestions} />
            </DocumentSection>
          </article>
        </DocumentFlagsProvider>
      </PrdEditProvider>
    </PrdFileProvider>
  );
}

/** A list that is always shown, so it can be edited even when empty. */
function EditableList({
  title,
  edit,
  items,
}: {
  title: string;
  edit: SectionEdit;
  items: string[];
}) {
  return (
    <EditableSubsection title={title} edit={edit} isEmpty={items.length === 0}>
      <BulletList items={items} />
    </EditableSubsection>
  );
}

/** Accepted decisions with a `design:` topic; the full log is under Decisions. */
function DesignDecisions({ decisions }: { decisions: DecisionLogEntry[] }) {
  const design = decisions.filter(
    (entry) => entry.status === "accepted" && entry.topic?.startsWith("design"),
  );

  if (design.length === 0) {
    return null;
  }

  return (
    <div className={SUBSECTION_CLASS}>
      <h3 className={SUBSECTION_TITLE_CLASS}>Design decisions</h3>
      <BulletList items={design.map((entry) => `${entry.decision} (${entry.id})`)} />
    </div>
  );
}

function Glossary({ terms }: { terms: GlossaryTerm[] }) {
  return (
    <dl className="divide-y rounded-lg border text-[15px]">
      {terms.map((term) => (
        <div
          key={term.term}
          className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4"
        >
          <dt className="font-medium">{term.term}</dt>
          <dd className="grid gap-1 leading-6">
            <Markdown text={term.definition} inline />
            {term.avoid.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                Don't say: {term.avoid.join(", ")}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const DECISION_STATUS_CLASSES: Record<DecisionLogEntry["status"], string> = {
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  proposed: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  superseded: "bg-muted text-muted-foreground",
};

const DECISION_STATUS_LABELS: Record<DecisionLogEntry["status"], string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  superseded: "Superseded",
};

function Decisions({ decisions }: { decisions: DecisionLogEntry[] }) {
  return (
    <ol className="divide-y rounded-lg border">
      {decisions.map((decision) => {
        const superseded = decision.status === "superseded";

        return (
          <li key={decision.id} className={cn("grid gap-2 px-4 py-4", superseded && "bg-muted/40")}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  "inline-flex h-5 items-center rounded-full px-2 font-medium",
                  DECISION_STATUS_CLASSES[decision.status],
                )}
              >
                {DECISION_STATUS_LABELS[decision.status]}
              </span>
              <span className="tabular-nums">{decision.date}</span>
              {decision.owner ? <span>· {decision.owner}</span> : null}
            </div>

            <p
              className={cn(
                "text-[15px] font-medium",
                superseded && "text-muted-foreground line-through decoration-muted-foreground/60",
              )}
            >
              <Markdown text={decision.decision} inline />
            </p>

            <OptionalText text={decision.rationale} />
          </li>
        );
      })}
    </ol>
  );
}

const SEVERITY_CLASSES: Record<RiskItem["severity"], string> = {
  high: "bg-status-blocked",
  medium: "bg-status-review",
  low: "bg-status-not-started",
};

function Risks({ risks }: { risks: RiskItem[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {risks.map((risk) => (
        <li key={risk.id} className="grid gap-1.5 px-4 py-4 text-[15px] leading-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground capitalize">
              <span className={cn("size-2 rounded-full", SEVERITY_CLASSES[risk.severity])} />
              {risk.severity}
            </span>
            {risk.owner ? <span>· {risk.owner}</span> : null}
          </div>

          <Markdown text={risk.description} inline className="font-medium" />

          {risk.mitigation ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground/80">Mitigation: </span>
              <Markdown text={risk.mitigation} inline />
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
