import { createFileRoute, notFound, useLocation, useNavigate } from "@tanstack/react-router";
import { ListTodoIcon } from "lucide-react";

import {
  PrdPageError,
  PrdPageHeader,
  PrdPageLayout,
  PrdPageNotFound,
  PrdPagePending,
  prdPageTitle,
} from "#/components/prds/prd-page";
import { PrdEditProvider } from "#/components/prds/prd-edit-context";
import { AskYourAgent } from "#/components/agent/ask-your-agent";
import { MissingAttachmentsProvider } from "#/components/prds/attachments";
import { StoryBoard } from "#/components/stories/story-board";
import { StoryDetails } from "#/components/stories/story-details";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty";
import { Sheet, SheetContent } from "#/components/ui/sheet";
import { PrdFilenameSchema } from "#/lib/prds/prd-paths";
import { nextStep } from "#/lib/agent/next-step";
import { getNextStory, getPlanCheck, getPrd } from "#/lib/prds/prds.functions";
import { buildStoryBoard } from "#/lib/prds/story-board";

export const Route = createFileRoute("/prds/$filename_/stories")({
  // `?story=US001` opens that story; `&edit=1` opens it in the editor. The
  // board opens a story at a step (send back, reopen) through history state.
  validateSearch: (search: Record<string, unknown>): { story?: string; edit?: boolean } =>
    typeof search.story === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(search.story)
      ? {
          story: search.story,
          ...(search.edit === 1 || search.edit === "1" || search.edit === true
            ? { edit: true }
            : {}),
        }
      : {},
  loader: async ({ params }) => {
    if (!PrdFilenameSchema.safeParse(params.filename).success) {
      throw notFound();
    }

    const data = { filename: params.filename };
    const [document, next, planCheck] = await Promise.all([
      getPrd({ data }),
      getNextStory({ data }),
      getPlanCheck({ data }),
    ]);

    return { ...document, next, planCheck };
  },
  head: ({ loaderData }) => ({ meta: [{ title: prdPageTitle(loaderData?.prd, "Stories") }] }),
  component: StoriesPage,
  pendingComponent: PrdPagePending,
  errorComponent: PrdPageError,
  notFoundComponent: PrdPageNotFound,
});

function StoriesPage() {
  const { filename, prd, next, planCheck, missingAttachmentIds } = Route.useLoaderData();
  const { story: storyId, edit } = Route.useSearch();
  const step = useLocation({ select: (location) => location.state.step });
  const navigate = useNavigate({ from: Route.fullPath });

  const columns = buildStoryBoard(prd, next);
  const openStory = prd.userStories.find((story) => story.id === storyId);
  // Same rule as the board's cards (and PrdService): dependencies not completed
  const waitingOn =
    columns
      .flatMap((column) => column.groups.flatMap((group) => group.items))
      .find((card) => card.story.id === storyId)?.waitingOn ?? [];

  return (
    <MissingAttachmentsProvider value={new Set(missingAttachmentIds)}>
      <PrdEditProvider value={{ filename, prd }}>
        <PrdPageLayout header={<PrdPageHeader filename={filename} prd={prd} />}>
          {prd.userStories.length === 0 ? (
            <Empty className="rounded-xl border bg-card py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListTodoIcon />
                </EmptyMedia>
                <EmptyTitle>No stories yet</EmptyTitle>
                <EmptyDescription>
                  Stories are added while planning the PRD with your agent (shape_prd).
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-6">
              <AskYourAgent filename={filename} step={nextStep(filename, prd, next, planCheck)} />
              <StoryBoard filename={filename} columns={columns} />
            </div>
          )}

          <Sheet
            open={Boolean(openStory)}
            onOpenChange={(open) => {
              if (!open) {
                void navigate({ search: {}, resetScroll: false });
              }
            }}
          >
            <SheetContent className="w-full gap-0 sm:max-w-lg data-[side=right]:sm:max-w-lg">
              {openStory ? (
                <StoryDetails
                  key={openStory.id}
                  filename={filename}
                  prd={prd}
                  story={openStory}
                  waitingOn={waitingOn}
                  startEditing={edit === true}
                  startStep={step}
                />
              ) : null}
            </SheetContent>
          </Sheet>
        </PrdPageLayout>
      </PrdEditProvider>
    </MissingAttachmentsProvider>
  );
}
