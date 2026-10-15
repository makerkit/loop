import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { CircleAlertIcon } from "lucide-react";
import { useState } from "react";

import { PrdList, PrdListEmpty, PrdListWarnings } from "#/components/prds/prd-list";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { STAGE_LABELS, type PrdStage } from "#/lib/prds/prd-overview";
import { getAgentSetupFn } from "#/lib/agents/agents.functions";
import { listPrds } from "#/lib/prds/prds.functions";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/")({
  loader: async () => {
    const list = await listPrds();
    // Only for the first-run steps: is an agent connected yet? A hint, so a
    // failure (an unreadable agent config) must not break the page
    const setup = list.prds.length === 0 ? await getAgentSetupFn().catch(() => null) : null;
    const connectedAgents =
      setup?.agents.filter((agent) => agent.connected === true).map((agent) => agent.name) ?? [];

    return { ...list, connectedAgents };
  },
  component: PrdsPage,
  pendingComponent: PrdsPending,
  errorComponent: PrdsError,
});

type Filter = "all" | "waiting" | PrdStage;

function PrdsPage() {
  const { hasPrdsDir, prds, warnings, connectedAgents } = Route.useLoaderData();
  const [filter, setFilter] = useState<Filter>("all");

  const waiting = prds.filter((prd) => prd.overview.waitingOnUser).length;
  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all" as Filter, label: "All", count: prds.length },
    { id: "waiting" as Filter, label: "Waiting on you", count: waiting },
    ...(Object.keys(STAGE_LABELS) as PrdStage[]).map((stage) => ({
      id: stage as Filter,
      label: STAGE_LABELS[stage],
      count: prds.filter((prd) => prd.overview.stage === stage).length,
    })),
  ].filter((option) => option.id === "all" || option.count > 0);

  const shown = prds.filter((prd) =>
    filter === "all"
      ? true
      : filter === "waiting"
        ? prd.overview.waitingOnUser
        : prd.overview.stage === filter,
  );

  return (
    <PrdsLayout
      summary={
        prds.length > 0
          ? `${prds.length} ${prds.length === 1 ? "PRD" : "PRDs"}${waiting > 0 ? ` · ${waiting} waiting on you` : ""}`
          : undefined
      }
    >
      <PrdListWarnings warnings={warnings} />

      {prds.length > 1 ? (
        <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-2">
          {filters.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border bg-background px-3 text-sm transition-colors hover:bg-muted",
                filter === option.id &&
                  "border-foreground bg-foreground text-background hover:bg-foreground",
              )}
            >
              {option.label}
              <span className="text-xs opacity-70 tabular-nums">{option.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {prds.length > 0 ? (
        <PrdList prds={shown} />
      ) : (
        <PrdListEmpty hasPrdsDir={hasPrdsDir} connectedAgents={connectedAgents} />
      )}
    </PrdsLayout>
  );
}

function PrdsPending() {
  return (
    <PrdsLayout>
      <Skeleton className="h-36 w-full rounded-xl" />
    </PrdsLayout>
  );
}

function PrdsError({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <PrdsLayout>
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Could not load the PRDs</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Something went wrong."}
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => router.invalidate()}>
            Try again
          </Button>
        </AlertAction>
      </Alert>
    </PrdsLayout>
  );
}

function PrdsLayout({ summary, children }: { summary?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">PRDs</h1>
        <p className="text-sm text-muted-foreground">
          {summary ?? "The plans in this project's .prds folder."}
        </p>
      </div>
      {children}
    </main>
  );
}
