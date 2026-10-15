import { $isCodeNode } from "@lexical/code-core";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  HISTORY_MERGE_TAG,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
  PASTE_COMMAND,
} from "lexical";
import { useEffect, useEffectEvent, useLayoutEffect, useState } from "react";

import {
  $exportMarkdown,
  $importMarkdown,
  $markdownNodesFromPaste,
} from "#/lib/markdown-editor/convert";
import { registerMarkdownGuards } from "#/lib/markdown-editor/guards";
import type { MarkdownEditorMode } from "#/lib/markdown-editor/transformers";

/**
 * Loads the Markdown value into the editor and reports changes as Markdown.
 *
 * The guards are registered before the value is loaded, so loaded content
 * goes through them too. If the content still exports to what it exported to
 * when loaded, the original value is reported, so opening and saving a field
 * without changing it never rewrites it (e.g. adding or removing escapes).
 */
export function MarkdownSyncPlugin({
  mode,
  value,
  onChange,
}: {
  mode: MarkdownEditorMode;
  value: string;
  onChange: (markdown: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  // The editor is uncontrolled: only the value it was opened with is loaded
  const [initialValue] = useState(value);
  const emit = useEffectEvent((markdown: string) => onChange(markdown));

  useLayoutEffect(() => {
    const unregisterGuards = registerMarkdownGuards(editor, mode);

    // Merged into history, so undo can't go back to an empty editor
    editor.update(() => $importMarkdown(mode, initialValue), {
      discrete: true,
      tag: HISTORY_MERGE_TAG,
    });

    const baseline = editor.getEditorState().read(() => $exportMarkdown(mode));
    let last = initialValue;

    const unregisterListener = editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
          return;
        }

        const markdown = editorState.read(() => $exportMarkdown(mode));
        const next = markdown === baseline ? initialValue : markdown;

        if (next !== last) {
          last = next;
          emit(next);
        }
      },
    );

    return mergeRegister(unregisterGuards, unregisterListener);
  }, [editor, mode, initialValue]);

  return null;
}

/** The Lexical namespace for an editor mode; clipboard content is shared only within one. */
export function editorNamespace(mode: MarkdownEditorMode): string {
  return `loop-markdown-${mode}`;
}

const LEXICAL_CLIPBOARD = "application/x-lexical-editor";

/** Whether the clipboard holds Lexical content Lexical itself will paste (same namespace). */
function isOwnLexicalContent(data: DataTransfer, mode: MarkdownEditorMode): boolean {
  if (!data.types.includes(LEXICAL_CLIPBOARD)) {
    return false;
  }

  try {
    const payload: unknown = JSON.parse(data.getData(LEXICAL_CLIPBOARD));

    return (
      typeof payload === "object" &&
      payload !== null &&
      "namespace" in payload &&
      payload.namespace === editorNamespace(mode)
    );
  } catch {
    return false;
  }
}

/**
 * Pasted text is read as Markdown from the clipboard's plain text, never its
 * HTML. Content copied from an editor of the same mode (Lexical's own format)
 * is pasted as is; the guards still apply to it.
 */
export function MarkdownPastePlugin({ mode }: { mode: MarkdownEditorMode }) {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const data =
            "clipboardData" in event
              ? event.clipboardData
              : "dataTransfer" in event
                ? event.dataTransfer
                : null;

          if (data && isOwnLexicalContent(data, mode)) {
            return false;
          }

          event.preventDefault();

          if (!data) {
            return true;
          }

          const text = data.getData("text/plain");

          editor.update(() => {
            const selection = $getSelection();

            if (!$isRangeSelection(selection) || text === "") {
              return;
            }

            if ($findMatchingParent(selection.anchor.getNode(), $isCodeNode)) {
              selection.insertRawText(text);
            } else {
              selection.insertNodes($markdownNodesFromPaste(mode, text));
            }
          });

          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, mode],
  );

  return null;
}

/**
 * Keys for item editors: in a list, Enter and Shift+Enter both start a new
 * item; in a one-line field, they do nothing. Neither can add a line break.
 */
export function ItemKeysPlugin({ mode }: { mode: "list" | "inline" }) {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          INSERT_LINE_BREAK_COMMAND,
          () => {
            if (mode === "list") {
              editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
            }

            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        editor.registerCommand(
          KEY_ENTER_COMMAND,
          (event) => {
            if (mode === "list") {
              return false;
            }

            event?.preventDefault();

            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        // Backspace in an empty first item removes it (Lexical already does
        // this for the other items, by joining them with the one before)
        editor.registerCommand(
          KEY_BACKSPACE_COMMAND,
          (event) => {
            const selection = $getSelection();

            if (mode !== "list" || !$isRangeSelection(selection) || !selection.isCollapsed()) {
              return false;
            }

            const item = selection.anchor.getNode().getTopLevelElement();
            const next = item?.getNextSibling();

            if (!item || !item.isEmpty() || item.getPreviousSibling() || !next) {
              return false;
            }

            event.preventDefault();
            item.remove();
            next.selectStart();

            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
      ),
    [editor, mode],
  );

  return null;
}

/** Clicking the field's `<label for=id>` focuses the editor (a contenteditable isn't labelable). */
export function LabelFocusPlugin({ id }: { id: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const labels = [
      ...document.querySelectorAll<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`),
    ];
    const focus = () => editor.focus();

    for (const label of labels) {
      label.addEventListener("click", focus);
    }

    return () => {
      for (const label of labels) {
        label.removeEventListener("click", focus);
      }
    };
  }, [editor, id]);

  return null;
}
