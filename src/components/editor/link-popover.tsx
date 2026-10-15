import { $createLinkNode, $isLinkNode, $toggleLink } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent } from "@lexical/utils";
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  type BaseSelection,
} from "lexical";
import { useCallback, useId, useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { parseLinkInput } from "#/lib/markdown-editor/safe-link";

/**
 * Link editing state. Focus moves to the URL field while it's open, so the
 * editor's selection is saved on open and restored before the link is
 * applied (as formtoro's `use-link-input-buffer` does).
 */
export function useLinkEditing() {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const selectionRef = useRef<BaseSelection | null>(null);

  const open = useCallback(() => {
    selectionRef.current = editor.getEditorState().read(() => $getSelection()?.clone() ?? null);
    setIsOpen(true);
  }, [editor]);

  const close = useCallback(() => {
    setIsOpen(false);
    selectionRef.current = null;
  }, []);

  /** Runs `change` on the saved selection, then returns focus to the editor. */
  const applyToSelection = useCallback(
    (change: () => void) => {
      const saved = selectionRef.current;

      editor.update(() => {
        if (saved) {
          $setSelection(saved.clone());
        }

        change();
      });

      close();
      editor.focus();
    },
    [editor, close],
  );

  return { isOpen, open, close, applyToSelection };
}

type LinkEditing = ReturnType<typeof useLinkEditing>;

/** The link button and its URL field. Only http(s) URLs are accepted. */
export function LinkPopover({
  editing,
  currentUrl,
  tabIndex,
  icon,
}: {
  editing: LinkEditing;
  currentUrl: string | null;
  tabIndex: number;
  icon: React.ReactNode;
}) {
  const { isOpen, open, close, applyToSelection } = editing;
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  function onOpenChange(next: boolean) {
    if (next) {
      setInput(currentUrl ?? "");
      setError(null);
      open();
    } else {
      close();
    }
  }

  function apply() {
    const url = parseLinkInput(input);

    if (!url) {
      setError("Enter a web address starting with http:// or https://");

      return;
    }

    applyToSelection(() => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection)) {
        return;
      }

      const inLink = $findMatchingParent(selection.anchor.getNode(), $isLinkNode);

      if (selection.isCollapsed() && !inLink) {
        // Nothing selected: insert the address itself as the link text
        selection.insertNodes([$createLinkNode(url).append($createTextNode(url))]);
      } else {
        $toggleLink(url);
      }
    });
  }

  function remove() {
    applyToSelection(() => $toggleLink(null));
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Link"
            aria-label="Link"
            aria-pressed={currentUrl !== null}
            tabIndex={tabIndex}
            onMouseDown={(event) => event.preventDefault()}
            className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
          />
        }
      >
        {icon}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80">
        <label htmlFor={inputId} className="text-xs font-medium">
          Link address
        </label>
        <Input
          id={inputId}
          value={input}
          placeholder="https://example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setInput(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            // The popover is inside the section's form: never submit it
            if (event.key === "Enter") {
              event.preventDefault();
              apply();
            }
          }}
        />
        {error ? (
          <p id={errorId} className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={apply}>
            {currentUrl ? "Update link" : "Add link"}
          </Button>
          {currentUrl ? (
            <Button type="button" size="sm" variant="outline" onClick={remove}>
              Remove link
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
