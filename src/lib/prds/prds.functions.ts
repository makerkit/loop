import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { listProjectPrds } from "./list-project-prds";
import { NOT_APPLICABLE_TOPICS, markNotApplicable } from "./not-applicable";
import { PrdFilenameSchema } from "./prd-paths";
import { revisionedWrite, withNewQuestion, withoutQuestion } from "./revisioned-write";
import { EDITABLE_SECTIONS } from "./section-edits";
import { updateSection } from "./update-section";
import { missingAttachments } from "./attachments.server";
import { getPrdService, prdFileExists, prdsDirExists } from "./project.server";

/** The PRDs in the project's .prds folder. Takes no input from the browser. */
export const listPrds = createServerFn({ method: "GET" }).handler(() =>
  listProjectPrds({
    prdsDirExists,
    listPrds: () => getPrdService().list(),
    loadPrd: async (filename) => {
      const service = getPrdService();
      const [{ prd }, check] = await Promise.all([
        service.get({ filename }),
        service.checkPlan(filename),
      ]);

      return { prd, check };
    },
  }),
);

/** One PRD, read through PrdService. The absolute file path is not sent. */
export const getPrd = createServerFn({ method: "GET" })
  .validator(z.object({ filename: PrdFilenameSchema }))
  .handler(async ({ data }) => {
    if (!(await prdFileExists(data.filename))) {
      throw notFound();
    }

    const { filename, prd } = await getPrdService().get({ filename: data.filename });

    return {
      filename,
      prd,
      missingAttachmentIds: await missingAttachments(filename, prd.attachments),
    };
  });

/** What the plan is still missing (check_plan), and whether it is ready to build. */
export const getPlanCheck = createServerFn({ method: "GET" })
  .validator(z.object({ filename: PrdFilenameSchema }))
  .handler(async ({ data }) => {
    if (!(await prdFileExists(data.filename))) {
      throw notFound();
    }

    return getPrdService().checkPlan(data.filename);
  });

/**
 * Changes one section through PrdService (update_prd_section rules). The
 * write is rejected when the PRD changed after the user loaded it.
 */
export const updatePrdSection = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: PrdFilenameSchema,
      section: z.enum(EDITABLE_SECTIONS),
      value: z.unknown(),
      expectedRevision: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await prdFileExists(data.filename))) {
      throw notFound();
    }

    return updateSection(getPrdService(), data);
  });

/** The next ready story, stories in progress, and what waiting stories wait for. */
export const getNextStory = createServerFn({ method: "GET" })
  .validator(z.object({ filename: PrdFilenameSchema }))
  .handler(async ({ data }) => {
    if (!(await prdFileExists(data.filename))) {
      throw notFound();
    }

    return getPrdService().getNextStory(data.filename);
  });

/** Marks an optional part of the PRD (not) applicable, based on the revision the user loaded. */
export const setNotApplicable = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: PrdFilenameSchema,
      topic: z.enum(NOT_APPLICABLE_TOPICS),
      notApplicable: z.boolean(),
      reason: z.string().max(500).optional(),
      expectedRevision: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await prdFileExists(data.filename))) {
      throw notFound();
    }

    return markNotApplicable(getPrdService(), data);
  });

/** Answers an open question; the answer is recorded as a decision. */
export const answerOpenQuestion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: PrdFilenameSchema,
      questionId: z.string().regex(/^Q\d+$/),
      answer: z.string().trim().min(1).max(2000),
      expectedRevision: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await prdFileExists(data.filename))) {
      throw notFound();
    }

    return revisionedWrite(() =>
      getPrdService().resolveOpenQuestion({ ...data, recordDecision: true }),
    );
  });

/** Decides an open edge case: what should happen. */
export const decideOpenEdgeCase = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: PrdFilenameSchema,
      edgeCaseId: z.string().regex(/^EC\d+$/),
      expectedBehavior: z.string().trim().min(1).max(2000),
      expectedRevision: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await prdFileExists(data.filename))) {
      throw notFound();
    }

    return revisionedWrite(() => getPrdService().decideEdgeCase(data));
  });

/** Adds an open question, keeping the others as they are. */
export const addOpenQuestion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: PrdFilenameSchema,
      question: z.string().trim().min(1).max(1000),
      why: z.string().max(2000).optional(),
      options: z.array(z.string().max(500)).max(10).optional(),
      recommended: z.string().max(500).optional(),
      storyIds: z
        .array(z.string().regex(/^US\d+$/))
        .max(50)
        .optional(),
      expectedRevision: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await prdFileExists(data.filename))) {
      throw notFound();
    }

    const service = getPrdService();
    const { prd } = await service.get({ filename: data.filename });

    return revisionedWrite(() =>
      service.updatePrdSection({
        filename: data.filename,
        section: "openQuestions",
        value: withNewQuestion(prd.openQuestions, data),
        expectedRevision: data.expectedRevision,
      }),
    );
  });

/** Deletes an open question without answering it (no decision is recorded). */
export const deleteOpenQuestion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: PrdFilenameSchema,
      questionId: z.string().regex(/^Q\d+$/),
      expectedRevision: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await prdFileExists(data.filename))) {
      throw notFound();
    }

    const service = getPrdService();
    const { prd } = await service.get({ filename: data.filename });

    return revisionedWrite(() =>
      service.updatePrdSection({
        filename: data.filename,
        section: "openQuestions",
        value: withoutQuestion(prd.openQuestions, data.questionId),
        expectedRevision: data.expectedRevision,
      }),
    );
  });
