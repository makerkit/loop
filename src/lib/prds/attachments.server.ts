import { existsSync } from "node:fs";
import { mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";

import { resolveAttachmentFile } from "./attachment-file";
import { safeUploadName, uniqueName } from "./attachment-upload";
import { getPrdsDir } from "./project.server";

/** The response for `/attachments/<folder>/<path>`. Server only. */
export async function serveAttachment(folder: string, path: string) {
  const file = await resolveAttachmentFile(
    { folder, path },
    { prdsDir: getPrdsDir(), realpath, join, sep },
  );

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  const name = path.split("/").pop() ?? "attachment";

  return new Response(new Uint8Array(await readFile(file.absolutePath)), {
    headers: {
      "content-type": file.contentType,
      "x-content-type-options": "nosniff",
      // A file opened directly (e.g. an SVG) must not run scripts in Loop's origin
      "content-security-policy":
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "content-disposition": `${file.disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "no-store",
    },
  });
}

/**
 * Which of a PRD's file attachments are actually there (and inside its
 * folder), so the view can show missing ones as missing. Server only.
 */
export async function missingAttachments(
  filename: string,
  attachments: Array<{ id: string; path?: string }>,
) {
  const folder = filename.replace(/\.json$/, "");
  const missing: string[] = [];

  for (const attachment of attachments) {
    if (!attachment.path) {
      continue;
    }

    const file = await resolveAttachmentFile(
      { folder, path: attachment.path },
      { prdsDir: getPrdsDir(), realpath, join, sep },
    );

    if (!file) {
      missing.push(attachment.id);
    }
  }

  return missing;
}

/**
 * Saves an uploaded file in the PRD's folder (.prds/<prd name>/) under a
 * safe, unused name and returns that name. Never overwrites a file, and
 * refuses a PRD folder that is a symlink. Server only.
 */
export async function saveUploadedFile(filename: string, originalName: string, bytes: Uint8Array) {
  const folderName = filename.replace(/\.json$/, "");
  const prdsDir = await realpath(getPrdsDir());
  const folder = join(prdsDir, folderName);

  await mkdir(folder, { recursive: true });

  if ((await realpath(folder)) !== folder) {
    throw new Error("The PRD's folder is a link; Loop only writes into a real folder.");
  }

  const chosen = uniqueName(safeUploadName(originalName), (candidate) =>
    existsSync(join(folder, candidate)),
  );

  // "wx": fail rather than replace a file created in the meantime
  await writeFile(join(folder, chosen), bytes, { flag: "wx" });

  return chosen;
}

/** Removes a file Loop just saved, when recording it in the PRD failed. Server only. */
export async function deleteUploadedFile(filename: string, name: string) {
  const folder = join(await realpath(getPrdsDir()), filename.replace(/\.json$/, ""));

  await unlink(join(folder, name)).catch(() => undefined);
}
