import { createHeadlessEditor } from "@lexical/headless";
import { $getRoot, $getSelection, $isRangeSelection, type LexicalEditor } from "lexical";

import { $exportMarkdown, $importMarkdown, $markdownNodesFromPaste } from "./convert";
import { registerMarkdownGuards } from "./guards";
import { nodesFor, type MarkdownEditorMode } from "./transformers";

/** A headless editor set up like the real one: same nodes, transformers and guards. */
export function createTestEditor(mode: MarkdownEditorMode, value = ""): LexicalEditor {
  const editor = createHeadlessEditor({
    nodes: nodesFor(mode),
    onError: (error) => {
      throw error;
    },
  });

  registerMarkdownGuards(editor, mode);
  editor.update(() => $importMarkdown(mode, value), { discrete: true });

  return editor;
}

export function exportFrom(editor: LexicalEditor, mode: MarkdownEditorMode): string {
  return editor.getEditorState().read(() => $exportMarkdown(mode));
}

/** Markdown → editor → Markdown. */
export function roundTrip(mode: MarkdownEditorMode, value: string): string {
  return exportFrom(createTestEditor(mode, value), mode);
}

/** Pastes plain text at the end of the editor's content, as the paste handler does. */
export function pasteInto(editor: LexicalEditor, mode: MarkdownEditorMode, text: string): void {
  editor.update(
    () => {
      $getRoot().selectEnd();
      const selection = $getSelection();

      if ($isRangeSelection(selection)) {
        selection.insertNodes($markdownNodesFromPaste(mode, text));
      }
    },
    { discrete: true },
  );
}
