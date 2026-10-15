/**
 * Parses `git status --porcelain=v1 -z --untracked-files=all`. Ported from
 * the desktop app's git-status-parser, switched to -z so paths with spaces,
 * quotes or arrows are read exactly. Pure.
 */

export type GitChangeKind =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflict";

export interface GitChangedFile {
  path: string;
  /** For renames and copies: the path it came from. */
  previousPath?: string;
  kind: GitChangeKind;
  /** Whether part of the change is already staged. */
  staged: boolean;
}

const CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

function kindOf(code: string): GitChangeKind | null {
  switch (code) {
    case "A":
      return "added";
    case "M":
    case "T":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    default:
      return null;
  }
}

export function parseGitStatus(output: string): GitChangedFile[] {
  const fields = output.split("\0");
  const files: GitChangedFile[] = [];

  for (let index = 0; index < fields.length; index++) {
    const entry = fields[index]!;

    if (entry.length < 4) {
      continue;
    }

    const x = entry[0]!;
    const y = entry[1]!;
    const path = entry.slice(3);

    if (x === "?" && y === "?") {
      files.push({ path, kind: "untracked", staged: false });
      continue;
    }

    if (x === "!" && y === "!") {
      continue;
    }

    if (CONFLICT_CODES.has(`${x}${y}`)) {
      files.push({ path, kind: "conflict", staged: false });
      continue;
    }

    // Renames and copies are followed by the original path as its own field
    const previousPath = x === "R" || x === "C" ? fields[++index] : undefined;
    const kind = kindOf(x !== " " ? x : y) ?? "modified";

    files.push({
      path,
      ...(previousPath ? { previousPath } : {}),
      kind,
      staged: x !== " ",
    });
  }

  return files;
}
