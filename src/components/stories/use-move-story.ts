import { useServerFn } from "@tanstack/react-start";

import { usePrdWrite } from "#/components/prds/use-prd-write";
import type { ManualMove } from "#/lib/stories/moves";
import { moveStory } from "#/lib/stories/stories.functions";

/** Moves a story to a status a person may set (board menu and drag and drop). */
export function useMoveStory() {
  const move = useServerFn(moveStory);
  const { run, pending, error } = usePrdWrite();

  const moveTo = (storyId: string, to: ManualMove) =>
    run(async (base) => {
      const result = await move({ data: { ...base, storyId, to } });

      if (result.status === "refused") {
        throw new Error(result.message);
      }

      return result.status === "conflict" ? { status: "conflict" } : { status: "saved" };
    });

  return { moveTo, pending, error };
}
