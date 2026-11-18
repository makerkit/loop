import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { CircleAlertIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { PrdList, PrdListEmpty, PrdListWarnings } from "#/components/prds/prd-list";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { NativeSelect, NativeSelectOption } from "#/components/ui/native-select";
import { Skeleton } from "#/components/ui/skeleton";
import { STAGE_LABELS } from "#/lib/prds/prd-overview";
import { getAgentSetupFn } from "#/lib/agents/agents.functions";
import { listPrds } from "#/lib/prds/prds.functions";

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

const ROADMAP_FILTERS = [
  ["plan", "Plan"],
  ["group", "Group"],
  ["section", "Section"],
  ["criticality", "Criticality"],
] as const;

const CRITICALITY_ORDER: readonly string[] = ["critical", "high", "medium", "low"];

type RoadmapFilters = Partial<Record<(typeof ROADMAP_FILTERS)[number][0], string>>;

function PrdsPage() {
  const { hasPrdsDir, prds, warnings, connectedAgents } = Route.useLoaderData();
  const [stage, setStage] = useState("");
  const [query, setQuery] = useState("");
  const [roadmap, setRoadmap] = useState<RoadmapFilters>({});
  const [sectionOrder, setSectionOrder] = useState<"roadmap" | "title">("roadmap");

  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const hasFilters = Boolean(terms.length || stage || Object.values(roadmap).some(Boolean));
  const shown = prds.filter((prd) => {
    const matchesStage =
      !stage || (stage === "waiting" ? prd.overview.waitingOnUser : prd.overview.stage === stage);
    const matchesRoadmap = ROADMAP_FILTERS.every(
      ([key]) => !roadmap[key] || (prd.roadmap?.[key] ?? "") === roadmap[key],
    );
    const searchable = [
      prd.title,
      prd.filename,
      prd.summary,
      prd.roadmap?.plan,
      prd.roadmap?.group,
      prd.roadmap?.section,
      prd.roadmap?.criticality,
    ]
      .join(" ")
      .toLowerCase();

    return matchesStage && matchesRoadmap && terms.every((term) => searchable.includes(term));
  });
  const hasSections = prds.some(
    ({ roadmap }) => roadmap?.plan || roadmap?.group || roadmap?.section,
  );

  function clearFilters() {
    setStage("");
    setQuery("");
    setRoadmap({});
  }

  return (
    <PrdsLayout>
      <PrdListWarnings warnings={warnings} />

      {prds.length > 0 ? (
        <>
          <div
            role="search"
            aria-label="Find PRDs"
            className="grid gap-3 rounded-xl border bg-card p-4 shadow-xs"
          >
            <div className="relative">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground"
              />
              <Input
                type="search"
                aria-label="Search PRDs"
                placeholder="Search PRDs"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                aria-label="Stage"
                value={stage}
                onChange={(event) => setStage(event.target.value)}
              >
                <NativeSelectOption value="">All stages</NativeSelectOption>
                <NativeSelectOption value="waiting">Waiting on you</NativeSelectOption>
                {Object.entries(STAGE_LABELS).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {ROADMAP_FILTERS.map(([key, label]) => {
                const values = new Set(
                  prds.flatMap((prd) => (prd.roadmap?.[key] ? [prd.roadmap[key]] : [])),
                );
                const selected = roadmap[key];

                // Keep a selected option visible if a live edit removes its last PRD.
                if (selected) values.add(selected);

                const options =
                  key === "criticality"
                    ? CRITICALITY_ORDER.filter((value) => values.has(value))
                    : [...values].sort((a, b) => a.localeCompare(b));

                if (options.length === 0) return null;

                return (
                  <NativeSelect
                    key={key}
                    aria-label={label}
                    className="min-w-0 max-w-full"
                    value={selected ?? ""}
                    onChange={(event) => setRoadmap({ ...roadmap, [key]: event.target.value })}
                  >
                    <NativeSelectOption value="">
                      {key === "criticality"
                        ? "Any criticality"
                        : "All " + label.toLowerCase() + "s"}
                    </NativeSelectOption>
                    {options.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {key === "criticality" ? value[0]?.toUpperCase() + value.slice(1) : value}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                );
              })}
              {hasSections ? (
                <NativeSelect
                  aria-label="Section order"
                  value={sectionOrder}
                  onChange={(event) =>
                    setSectionOrder(event.target.value === "title" ? "title" : "roadmap")
                  }
                >
                  <NativeSelectOption value="roadmap">Sections by roadmap order</NativeSelectOption>
                  <NativeSelectOption value="title">Sections A–Z</NativeSelectOption>
                </NativeSelect>
              ) : null}
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>
          {hasFilters ? (
            <p role="status" className="text-sm text-muted-foreground">
              {shown.length} of {prds.length} PRDs
            </p>
          ) : null}
          <PrdList
            prds={prds}
            visiblePrds={shown}
            sectionOrder={sectionOrder}
            filterKey={JSON.stringify([query, stage, roadmap])}
          />
          {!shown.length ? (
            <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              No PRDs match your search and filters.
            </p>
          ) : null}
        </>
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

function PrdsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="sr-only">PRDs</h1>
      {children}
    </main>
  );
}
