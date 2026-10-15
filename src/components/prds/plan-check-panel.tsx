import type { CheckPlanOutput, PlanCheckItem } from "@makerkit/prd";
import { ArrowRightIcon, ChevronDownIcon, CircleAlertIcon, CircleCheckIcon } from "lucide-react";

import { getPlanCheckTarget } from "#/lib/prds/plan-check-targets";
import { cn } from "#/lib/utils";

/**
 * What the plan is still missing, from check_plan, linked to the document.
 * Open by default while something required is missing; collapsed otherwise.
 */
export function PlanCheckPanel({ check }: { check: CheckPlanOutput }) {
  const required = check.items.filter((item) => item.severity === "required");
  const recommended = check.items.filter((item) => item.severity === "recommended");
  const ready = check.ready_to_build;

  return (
    <section
      id="plan-check"
      aria-labelledby="plan-check-title"
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-xs",
        !ready && "border-destructive/30",
      )}
    >
      <details open={!ready} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              ready
                ? "bg-status-completed/10 text-status-completed"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {ready ? (
              <CircleCheckIcon className="size-4" />
            ) : (
              <CircleAlertIcon className="size-4" />
            )}
          </span>

          <span className="grid flex-1 gap-0.5">
            <h2 id="plan-check-title" className="font-semibold">
              {ready ? "Ready to build" : "Not ready to build"}
            </h2>
            <span className="text-sm text-muted-foreground">
              {summarize(required, recommended)}
            </span>
          </span>

          {check.items.length > 0 ? (
            <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          ) : null}
        </summary>

        {check.items.length > 0 ? (
          <ul className="divide-y border-t">
            {[...required, ...recommended].map((item) => (
              <li key={item.id}>
                <PlanCheckRow item={item} />
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </section>
  );
}

function PlanCheckRow({ item }: { item: PlanCheckItem }) {
  const { section, stories } = getPlanCheckTarget(item);
  const required = item.severity === "required";

  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-5 py-3 text-sm">
      <span
        title={required ? "Required" : "Recommended"}
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          required ? "bg-destructive" : "bg-status-review",
        )}
      />

      <span className="grid min-w-0 flex-1 gap-1.5">
        <span>
          {item.message}
          {required ? (
            <span className="ml-2 text-xs font-medium text-destructive">Required</span>
          ) : null}
        </span>

        {stories.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {stories.map((story) => (
              <a
                key={story.id}
                href={`#${story.anchor}`}
                className="rounded border bg-muted/50 px-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                {story.id}
              </a>
            ))}
          </span>
        ) : null}
      </span>

      {section ? (
        <a
          href={`#${section.anchor}`}
          className="ml-5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground sm:ml-0"
        >
          Go to {section.label}
          <ArrowRightIcon className="size-3" />
        </a>
      ) : null}
    </div>
  );
}

function summarize(required: PlanCheckItem[], recommended: PlanCheckItem[]) {
  if (required.length === 0 && recommended.length === 0) {
    return "Nothing is missing from the plan.";
  }

  const parts = [
    required.length > 0 ? `${required.length} required` : null,
    recommended.length > 0 ? `${recommended.length} recommended` : null,
  ].filter(Boolean);

  return `${parts.join(" and ")} ${required.length + recommended.length === 1 ? "item" : "items"} to look at.`;
}
