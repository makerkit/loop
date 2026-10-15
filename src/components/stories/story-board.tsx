import type { StoryStatus } from "@makerkit/prd";
import { Link, useNavigate } from "@tanstack/react-router";
import { HourglassIcon } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";

import { visibleColumns, type BoardCard, type BoardColumn } from "#/lib/prds/story-board";
import { dropOn, noDropReason, type StoryStep } from "#/lib/stories/moves";
import { cn } from "#/lib/utils";

import { MoveStoryMenu } from "./move-story-menu";
import { StatusDot } from "./story-status";
import { useMoveStory } from "./use-move-story";

/**
 * The stories as columns by status, grouped by phase in build order. Stories
 * can be dragged to the columns a person may move them to (the same moves as
 * the card's menu, which stays for keyboard and touch).
 */
export function StoryBoard({ filename, columns }: { filename: string; columns: BoardColumn[] }) {
  const navigate = useNavigate();
  const { moveTo, pending, error } = useMoveStory();
  const [drag, setDrag] = useState<{ id: string; status: StoryStatus } | null>(null);
  const [over, setOver] = useState<StoryStatus | null>(null);
  const dragging = useRef(false);

  // The board reloads live while the agent works. If the dragged story
  // changed status (or was deleted) mid-drag, the drag no longer counts:
  // its card may have unmounted, so dragend never reaches React.
  const dragged = drag
    ? columns
        .flatMap((column) => column.groups.flatMap((group) => group.items))
        .find((card) => card.story.id === drag.id && card.story.status === drag.status)
    : undefined;

  const dropAction = (status: StoryStatus) =>
    dragged ? dropOn(dragged.story.status, status, dragged.waitingOn) : null;
  const canDrop = (status: StoryStatus) => dropAction(status) !== null;

  function endDrag() {
    dragging.current = false;
    setDrag(null);
    setOver(null);
  }

  useEffect(() => {
    if (!drag) {
      return;
    }

    window.addEventListener("dragend", endDrag);
    window.addEventListener("drop", endDrag);

    return () => {
      window.removeEventListener("dragend", endDrag);
      window.removeEventListener("drop", endDrag);
    };
  }, [drag]);

  function openStory(storyId: string, step?: StoryStep) {
    void navigate({
      to: "/prds/$filename/stories",
      params: { filename },
      search: { story: storyId },
      // History state, not the URL: a shared or reloaded link opens the story plainly
      state: (previous) => ({ ...previous, step }),
      resetScroll: false,
    });
  }

  function dragOver(event: DragEvent, status: StoryStatus) {
    if (!canDrop(status)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(status);
  }

  function drop(event: DragEvent, status: StoryStatus) {
    event.preventDefault();

    const story = dragged?.story;
    const action = dropAction(status);

    endDrag();

    if (!story || !action) {
      return;
    }

    if (action.kind === "open") {
      openStory(story.id, action.step);

      return;
    }

    void moveTo(story.id, action.to);
  }

  return (
    <div className="grid gap-2">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        <div className="grid gap-4 md:flex md:min-w-max md:items-start xl:min-w-0">
          {visibleColumns(columns, canDrop).map((column) => {
            const target = canDrop(column.status);
            const reason =
              dragged && !target && dragged.story.status !== column.status
                ? noDropReason(column.status, dragged.waitingOn)
                : null;

            return (
              <section
                key={column.status}
                aria-label={column.label}
                onDragOver={(event) => dragOver(event, column.status)}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setOver((current) => (current === column.status ? null : current));
                  }
                }}
                onDrop={(event) => drop(event, column.status)}
                className={cn(
                  "relative grid content-start gap-3 rounded-xl bg-muted/60 p-2 outline-2 -outline-offset-2 outline-transparent transition-[opacity,outline-color] md:w-72 md:shrink-0 xl:w-auto xl:min-w-60 xl:flex-1",
                  target && "outline-dashed outline-brand/40",
                  over === column.status && "bg-brand/10 outline-solid outline-brand",
                  dragged && !target && dragged.story.status !== column.status && "opacity-50",
                )}
              >
                <h2 className="flex items-center gap-2 px-1.5 pt-1 text-sm font-medium">
                  <StatusDot status={column.status} />
                  {column.label}
                  <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                    {column.count}
                  </span>
                </h2>

                {/* Over the column, so it does not push cards around mid-drag */}
                {reason ? (
                  <p className="absolute inset-x-2 top-10 z-10 rounded-md border bg-background px-2 py-1.5 text-center text-xs text-muted-foreground shadow-xs">
                    {reason}
                  </p>
                ) : null}

                {column.count === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    No stories
                  </p>
                ) : (
                  column.groups.map((group) => (
                    <div key={group.id} className="grid gap-1.5">
                      <h3 className="px-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        {group.name}
                      </h3>
                      <ul className="grid gap-1.5">
                        {group.items.map((card) => (
                          <li
                            key={card.story.id}
                            draggable={!pending}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", card.story.id);
                              const { id, status } = card.story;

                              // After the browser captures the drag image, so
                              // the dimmed card and new columns are not in it
                              dragging.current = true;
                              requestAnimationFrame(() => {
                                if (dragging.current) {
                                  setDrag({ id, status });
                                }
                              });
                            }}
                            onDragEnd={endDrag}
                            className={cn(
                              "group/card relative",
                              dragged?.story.id === card.story.id && "opacity-40",
                            )}
                          >
                            <StoryCard filename={filename} card={card} />
                            {/* Outside the card link, so opening the menu does not open the story */}
                            <MoveStoryMenu
                              story={card.story}
                              waitingOn={card.waitingOn}
                              onStep={(step) => openStory(card.story.id, step)}
                              className="absolute top-2 right-2 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/card:opacity-100 [@media(hover:hover)]:group-hover/card:opacity-100"
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StoryCard({ filename, card }: { filename: string; card: BoardCard }) {
  const { story, isNext, waitingOn } = card;

  return (
    <Link
      // The list item is the drag source, not the link (no URL drag)
      draggable={false}
      to="/prds/$filename/stories"
      params={{ filename }}
      search={{ story: story.id }}
      resetScroll={false}
      className={cn(
        "grid gap-2 rounded-lg border bg-card p-3 shadow-xs transition-shadow hover:shadow-md",
        isNext && "border-brand ring-2 ring-brand/15",
      )}
    >
      {isNext ? (
        <span className="text-[11px] font-semibold tracking-wider text-brand uppercase">
          Next up
        </span>
      ) : null}

      <span className="text-sm leading-snug font-medium">{story.title}</span>

      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-mono">{story.id}</span>
        <span className="rounded border px-1 leading-4">{story.priority}</span>
        {waitingOn.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <HourglassIcon className="size-3" />
            Waits for {waitingOn.join(", ")}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
