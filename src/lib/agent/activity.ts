import type { GitChangedFile } from "#/lib/git/git-status";

/**
 * When project files last changed: the best sign Loop has that an agent is
 * working (Loop never talks to the agent). Only uncommitted changes outside
 * .prds count. Pure apart from the injected file time lookup.
 */
export async function lastProjectChange(
  files: GitChangedFile[],
  modifiedAt: (path: string) => Promise<number | null>,
): Promise<number | null> {
  let latest: number | null = null;

  for (const file of files) {
    if (file.kind === "deleted" || file.path.startsWith(".prds/")) {
      continue;
    }

    const time = await modifiedAt(file.path);

    if (time !== null && (latest === null || time > latest)) {
      latest = time;
    }
  }

  return latest;
}

/** "just now", "40 s ago", "3 min ago", "2 h ago". */
export function timeAgo(then: number, now: number) {
  const seconds = Math.max(0, Math.round((now - then) / 1000));

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;

  return `${Math.round(seconds / 3600)} h ago`;
}
