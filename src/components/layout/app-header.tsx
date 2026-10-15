import { Link } from "@tanstack/react-router";
import { FolderIcon, InfinityIcon, PlugIcon } from "lucide-react";

import type { LiveStatus } from "#/hooks/use-live-updates";
import { cn } from "#/lib/utils";
import { Button } from "../ui/button";

/** The top bar on every page: Loop, and the project it was started in. */
export function AppHeader({ projectName, live }: { projectName: string; live: LiveStatus }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
            <InfinityIcon className="size-4" strokeWidth={2.5} />
          </span>
          Loop
        </Link>

        <span className="text-border" aria-hidden>
          /
        </span>

        <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <FolderIcon className="size-3.5 shrink-0" />
          <span className="truncate" title="The project Loop was started in">
            {projectName}
          </span>
        </span>

        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={
            <Link
              to="/connect"
              className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <PlugIcon className="size-3.5" />
              <span className="hidden sm:inline">Connect your agent</span>
            </Link>
          }
        />

        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          title={
            live === "live"
              ? "Changes the agent makes appear here as they happen"
              : "Not receiving changes; trying to reconnect"
          }
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              live === "live" ? "bg-status-completed" : "bg-muted-foreground/40",
            )}
          />
          {live === "live" ? "Live" : live === "reconnecting" ? "Reconnecting…" : "Connecting…"}
        </span>
      </div>
    </header>
  );
}
