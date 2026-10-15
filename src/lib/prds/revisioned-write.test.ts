import { createPrdService, type StructuredPRD } from "@makerkit/prd";
import { describe, expect, it } from "vitest";

import { revisionedWrite, withNewQuestion, withoutQuestion } from "./revisioned-write";
import { PRDS_DIR, createMemoryDeps } from "./testing/memory-prd-deps";

const FILE = `${PRDS_DIR}/notes.json`;

function setup() {
  const { deps, fs } = createMemoryDeps({
    [FILE]: JSON.stringify({
      introduction: { title: "Notes", overview: "x" },
      openQuestions: ["Can notes be shared?"],
      edgeCases: [{ id: "EC001", case: "Empty note", status: "open" }],
      userStories: [
        {
          id: "US001",
          title: "Share",
          userStory: "",
          acceptanceCriteria: ["a", "b"],
          status: "not_started",
          priority: "P1",
        },
      ],
      metadata: { revision: 4 },
    }),
  });

  return {
    service: createPrdService(deps),
    read: () => JSON.parse(fs.get(FILE)!) as StructuredPRD,
  };
}

describe("answering the plan from Loop", () => {
  it("answers an open question into the decision log", async () => {
    const { service, read } = setup();

    expect(
      await revisionedWrite(() =>
        service.resolveOpenQuestion({
          filename: "notes.json",
          questionId: "Q001",
          answer: "Only with people in the same workspace",
          recordDecision: true,
          expectedRevision: 4,
        }),
      ),
    ).toEqual({ status: "saved" });
    expect(read().openQuestions).toEqual([]);
    expect(read().decisionLog.at(-1)).toMatchObject({
      decision: "Only with people in the same workspace",
      topic: "open-question:Q001",
    });
  });

  it("reports a conflict instead of answering an outdated question", async () => {
    const { service, read } = setup();

    expect(
      await revisionedWrite(() =>
        service.decideEdgeCase({
          filename: "notes.json",
          edgeCaseId: "EC001",
          expectedBehavior: "Not saved",
          expectedRevision: 3,
        }),
      ),
    ).toEqual({ status: "conflict" });
    expect(read().edgeCases?.[0]?.status ?? "open").toBe("open");
  });

  it("adds a question keeping the ids of the others", async () => {
    const { service, read } = setup();
    const { prd } = await service.get({ filename: "notes.json" });

    await service.updatePrdSection({
      filename: "notes.json",
      section: "openQuestions",
      value: withNewQuestion(prd.openQuestions, {
        question: " Who can delete a shared note? ",
        why: "",
        options: ["The owner", " ", "Anyone with access"],
        recommended: "The owner",
        storyIds: ["US001"],
      }),
      expectedRevision: 4,
    });

    expect(read().openQuestions).toEqual([
      { id: "Q001", question: "Can notes be shared?" },
      {
        id: "Q002",
        question: "Who can delete a shared note?",
        options: ["The owner", "Anyone with access"],
        recommended: "The owner",
        storyIds: ["US001"],
      },
    ]);
  });

  it("deletes a question without recording a decision", async () => {
    const { service, read } = setup();
    const { prd } = await service.get({ filename: "notes.json" });

    await service.updatePrdSection({
      filename: "notes.json",
      section: "openQuestions",
      value: withoutQuestion(prd.openQuestions, "Q001"),
      expectedRevision: 4,
    });

    expect(read().openQuestions).toEqual([]);
    expect(read().decisionLog ?? []).toEqual([]);
  });
});
