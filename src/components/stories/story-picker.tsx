import { usePrdEdit } from "#/components/prds/prd-edit-context";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "#/components/ui/combobox";

import { StatusDot } from "./story-status";

/**
 * Pick stories of the current PRD by id or title, with autocomplete. The
 * value is a list of story ids, so it can only reference stories that exist.
 */
export function StoryPicker({
  value,
  onChange,
  id,
  ariaLabel,
  placeholder = "Search stories",
  exclude = [],
}: {
  /** Stories that cannot be picked, e.g. the story being edited. */
  exclude?: string[];
  value: string[];
  onChange: (storyIds: string[]) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const { prd } = usePrdEdit();
  const anchor = useComboboxAnchor();
  const stories = new Map(prd.userStories.map((story) => [story.id, story]));
  const label = (storyId: string) => {
    const story = stories.get(storyId);

    return story ? `${story.id} ${story.title}` : storyId;
  };

  return (
    <Combobox
      multiple
      autoHighlight
      items={prd.userStories.map((story) => story.id).filter((id) => !exclude.includes(id))}
      value={value}
      onValueChange={(next) => onChange(next as string[])}
      itemToStringLabel={label}
    >
      <ComboboxChips ref={anchor} className="bg-background">
        <ComboboxValue>
          {(selected: string[]) => (
            <>
              {selected.map((storyId) => (
                <ComboboxChip key={storyId} aria-label={label(storyId)}>
                  <span className="font-mono">{storyId}</span>
                  <span className="max-w-40 truncate font-normal text-muted-foreground">
                    {stories.get(storyId)?.title}
                  </span>
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                aria-label={ariaLabel}
                placeholder={selected.length > 0 ? "" : placeholder}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>

      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No matching stories.</ComboboxEmpty>
        <ComboboxList>
          {(storyId: string) => {
            const story = stories.get(storyId)!;

            return (
              <ComboboxItem key={storyId} value={storyId}>
                <StatusDot status={story.status} />
                <span className="font-mono text-xs text-muted-foreground">{story.id}</span>
                <span className="truncate">{story.title}</span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
