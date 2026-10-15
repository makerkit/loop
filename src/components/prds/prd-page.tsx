import type { StructuredPRD } from "@makerkit/prd";
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Progress } from "#/components/ui/progress";
import { Skeleton } from "#/components/ui/skeleton";

/** Layout, header and states shared by a PRD's pages (document, stories). */

export function PrdPageLayout({
  header,
  children,
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      {header}
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}

export function PrdPageHeader({ filename, prd }: { filename: string; prd: StructuredPRD }) {
  const { progress } = prd;

  return (
    <div className="border-b bg-background">
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 pt-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="grid min-w-0 gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {prd.introduction.title || filename}
            </h1>
            <p className="text-sm text-muted-foreground">
              Updated {prd.metadata.lastUpdated || prd.introduction.lastUpdated}
            </p>
          </div>

          {progress.total > 0 ? (
            <div className="grid w-full max-w-56 gap-1.5 sm:w-56">
              <div className="flex items-baseline justify-between text-xs text-muted-foreground tabular-nums">
                <span>
                  <span className="font-medium text-foreground">{progress.completed}</span> of{" "}
                  {progress.total} stories done
                </span>
                <span>{progress.overall}%</span>
              </div>
              <Progress value={progress.overall} aria-label="Stories completed" />
            </div>
          ) : null}
        </div>

        <nav aria-label="PRD views" className="-mb-px flex gap-4">
          <PrdTab to="/prds/$filename" filename={filename}>
            Document
          </PrdTab>
          <PrdTab to="/prds/$filename/stories" filename={filename}>
            Stories
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
              {prd.userStories.length}
            </span>
          </PrdTab>
        </nav>
      </div>
    </div>
  );
}

function PrdTab({
  to,
  filename,
  children,
}: {
  to: "/prds/$filename" | "/prds/$filename/stories";
  filename: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={{ filename }}
      activeOptions={{ exact: true, includeSearch: false }}
      className="flex items-center gap-1.5 border-b-2 border-transparent pt-1 pb-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
    >
      {children}
    </Link>
  );
}

export function PrdPagePending() {
  return (
    <PrdPageLayout
      header={
        <div className="border-b bg-background">
          <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 sm:px-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-2/3 max-w-md" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>
      }
    >
      <div className="grid gap-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </PrdPageLayout>
  );
}

export function PrdPageError({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <PrdPageLayout>
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Could not load this PRD</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Something went wrong."}
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => router.invalidate()}>
              Try again
            </Button>
          </AlertAction>
        </Alert>
      </div>
    </PrdPageLayout>
  );
}

export function PrdPageNotFound() {
  return (
    <PrdPageLayout>
      <div className="mx-auto max-w-2xl">
        <Alert>
          <CircleAlertIcon />
          <AlertTitle>PRD not found</AlertTitle>
          <AlertDescription>
            There is no PRD with this file name in .prds.{" "}
            <Link to="/" className="font-medium text-foreground underline underline-offset-4">
              See all PRDs
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    </PrdPageLayout>
  );
}

/** Page title for a PRD page. */
export function prdPageTitle(prd: StructuredPRD | undefined, view?: string) {
  return prd ? [prd.introduction.title, view, "Loop"].filter(Boolean).join(" · ") : "Loop";
}
