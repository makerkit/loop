import { createFileRoute, notFound } from "@tanstack/react-router";

import { AskYourAgent } from "#/components/agent/ask-your-agent";
import { MissingAttachmentsProvider } from "#/components/prds/attachments";
import { DocumentToc } from "#/components/prds/document-toc";
import { PlanCheckPanel } from "#/components/prds/plan-check-panel";
import { PrdEditProvider } from "#/components/prds/prd-edit-context";
import { WaitingOnYouPanel, waitingCount } from "#/components/prds/waiting-on-you";
import { PrdDocument } from "#/components/prds/prd-document";
import {
  PrdPageError,
  PrdPageHeader,
  PrdPageLayout,
  PrdPageNotFound,
  PrdPagePending,
  prdPageTitle,
} from "#/components/prds/prd-page";
import { DOCUMENT_SECTIONS, getDocumentFlags } from "#/lib/prds/document-sections";
import { PrdFilenameSchema } from "#/lib/prds/prd-paths";
import { nextStep } from "#/lib/agent/next-step";
import { getNextStory, getPlanCheck, getPrd } from "#/lib/prds/prds.functions";

export const Route = createFileRoute("/prds/$filename")({
  loader: async ({ params }) => {
    // The server validates too; this only turns a malformed name into "not found"
    if (!PrdFilenameSchema.safeParse(params.filename).success) {
      throw notFound();
    }

    const data = { filename: params.filename };
    const [document, planCheck, next] = await Promise.all([
      getPrd({ data }),
      getPlanCheck({ data }),
      getNextStory({ data }),
    ]);

    return { ...document, planCheck, next };
  },
  head: ({ loaderData }) => ({ meta: [{ title: prdPageTitle(loaderData?.prd) }] }),
  component: PrdDocumentPage,
  pendingComponent: PrdPagePending,
  errorComponent: PrdPageError,
  notFoundComponent: PrdPageNotFound,
});

function PrdDocumentPage() {
  const { filename, prd, planCheck, next, missingAttachmentIds } = Route.useLoaderData();
  const flags = getDocumentFlags(prd, planCheck);

  return (
    <MissingAttachmentsProvider value={new Set(missingAttachmentIds)}>
      <PrdPageLayout header={<PrdPageHeader filename={filename} prd={prd} />}>
        <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] xl:gap-16">
          <aside className="hidden lg:block">
            <DocumentToc
              entries={DOCUMENT_SECTIONS.map(({ id, title }) => ({
                id,
                title,
                state: flags.sections[id] ?? { state: "empty" },
              }))}
              readyToBuild={planCheck.ready_to_build}
              planItemCount={planCheck.items.length}
              waitingCount={waitingCount(prd)}
            />
          </aside>

          <div className="grid max-w-3xl min-w-0 gap-10">
            <PrdEditProvider value={{ filename, prd }}>
              <WaitingOnYouPanel filename={filename} prd={prd} />
            </PrdEditProvider>
            <AskYourAgent filename={filename} step={nextStep(filename, prd, next, planCheck)} />
            <PlanCheckPanel check={planCheck} />
            <PrdDocument filename={filename} prd={prd} flags={flags} />
          </div>
        </div>
      </PrdPageLayout>
    </MissingAttachmentsProvider>
  );
}
