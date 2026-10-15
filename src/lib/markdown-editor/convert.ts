import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  $generateNodesFromMarkdownString,
} from "@lexical/markdown";
import {
  $createParagraphNode,
  $getRoot,
  $isElementNode,
  type LexicalNode,
  type ParagraphNode,
} from "lexical";

import { finishEscapes, prepareImport } from "./text-escapes";
import { transformersFor, type MarkdownEditorMode } from "./transformers";

/**
 * Markdown in and out of a Lexical editor. Call inside `editor.update` (import)
 * or `editor.read` / `editorState.read` (export).
 *
 * - `text`: the value is block Markdown.
 * - `list`: the value has one item per line (as in `readEditValues`); each
 *   item is a paragraph of inline Markdown.
 * - `inline`: the value is one line of inline Markdown.
 */
export function $importMarkdown(mode: MarkdownEditorMode, value: string): void {
  const root = $getRoot();
  const markdown = prepareImport(value);

  if (mode === "text") {
    $convertFromMarkdownString(markdown, transformersFor(mode), root);

    return;
  }

  const lines = mode === "list" ? markdown.split(/\r?\n/) : [markdown.replace(/\s*\r?\n\s*/g, " ")];
  const items = lines.map((line) => line.trim()).filter((line) => line.length > 0);

  root.clear();

  for (const item of items) {
    root.append($inlineParagraph(mode, item));
  }

  if (root.isEmpty()) {
    root.append($createParagraphNode());
  }
}

export function $exportMarkdown(mode: MarkdownEditorMode): string {
  const markdown = finishEscapes($convertToMarkdownString(transformersFor(mode)));

  if (mode === "text") {
    return markdown;
  }

  // Items never contain line breaks (see registerMarkdownGuards), so every
  // line of the export is one item; blank lines are empty items.
  const items = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return mode === "list" ? items.join("\n") : items.join(" ");
}

/**
 * Inserts pasted plain text as Markdown at the selection. Returns the nodes to
 * insert: blocks in `text` mode, one paragraph per line in `list` mode, and a
 * single paragraph in `inline` mode.
 */
export function $markdownNodesFromPaste(mode: MarkdownEditorMode, text: string): LexicalNode[] {
  const markdown = prepareImport(text);

  if (mode === "text") {
    return $generateNodesFromMarkdownString(markdown, transformersFor(mode));
  }

  if (mode === "inline") {
    return [$inlineParagraph(mode, markdown.replace(/\s*\r?\n\s*/g, " "))];
  }

  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*+]\s+/, ""))
    .filter((line) => line.length > 0)
    .map((line) => $inlineParagraph(mode, line));
}

/** One paragraph holding `markdown` parsed as inline Markdown. */
function $inlineParagraph(mode: MarkdownEditorMode, markdown: string): ParagraphNode {
  const paragraph = $createParagraphNode();

  for (const node of $generateNodesFromMarkdownString(markdown, transformersFor(mode))) {
    if ($isElementNode(node) && !node.isInline()) {
      paragraph.append(...node.getChildren());
    } else {
      paragraph.append(node);
    }
  }

  return paragraph;
}
