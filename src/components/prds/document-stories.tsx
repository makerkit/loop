import type { StructuredPRD, UserStory } from "@makerkit/prd";
import { Link } from "@tanstack/react-router";

import { Markdown } from "#/components/markdown";
import { StoryStatusBadge } from "#/components/stories/story-status";
import { storyAnchor } from "#/lib/prds/plan-check-targets";
import { groupStoriesByPhase } from "#/lib/prds/story-board";

import { StoryFlags } from "./document-flags";
import { BulletList, SUBSECTION_TITLE_CLASS } from "./document-parts";

/** The PRD's stories as a read-only list, grouped by phase in build order. */
export function DocumentStories({ filename, prd }: { filename: string; prd: StructuredPRD }) {
  const groups = groupStoriesByPhase(prd);

  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <div key={group.id} className="grid gap-2">
          {groups.length > 1 ? <h3 className={SUBSECTION_TITLE_CLASS}>{group.name}</h3> : null}

          <ul className="divide-y rounded-lg border">
            {group.items.map((story) => (
              <li key={story.id}>
                <DocumentStory filename={filename} story={story} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function DocumentStory({ filename, story }: { filename: string; story: UserStory }) {
  return (
    <div id={storyAnchor(story.id)} className="group/story grid gap-2 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/prds/$filename/stories"
          params={{ filename }}
          search={{ story: story.id }}
          className="grid gap-0.5 hover:underline"
        >
          <span className="font-mono text-xs text-muted-foreground">{story.id}</span>
          <span className="text-[15px] font-medium">{story.title}</span>
        </Link>
        <span className="flex items-center gap-1">
          {story.status !== "completed" ? (
            <Link
              to="/prds/$filename/stories"
              params={{ filename }}
              search={{ story: story.id, edit: true }}
              className="text-xs text-muted-foreground opacity-100 hover:text-foreground [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/story:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
            >
              Edit
            </Link>
          ) : null}
          <StoryStatusBadge status={story.status} />
        </span>
      </div>

      <StoryFlags storyId={story.id} />

      {story.userStory ? (
        <p className="text-sm leading-6 text-muted-foreground">
          <Markdown text={story.userStory} inline />
        </p>
      ) : null}

      {story.acceptanceCriteria.length > 0 ? (
        <BulletList items={story.acceptanceCriteria} className="text-sm leading-6" />
      ) : (
        <p className="text-sm text-muted-foreground italic">No acceptance criteria yet.</p>
      )}
    </div>
  );
}
