/** Rules for files uploaded as attachments. Pure, shared by server and UI. */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * A safe file name for an upload: the base name only (no folders), lowercase
 * letters, digits, dots, dashes and underscores, never hidden, extension kept.
 */
export function safeUploadName(original: string) {
  const base = original.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    // Runs of separators collapse to one, keeping a dot if there was one
    .replace(/[-._]{2,}/g, (run) => (run.includes(".") ? "." : run[0]!))
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 80);
  const extension =
    dot > 0
      ? base
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 10)
      : "";

  return `${stem || "attachment"}${extension ? `.${extension}` : ""}`;
}

/** `name`, or `name-2`, `name-3`... so an upload never replaces an existing file. */
export function uniqueName(name: string, taken: (candidate: string) => boolean) {
  if (!taken(name)) {
    return name;
  }

  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";

  for (let index = 2; index < 1000; index++) {
    const candidate = `${stem}-${index}${extension}`;

    if (!taken(candidate)) {
      return candidate;
    }
  }

  throw new Error("Too many files with this name.");
}

/** A title from the file name, e.g. "approve-view mockup.png" -> "Approve view mockup". */
export function titleFromFileName(name: string) {
  const stem = name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return stem ? stem.charAt(0).toUpperCase() + stem.slice(1) : "Attachment";
}
