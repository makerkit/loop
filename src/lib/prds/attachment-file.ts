import { isSafeRelativePath } from "./prd-paths";

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

/** Shown as text in the browser, never as a page. */
const TEXT_TYPES = new Set(["txt", "md", "markdown", "json", "csv", "log", "yaml", "yml"]);

export interface AttachmentKind {
  contentType: string;
  /** inline: shown in the tab (sandboxed); attachment: downloaded. */
  disposition: "inline" | "attachment";
  isImage: boolean;
}

/**
 * How an attachment is served, by extension. Images and plain text open in
 * the tab; everything else (PDF, HTML, archives...) is downloaded, so no file
 * can run as a page in Loop's origin. Pure, shared with the UI.
 */
export function attachmentKind(path: string): AttachmentKind {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const image = IMAGE_TYPES[extension];

  if (image) {
    return { contentType: image, disposition: "inline", isImage: true };
  }

  if (TEXT_TYPES.has(extension)) {
    return { contentType: "text/plain; charset=utf-8", disposition: "inline", isImage: false };
  }

  return { contentType: "application/octet-stream", disposition: "attachment", isImage: false };
}

export interface AttachmentFileDeps {
  /** Absolute path of the project's .prds folder. */
  prdsDir: string;
  /** Resolves symlinks; rejects when the file does not exist. */
  realpath(path: string): Promise<string>;
  /** `node:path` join and separator, so Windows paths work too. */
  join(...parts: string[]): string;
  sep: string;
}

export type AttachmentFile = ({ absolutePath: string } & AttachmentKind) | null;

/**
 * Finds the file for `/attachments/<folder>/<path>`, or null when it must not
 * be served: an unsafe path, a missing file, or a file that resolves (e.g.
 * through a symlink) outside the PRD's folder.
 */
export async function resolveAttachmentFile(
  request: { folder: string; path: string },
  deps: AttachmentFileDeps,
): Promise<AttachmentFile> {
  const { folder, path } = request;

  if (!isSafeRelativePath(folder) || folder.includes("/") || !isSafeRelativePath(path)) {
    return null;
  }

  try {
    const prdsDir = await deps.realpath(deps.prdsDir);
    const folderPath = await deps.realpath(deps.join(prdsDir, folder));
    const absolutePath = await deps.realpath(deps.join(folderPath, ...path.split("/")));

    // The folder itself must not be a symlink, and the file must stay inside it
    if (
      folderPath !== deps.join(prdsDir, folder) ||
      !absolutePath.startsWith(folderPath + deps.sep)
    ) {
      return null;
    }

    return { absolutePath, ...attachmentKind(path) };
  } catch {
    return null;
  }
}
