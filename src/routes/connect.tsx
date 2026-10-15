import { createFileRoute } from "@tanstack/react-router";

import { AgentCard, ServerSummary, TestConnection } from "#/components/agents/connect-agent";
import { Skeleton } from "#/components/ui/skeleton";
import { getAgentSetupFn } from "#/lib/agents/agents.functions";

export const Route = createFileRoute("/connect")({
  loader: () => getAgentSetupFn(),
  head: () => ({ meta: [{ title: "Connect your agent · Loop" }] }),
  component: ConnectPage,
  pendingComponent: () => (
    <ConnectLayout>
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </ConnectLayout>
  ),
});

function ConnectPage() {
  const { server, agents } = Route.useLoaderData();

  return (
    <ConnectLayout>
      <ServerSummary server={server} />
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
      <TestConnection />
    </ConnectLayout>
  );
}

function ConnectLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-10 sm:px-6 sm:py-14">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Connect your agent</h1>
        <p className="text-sm text-muted-foreground">
          Give your coding agent the PRD tools, so it can plan with shape_prd and build with
          implement_story while Loop shows the progress.
        </p>
      </div>
      {children}
    </main>
  );
}
