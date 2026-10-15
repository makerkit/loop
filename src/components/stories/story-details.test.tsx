import { normalizePrd } from "@makerkit/prd";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PrdEditProvider } from "#/components/prds/prd-edit-context";
import { Sheet } from "#/components/ui/sheet";

import { StoryDetails } from "./story-details";

const prd = normalizePrd(
  {
    introduction: { title: "Notes", overview: "" },
    userStories: [
      {
        id: "US001",
        title: "Save a note",
        userStory: "As a writer, I want to save notes",
        acceptanceCriteria: ["Saves **instantly**", "Works offline"],
        status: "review",
        priority: "P1",
        dependencies: ["US002"],
        testSeams: ["saveNote service"],
        log: [
          { at: "2026-10-14T08:00:00Z", whatsNew: ["First try"], technicalNotes: [] },
          {
            at: "2026-10-15T09:30:00Z",
            whatsNew: ["You can save a note"],
            technicalNotes: ["See notes.service.ts"],
            deviations: ["Used IndexedDB instead of localStorage"],
          },
        ],
      },
      {
        id: "US002",
        title: "Storage",
        userStory: "",
        acceptanceCriteria: [],
        status: "completed",
        priority: "P1",
      },
    ],
  },
  "2026-10-15",
);

// Links need a router; an empty one is enough to render them
const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory(),
});

function render() {
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <PrdEditProvider value={{ filename: "notes.json", prd }}>
        <Sheet open>
          <StoryDetails
            filename="notes.json"
            prd={prd}
            story={prd.userStories[0]!}
            waitingOn={[]}
          />
        </Sheet>
      </PrdEditProvider>
    </RouterContextProvider>,
  );
}

describe("StoryDetails", () => {
  it("offers to add a file or link to the story", () => {
    const html = render();

    expect(html).toContain("Add a file");
    expect(html).toContain("Add a link");
  });

  it("shows acceptance criteria, test seams and dependencies", () => {
    const html = render();

    expect(html).toContain("Save a note");
    expect(html).toContain("<strong>instantly</strong>");
    expect(html).toContain("saveNote service");
    expect(html).toContain("Storage");
    expect(html).toContain("Completed");
  });

  it("shows the log newest first, with deviations called out", () => {
    const html = render();

    expect(html).toContain("Deviations from the plan");
    expect(html).toContain("Used IndexedDB instead of localStorage");
    expect(html.indexOf("You can save a note")).toBeLessThan(html.indexOf("First try"));
    expect(html).toContain("2026-10-15 09:30 UTC");
    expect(html).toContain("Technical notes (1)");
  });

  it("starts a story in review with the review: deviations first, then the files to commit", () => {
    const html = render();

    expect(html).toContain("Approve story");
    expect(html).toContain("Send back");
    expect(html.indexOf("The agent recorded 1 deviation")).toBeGreaterThan(-1);
    expect(html.indexOf("The agent recorded 1 deviation")).toBeLessThan(
      html.indexOf("Files to commit"),
    );
  });
});
