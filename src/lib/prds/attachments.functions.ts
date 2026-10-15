import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { MAX_UPLOAD_BYTES } from "./attachment-upload";
import { deleteUploadedFile, saveUploadedFile } from "./attachments.server";
import { PrdFilenameSchema } from "./prd-paths";
import { getPrdService, prdFileExists } from "./project.server";
import { revisionedWrite } from "./revisioned-write";

type AttachmentWriteResult =
  | { status: "saved" }
  | { status: "conflict" }
  | { status: "invalid"; message: string };

const StoryIds = z.array(z.string().regex(/^US\d+$/)).max(100);
const Revision = z.number().int().min(0);

async function ensurePrd(filename: string) {
  if (!(await prdFileExists(filename))) {
    throw notFound();
  }
}

/** Revision conflicts are results; other PrdService errors become messages to show. */
async function write(run: () => Promise<unknown>): Promise<AttachmentWriteResult> {
  try {
    return await revisionedWrite(run);
  } catch (error) {
    return {
      status: "invalid",
      message: error instanceof Error ? error.message : "Could not save.",
    };
  }
}

const UploadFields = z.object({
  filename: PrdFilenameSchema,
  title: z.string().trim().min(1).max(200),
  note: z.string().max(1000).optional(),
  storyIds: StoryIds,
  expectedRevision: Revision,
});

/** Uploads a file into the PRD's folder and records it as an attachment. */
export const uploadAttachment = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected a form upload.");
    }

    const file = data.get("file");

    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose a file to upload.");
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
    }

    return {
      file,
      ...UploadFields.parse({
        filename: data.get("filename"),
        title: data.get("title"),
        note: data.get("note") || undefined,
        storyIds: JSON.parse(String(data.get("storyIds") ?? "[]")),
        expectedRevision: Number(data.get("expectedRevision")),
      }),
    };
  })
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    const name = await saveUploadedFile(
      data.filename,
      data.file.name,
      new Uint8Array(await data.file.arrayBuffer()),
    );

    const result = await write(() =>
      getPrdService().addAttachment({
        filename: data.filename,
        title: data.title,
        path: name,
        ...(data.note?.trim() ? { note: data.note.trim() } : {}),
        storyIds: data.storyIds,
        expectedRevision: data.expectedRevision,
      }),
    );

    // Not recorded (e.g. the PRD changed meanwhile): do not leave the file behind
    if (result.status !== "saved") {
      await deleteUploadedFile(data.filename, name);
    }

    return result;
  });

/** Records a link (http or https) as an attachment. */
export const addAttachmentLink = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: PrdFilenameSchema,
      title: z.string().trim().min(1).max(200),
      url: z
        .string()
        .trim()
        .url()
        .refine((url) => /^https?:\/\//i.test(url), "Only http and https links can be attached."),
      note: z.string().max(1000).optional(),
      storyIds: StoryIds,
      expectedRevision: Revision,
    }),
  )
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return write(() =>
      getPrdService().addAttachment({
        filename: data.filename,
        title: data.title,
        url: data.url,
        ...(data.note?.trim() ? { note: data.note.trim() } : {}),
        storyIds: data.storyIds,
        expectedRevision: data.expectedRevision,
      }),
    );
  });

/** Changes an attachment's title, note or the stories that use it. */
export const editAttachment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: PrdFilenameSchema,
      attachmentId: z.string().regex(/^ATT\d+$/),
      title: z.string().trim().min(1).max(200),
      note: z.string().max(1000),
      storyIds: StoryIds,
      expectedRevision: Revision,
    }),
  )
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return write(() => getPrdService().updateAttachment(data));
  });

/** Removes an attachment and its story links; the file stays on disk. */
export const removeAttachmentFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: PrdFilenameSchema,
      attachmentId: z.string().regex(/^ATT\d+$/),
      expectedRevision: Revision,
    }),
  )
  .handler(async ({ data }) => {
    await ensurePrd(data.filename);

    return write(() => getPrdService().removeAttachment(data));
  });
