import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { AppHeader } from "#/components/layout/app-header";
import { useLiveUpdates } from "#/hooks/use-live-updates";
import { getProject } from "#/lib/project.functions";
import { SESSION_META_NAME, getPageSessionToken } from "#/lib/security/page-session-token";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Makerkit Loop",
      },
      {
        // Read by server function calls; see page-session-token.ts
        name: SESSION_META_NAME,
        content: getPageSessionToken(),
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  loader: () => getProject(),
  // Loaded once; the project does not change while Loop runs
  staleTime: Infinity,
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootLayout() {
  const project = Route.useLoaderData();
  const live = useLiveUpdates();

  return (
    <>
      <AppHeader projectName={project.name} live={live} />
      <Outlet />
    </>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
