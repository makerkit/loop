import {
  incompleteDependencies,
  type GetNextStoryOutput,
  type StoryStatus,
  type StructuredPRD,
  type UserStory,
} from "@makerkit/prd";

export interface PhaseGroup<T> {
  id: string;
  name: string;
  items: T[];
}

export const UNPHASED_ID = "unphased";

/**
 * Stories grouped by phase in build order (phase `order`, then the phase's own
 * story order), with stories in no phase last. Empty groups are left out.
 */
export function groupStoriesByPhase<T = UserStory>(
  prd: StructuredPRD,
  toItem: (story: UserStory) => T | null = (story) => story as T,
): PhaseGroup<T>[] {
  const stories = new Map(prd.userStories.map((story) => [story.id, story]));
  const placed = new Set<string>();
  const collect = (story: UserStory | undefined) => {
    if (!story || placed.has(story.id)) {
      return [];
    }

    placed.add(story.id);
    const item = toItem(story);

    return item === null ? [] : [item];
  };

  const phases = [...prd.customPhases]
    .sort((a, b) => a.order - b.order)
    .map((phase) => ({
      id: phase.id,
      name: phase.name,
      items: phase.userStoryIds.flatMap((id) => collect(stories.get(id))),
    }));

  const unphased = {
    id: UNPHASED_ID,
    name: "Not in a phase",
    items: prd.userStories.flatMap((story) => collect(story)),
  };

  return [...phases, unphased].filter((group) => group.items.length > 0);
}

export interface BoardCard {
  story: UserStory;
  /** The story get_next_story would pick. */
  isNext: boolean;
  /** Dependencies not completed yet: the story cannot be worked on until they are. */
  waitingOn: string[];
}

export interface BoardColumn {
  status: StoryStatus;
  label: string;
  count: number;
  groups: PhaseGroup<BoardCard>[];
  /** Shown only with stories in it, or as a drop target while dragging. */
  hideWhenEmpty: boolean;
}

const COLUMNS: Array<{ status: StoryStatus; label: string; hideWhenEmpty?: boolean }> = [
  { status: "not_started", label: "Not started" },
  { status: "research", label: "Research", hideWhenEmpty: true },
  { status: "in_progress", label: "In progress" },
  { status: "review", label: "Review" },
  { status: "blocked", label: "Blocked", hideWhenEmpty: true },
  { status: "completed", label: "Completed" },
];

export const STATUS_LABELS = Object.fromEntries(
  COLUMNS.map((column) => [column.status, column.label]),
) as Record<StoryStatus, string>;

/** The stories as board columns by status, each grouped by phase in build order. */
export function buildStoryBoard(prd: StructuredPRD, next: GetNextStoryOutput): BoardColumn[] {
  return COLUMNS.map((column) => {
    const groups = groupStoriesByPhase(prd, (story) =>
      story.status === column.status
        ? {
            story,
            isNext: story.id === next.story?.id,
            // Completed stays completed when a dependency is reopened: nothing to wait for
            waitingOn: story.status === "completed" ? [] : incompleteDependencies(prd, story),
          }
        : null,
    );

    const count = groups.reduce((total, group) => total + group.items.length, 0);

    return {
      status: column.status,
      label: column.label,
      count,
      groups,
      hideWhenEmpty: column.hideWhenEmpty ?? false,
    };
  });
}

/**
 * The columns to show: all but the empty optional ones, unless `keep` asks for
 * them (a column the dragged story can be dropped on).
 */
export function visibleColumns(
  columns: BoardColumn[],
  keep: (status: StoryStatus) => boolean = () => false,
) {
  return columns.filter(
    (column) => column.count > 0 || !column.hideWhenEmpty || keep(column.status),
  );
}
