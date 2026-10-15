import { LexicalComposer, type InitialConfigType } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";

import { toSafeLinkUrl } from "#/lib/markdown-editor/safe-link";
import { nodesFor, transformersFor } from "#/lib/markdown-editor/transformers";
import { cn } from "#/lib/utils";

import {
  editorNamespace,
  ItemKeysPlugin,
  LabelFocusPlugin,
  MarkdownPastePlugin,
  MarkdownSyncPlugin,
} from "./editor-plugins";
import { CONTENT_CLASSES, PLACEHOLDER_CLASSES, themeFor } from "./editor-theme";
import { EditorToolbar } from "./editor-toolbar";
import type { MarkdownEditorProps } from "./markdown-editor";

const isSafeUrl = (url: string) => toSafeLinkUrl(url) !== null;

/**
 * The Lexical editor behind `MarkdownEditor`. Loaded lazily; import
 * `MarkdownEditor` instead. Follows formtoro's LexicalInlineEditor setup
 * (LexicalComposer + RichTextPlugin + HistoryPlugin + LinkPlugin, a theme of
 * classes, plugins as small components), with Markdown in and out.
 */
export default function LexicalMarkdownEditor({
  mode,
  value,
  onChange,
  id,
  labelledBy,
  ariaLabel,
  name,
  placeholder,
  invalid,
}: MarkdownEditorProps) {
  const initialConfig: InitialConfigType = {
    namespace: editorNamespace(mode),
    nodes: nodesFor(mode),
    theme: themeFor(mode),
    // The content is loaded by MarkdownSyncPlugin, after the guards are set up
    editorState: null,
    onError: (error) => console.error("Editor error:", error),
  };

  const placeholderProps = placeholder
    ? {
        "aria-placeholder": placeholder,
        placeholder: (
          <div
            className={cn(
              "pointer-events-none absolute text-muted-foreground select-none",
              PLACEHOLDER_CLASSES[mode],
            )}
          >
            {placeholder}
          </div>
        ),
      }
    : {};

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        data-slot="markdown-editor"
        className="w-full min-w-0 rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-3 has-[[aria-invalid=true]]:ring-destructive/20 dark:bg-input/30 dark:has-[[aria-invalid=true]]:border-destructive/50 dark:has-[[aria-invalid=true]]:ring-destructive/40"
      >
        <EditorToolbar mode={mode} label={name} />

        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                id={id}
                ariaLabelledBy={labelledBy}
                ariaLabel={ariaLabel}
                ariaInvalid={invalid ? true : undefined}
                ariaMultiline={mode !== "inline"}
                className={cn("outline-none", CONTENT_CLASSES[mode])}
                {...placeholderProps}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>

      <HistoryPlugin />
      <LinkPlugin validateUrl={isSafeUrl} />
      {mode === "text" ? <ListPlugin /> : <ItemKeysPlugin mode={mode} />}
      <MarkdownShortcutPlugin transformers={transformersFor(mode)} />
      <MarkdownPastePlugin mode={mode} />
      <MarkdownSyncPlugin mode={mode} value={value} onChange={onChange} />
      {id ? <LabelFocusPlugin id={id} /> : null}
    </LexicalComposer>
  );
}
