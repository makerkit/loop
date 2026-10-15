import { z } from "zod";

/**
 * Rules for names and paths that come from the browser or from PRD text.
 * Pure, so the client (Markdown rendering) and the server (serving files)
 * apply the same checks.
 */

/** A PRD file name inside .prds: a bare `<name>.json`, never a path. */
export const PrdFilenameSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/, "Invalid PRD file name")
  .refine((name) => !name.includes(".."), "Invalid PRD file name");

/**
 * A path relative to a PRD's attachments folder, e.g. `mockups/a.png`:
 * no absolute paths, no `..`, no backslashes, no empty or hidden segments.
 * Mirrors `assertSafeRelativePath` in @makerkit/prd.
 */
export function isSafeRelativePath(path: string) {
  if (path.length === 0 || path.includes("\\") || /^[a-zA-Z]:/.test(path)) {
    return false;
  }

  return path.split("/").every((segment) => segment.length > 0 && !segment.startsWith("."));
}

export function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/** `notes.json` keeps its files in `.prds/notes/`. Same rule as @makerkit/prd. */
export function attachmentsFolderName(filename: string) {
  return filename.replace(/\.json$/, "");
}

/** The URL Loop serves an attachment file at. */
export function attachmentUrl(filename: string, path: string) {
  const segments = path.split("/").map(encodeURIComponent).join("/");

  return `/attachments/${encodeURIComponent(attachmentsFolderName(filename))}/${segments}`;
}

/**
 * Where a Markdown image in a PRD may load from: only the PRD's attachments
 * folder. `src` is a path relative to that folder (`mockups/a.png`), or the
 * same path from the project root (`.prds/notes/mockups/a.png`). Anything
 * else (remote URLs, data: URLs, paths leaving the folder) returns null.
 */
export function resolveImageSrc(src: string, filename: string) {
  let path = src.trim();

  try {
    path = decodeURI(path);
  } catch {
    return null;
  }

  const projectPrefix = `.prds/${attachmentsFolderName(filename)}/`;

  if (path.startsWith(projectPrefix)) {
    path = path.slice(projectPrefix.length);
  } else if (path.startsWith("./")) {
    path = path.slice(2);
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || !isSafeRelativePath(path)) {
    return null;
  }

  return attachmentUrl(filename, path);
}
