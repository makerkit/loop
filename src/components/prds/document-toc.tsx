import { BanIcon, CheckIcon, CircleAlertIcon, CircleCheckIcon, HourglassIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { SectionState } from "#/lib/prds/document-sections";
import { cn } from "#/lib/utils";

export interface TocEntry {
  id: string;
  title: string;
  state: SectionState;
}

/**
 * The document's sections, with the one being read highlighted, and the plan
 * check status at the top. Sticky on wide screens.
 */
export function DocumentToc({
  entries,
  readyToBuild,
  planItemCount,
  waitingCount,
}: {
  entries: TocEntry[];
  readyToBuild: boolean;
  planItemCount: number;
  /** Open questions, open edge cases and stories to review. */
  waitingCount: number;
}) {
  const active = useActiveSection(entries.map((entry) => entry.id));

  return (
    <nav aria-label="On this page" className="sticky top-20 grid gap-5 text-sm">
      {waitingCount > 0 ? (
        <a
          href="#waiting-on-you"
          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 shadow-xs transition-colors hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <HourglassIcon className="size-4" />
          <span className="grid">
            <span className="font-medium">Waiting on you</span>
            <span className="text-xs opacity-80">
              {waitingCount} {waitingCount === 1 ? "thing needs" : "things need"} you
            </span>
          </span>
        </a>
      ) : null}

      <a
        href="#plan-check"
        className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-xs transition-colors hover:bg-muted/50"
      >
        {readyToBuild ? (
          <CircleCheckIcon className="size-4 text-status-completed" />
        ) : (
          <CircleAlertIcon className="size-4 text-destructive" />
        )}
        <span className="grid">
          <span className="font-medium">{readyToBuild ? "Ready to build" : "Not ready"}</span>
          <span className="text-xs text-muted-foreground">
            {planItemCount === 0
              ? "Nothing missing"
              : `${planItemCount} ${planItemCount === 1 ? "item" : "items"} to look at`}
          </span>
        </span>
      </a>

      <div className="grid gap-1">
        <span className="px-3 text-xs font-medium text-muted-foreground">On this page</span>
        <ul className="grid border-l">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                aria-current={active === entry.id ? "location" : undefined}
                className={cn(
                  "-ml-px flex items-center gap-2 border-l-2 border-transparent py-1 pr-2 pl-3 text-muted-foreground transition-colors hover:text-foreground",
                  active === entry.id && "border-foreground font-medium text-foreground",
                )}
              >
                <SectionStateIcon state={entry.state} />
                <span className="flex-1">{entry.title}</span>
                {entry.state.state === "na" ? (
                  <span className="text-[11px] font-medium text-muted-foreground">N/A</span>
                ) : null}
                {entry.state.state === "issues" ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] font-medium tabular-nums",
                      entry.state.required
                        ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
                    )}
                  >
                    {entry.state.count}
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function SectionStateIcon({ state }: { state: SectionState }) {
  if (state.state === "na") {
    return (
      <BanIcon aria-label="Not applicable" className="size-3 shrink-0 text-muted-foreground/70" />
    );
  }

  if (state.state === "done") {
    return <CheckIcon aria-label="Written" className="size-3.5 shrink-0 text-status-completed" />;
  }

  if (state.state === "issues") {
    return (
      <span
        aria-label="Needs attention"
        className={cn(
          "size-3 shrink-0 rounded-full border-2",
          state.required ? "border-status-blocked" : "border-status-review",
        )}
      />
    );
  }

  return (
    <span
      aria-label="Not written yet"
      className="size-3 shrink-0 rounded-full border border-dashed border-muted-foreground/50"
    />
  );
}

/** The id of the section nearest the top of the viewport. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    const elements = key
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) {
      return;
    }

    const update = () => {
      // The last section whose top has passed the line under the top bar
      const line = 120;
      let current = elements[0]!.id;

      for (const element of elements) {
        if (element.getBoundingClientRect().top <= line) {
          current = element.id;
        }
      }

      setActive(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });

    return () => window.removeEventListener("scroll", update);
  }, [key]);

  return active;
}
