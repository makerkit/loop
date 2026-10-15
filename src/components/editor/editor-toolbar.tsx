import { $isLinkNode } from "@lexical/link";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  FORMAT_TEXT_COMMAND,
  KEY_MODIFIER_COMMAND,
  type TextFormatType,
} from "lexical";
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import type { MarkdownEditorMode } from "#/lib/markdown-editor/transformers";

import { LinkPopover, useLinkEditing } from "./link-popover";

interface ToolbarState {
  bold: boolean;
  italic: boolean;
  code: boolean;
  link: string | null;
  list: "bullet" | "number" | null;
}

const EMPTY_STATE: ToolbarState = {
  bold: false,
  italic: false,
  code: false,
  link: null,
  list: null,
};

const FORMATS: { format: TextFormatType; label: string; icon: LucideIcon }[] = [
  { format: "bold", label: "Bold", icon: BoldIcon },
  { format: "italic", label: "Italic", icon: ItalicIcon },
  { format: "code", label: "Code", icon: CodeIcon },
];

const LISTS = [
  {
    type: "bullet",
    label: "Bulleted list",
    icon: ListIcon,
    command: INSERT_UNORDERED_LIST_COMMAND,
  },
  {
    type: "number",
    label: "Numbered list",
    icon: ListOrderedIcon,
    command: INSERT_ORDERED_LIST_COMMAND,
  },
] as const;

/** The selection's formats, link and list, for the buttons' pressed state. */
function useToolbarState(): ToolbarState {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();

          if (!$isRangeSelection(selection)) {
            return;
          }

          const anchor = selection.anchor.getNode();
          const link = $findMatchingParent(anchor, $isLinkNode);
          const list = $findMatchingParent(anchor, $isListNode);
          const listType = list?.getListType();

          setState({
            bold: selection.hasFormat("bold"),
            italic: selection.hasFormat("italic"),
            code: selection.hasFormat("code"),
            link: link && $isLinkNode(link) ? link.getURL() : null,
            list: listType === "bullet" || listType === "number" ? listType : null,
          });
        });
      }),
    [editor],
  );

  return state;
}

/**
 * Formatting buttons for a Markdown editor. One tab stop (arrow keys move
 * between buttons), as in the WAI-ARIA toolbar pattern. Buttons don't take
 * focus on click, so the editor keeps its selection.
 */
export function EditorToolbar({ mode, label }: { mode: MarkdownEditorMode; label: string }) {
  const [editor] = useLexicalComposerContext();
  const state = useToolbarState();
  const linkEditing = useLinkEditing();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const { open: openLink } = linkEditing;

  // Cmd/Ctrl+K adds or edits a link
  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          KEY_MODIFIER_COMMAND,
          (event) => {
            if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) {
              return false;
            }

            event.preventDefault();
            openLink();

            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
      ),
    [editor, openLink],
  );

  function toggleList(type: "bullet" | "number", command: (typeof LISTS)[number]["command"]) {
    if (state.list === type) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(command, undefined);
    }
  }

  const buttons = [
    ...FORMATS.map(({ format, label: buttonLabel, icon }) => ({
      key: format,
      label: buttonLabel,
      icon,
      pressed: state[format as "bold" | "italic" | "code"],
      onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format),
    })),
    ...(mode === "text"
      ? LISTS.map(({ type, label: buttonLabel, icon, command }) => ({
          key: type,
          label: buttonLabel,
          icon,
          pressed: state.list === type,
          onClick: () => toggleList(type, command),
        }))
      : []),
  ];

  const linkIndex = buttons.length;
  const count = buttons.length + 1;

  function onKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowRight: (focusIndex + 1) % count,
      ArrowLeft: (focusIndex - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    const next = moves[event.key];

    if (next === undefined) {
      return;
    }

    event.preventDefault();
    setFocusIndex(next);
    toolbarRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={`Format ${label}`}
      onKeyDown={onKeyDown}
      className="flex items-center gap-0.5 border-b px-1 py-1"
    >
      {buttons.map(({ key, label: buttonLabel, icon: Icon, pressed, onClick }, index) => (
        <Button
          key={key}
          type="button"
          variant="ghost"
          size="icon-xs"
          title={buttonLabel}
          aria-label={buttonLabel}
          aria-pressed={pressed}
          tabIndex={index === focusIndex ? 0 : -1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
          className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
        >
          <Icon />
        </Button>
      ))}

      <LinkPopover
        editing={linkEditing}
        currentUrl={state.link}
        tabIndex={linkIndex === focusIndex ? 0 : -1}
        icon={<LinkIcon />}
      />
    </div>
  );
}
