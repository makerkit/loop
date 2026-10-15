import { normalizePrd, splitUserStory as packageSplit } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { readStoryForm, splitUserStory, storyChanges, validateStoryForm } from "./story-edit";

const prd = normalizePrd(
  {
    userStories: [
      {
        id: "US001",
        title: "Save a note",
        userStory: "As a writer, I want to save notes so that I keep my ideas",
        businessValue: "I keep my ideas",
        acceptanceCriteria: ["Saves", "Works offline"],
        status: "not_started",
        priority: "P1",
        estimatedComplexity: "M",
        dependencies: [],
        testSeams: ["saveNote"],
        securityNotes: ["Only the owner can save"],
      },
    ],
    customPhases: [
      {
        id: "PHASE001",
        name: "MVP",
        description: "",
        color: "#000",
        order: 0,
        userStoryIds: ["US001"],
      },
    ],
  },
  "2026-10-15",
);
const story = prd.userStories[0]!;

describe("story form", () => {
  it("reads a story into form values", () => {
    expect(readStoryForm(story, prd)).toEqual({
      title: "Save a note",
      userType: "writer",
      action: "save notes",
      benefit: "I keep my ideas",
      acceptanceCriteria: "Saves\nWorks offline",
      testSeams: "saveNote",
      designNotes: "",
      securityNotes: "Only the owner can save",
      priority: "P1",
      estimatedComplexity: "M",
      dependencies: [],
      phaseId: "PHASE001",
    });
  });

  it("sends only what changed", () => {
    const original = readStoryForm(story, prd);

    expect(storyChanges(original, original)).toEqual({});
    expect(
      storyChanges(original, {
        ...original,
        title: " Save notes ",
        acceptanceCriteria: "Saves\n\nWorks offline\nSyncs",
        dependencies: ["US002"],
        phaseId: null,
      }),
    ).toEqual({
      title: "Save notes",
      acceptanceCriteria: ["Saves", "Works offline", "Syncs"],
      dependencies: ["US002"],
      phaseId: null,
    });
  });

  it("sends design and security notes as lists, and an emptied list as []", () => {
    const original = readStoryForm(story, prd);

    expect(
      storyChanges(original, {
        ...original,
        designNotes: "Save button in the toolbar\n\n",
        securityNotes: "  ",
      }),
    ).toEqual({ designNotes: ["Save button in the toolbar"], securityNotes: [] });
  });

  it("sends the three user story parts together", () => {
    const original = readStoryForm(story, prd);

    expect(storyChanges(original, { ...original, benefit: "nothing gets lost" })).toEqual({
      userType: "writer",
      action: "save notes",
      benefit: "nothing gets lost",
    });
  });

  it("validates before saving", () => {
    const original = readStoryForm(story, prd);

    expect(validateStoryForm(original)).toEqual({});
    expect(
      validateStoryForm({ ...original, title: " ", action: "", acceptanceCriteria: "\n" }),
    ).toEqual({
      title: "Title can't be empty.",
      userStory: "Fill in all three parts: who, what they want, and why.",
      acceptanceCriteria: "Add at least one acceptance criterion.",
    });
  });

  it("splits the user story like @makerkit/prd", () => {
    for (const sentence of [
      "As a writer, I want to save notes so that I keep my ideas",
      "As an admin, I want to invite people so that the team grows",
      "Not in the usual form",
    ]) {
      expect(splitUserStory(sentence)).toEqual(packageSplit(sentence));
    }
  });
});
