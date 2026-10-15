import { lazy, Suspense } from "react";

import type { MarkdownEditorMode } from "#/lib/markdown-editor/transformers";
import { cn } from "#/lib/utils";

import { CONTENT_CLASSES } from "./editor-theme";

export interface MarkdownEditorProps {
  /** `text`: block Markdown; `list`: one item per line; `inline`: one line. */
  mode: MarkdownEditorMode;
  /** The Markdown to load. Read once when the editor opens. */
  value: string;
  /** Called with the edited Markdown (for `list`, one item per line). */
  onChange: (markdown: string) => void;
  /** Put on the editable element; a `<label for={id}>` focuses it. */
  id?: string;
  /** The id of the visible label (a contenteditable can't use `<label for>`). */
  labelledBy?: string;
  /** Accessible name when there's no visible label. */
  ariaLabel?: string;
  /** Names the formatting toolbar, e.g. "Format Open questions". */
  name: string;
  placeholder?: string;
  invalid?: boolean;
}

// Lexical loads only when an editor is shown: never during SSR, and not in the
// document view's bundle
const LexicalMarkdownEditor = lazy(() => import("./lexical-markdown-editor"));

/** A Markdown editor with formatting buttons and Markdown shortcuts. */
export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <Suspense fallback={<EditorFallback mode={props.mode} />}>
      <LexicalMarkdownEditor {...props} />
    </Suspense>
  );
}

/** Same size as the editor while it loads, so the form doesn't jump. */
function EditorFallback({ mode }: { mode: MarkdownEditorMode }) {
  return (
    <div aria-hidden className="w-full rounded-lg border border-input dark:bg-input/30">
      <div className="h-[33px] border-b" />
      <div className={cn(CONTENT_CLASSES[mode])} />
    </div>
  );
}
