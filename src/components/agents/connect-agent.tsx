import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlertIcon, CircleCheckIcon, PlugIcon } from "lucide-react";
import { useState } from "react";

import { CopyInstruction } from "#/components/copy-instruction";
import { Button } from "#/components/ui/button";
import type { AgentStatus, ServerCommand } from "#/lib/agents/agents";
import { applyAgentConfigFn, testAgentConnectionFn } from "#/lib/agents/agents.functions";
import { cn } from "#/lib/utils";

type TestResult = Awaited<ReturnType<typeof testAgentConnectionFn>>;

/** The PRD server Loop recommends for this project. */
export function ServerSummary({ server }: { server: ServerCommand }) {
  return (
    <div className="grid gap-1 rounded-xl border bg-card px-5 py-4 text-sm shadow-xs">
      <span className="font-medium">
        {server.kind === "kit"
          ? "This is a Makerkit kit: connect the kit's own MCP server. It includes the PRD tools."
          : "Connect the PRD MCP server (@makerkit/prd-mcp)."}
      </span>
      <code className="font-mono text-xs text-muted-foreground">
        {[server.command, ...server.args].join(" ")}
      </code>
      {server.needsBuild ? (
        <span className="text-amber-800 dark:text-amber-300">
          The kit's server is not built yet. Build it first:{" "}
          <code className="font-mono">{server.needsBuild}</code>
        </span>
      ) : null}
    </div>
  );
}

export function AgentCard({ agent }: { agent: AgentStatus }) {
  const router = useRouter();
  const apply = useServerFn(applyAgentConfigFn);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const canApply = agent.configFile !== null && !agent.cannotApply && agent.connected !== true;

  return (
    <section className="grid gap-3 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{agent.name}</h2>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
            agent.installed ? "bg-muted text-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {agent.installed ? "Installed" : "Not found on this machine"}
        </span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 text-sm",
            agent.connected === true
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-muted-foreground",
          )}
        >
          {agent.connected === true ? (
            <>
              <CircleCheckIcon className="size-4" /> Connected in {agent.configFile}
            </>
          ) : agent.connected === "unknown" ? (
            "Check with codex mcp list"
          ) : (
            "Not connected"
          )}
        </span>
      </div>

      {agent.connected === true ? null : (
        <>
          {canApply ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  try {
                    const result = await apply({
                      data: { agent: agent.id as "claude" | "opencode" },
                    });

                    setMessage(
                      result.ok
                        ? {
                            ok: true,
                            text: `Added to ${result.file}. Restart ${agent.name} in this project to load it${agent.id === "claude" ? " and approve the project server when asked" : ""}.`,
                          }
                        : { ok: false, text: result.reason },
                    );
                    await router.invalidate();
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {pending ? "Adding…" : `Add to ${agent.configFile}`}
              </Button>
              <span className="text-xs text-muted-foreground">Or run it yourself:</span>
            </div>
          ) : agent.cannotApply ? (
            <p className="text-sm text-muted-foreground">{agent.cannotApply} Run this instead:</p>
          ) : null}

          {agent.id === "opencode" ? (
            <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs">
              {agent.manual}
            </pre>
          ) : (
            <CopyInstruction instruction={agent.manual} />
          )}
        </>
      )}

      {message ? (
        <p
          role="status"
          className={cn(
            "text-sm",
            message.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive",
          )}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

export function TestConnection() {
  const test = useServerFn(testAgentConnectionFn);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  return (
    <section className="grid gap-3 rounded-xl border bg-card p-5 shadow-xs">
      <div className="grid gap-0.5">
        <h2 className="font-semibold">Check the connection</h2>
        <p className="text-sm text-muted-foreground">
          Starts the PRD server the way your agent will and lists its tools. It checks the setup; it
          cannot see inside your agent.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setResult(null);
          try {
            setResult(await test());
          } finally {
            setPending(false);
          }
        }}
      >
        <PlugIcon data-icon="inline-start" />
        {pending ? "Starting the server…" : "Check the connection"}
      </Button>

      {result ? (
        <div
          role="status"
          className={cn(
            "grid gap-1 rounded-lg border px-3 py-2 text-sm",
            result.result.ok && result.result.hasPrdTools
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200",
          )}
        >
          <span className="flex items-center gap-2 font-medium">
            {result.result.ok && result.result.hasPrdTools ? (
              <CircleCheckIcon className="size-4" />
            ) : (
              <CircleAlertIcon className="size-4" />
            )}
            {result.result.ok
              ? result.result.hasPrdTools
                ? `It works: the server answered with ${result.result.tools} tools, including the PRD tools.`
                : `The server answered, but without the PRD tools (${result.result.tools} tools).`
              : `It did not work: ${result.result.reason}`}
          </span>
          <code className="font-mono text-xs opacity-80">{result.command}</code>
        </div>
      ) : null}
    </section>
  );
}
