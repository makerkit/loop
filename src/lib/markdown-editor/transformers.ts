import { CodeNode } from "@lexical/code-core";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CODE,
  HEADING,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
  type TextMatchTransformer,
  type Transformer,
} from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $isTextNode, type Klass, type LexicalNode } from "lexical";

import {
  $createMarkdownImageNode,
  $isMarkdownImageNode,
  MarkdownImageNode,
} from "./markdown-image-node";
import { markText } from "./text-escapes";

/**
 * How a field's Markdown is edited:
 * - `text`: block Markdown (paragraphs, headings, lists, quotes, code blocks)
 * - `list`: one item per paragraph, inline Markdown only (no line breaks)
 * - `inline`: a single line of inline Markdown
 */
export type MarkdownEditorMode = "text" | "list" | "inline";

const IMAGE_SOURCE = /!\[([^[\]]*)\]\(([^()\s]+)\)/;

/** Keeps `![alt](path)` as one unit and writes it back unchanged. Must come before LINK. */
export const IMAGE: TextMatchTransformer = {
  dependencies: [MarkdownImageNode],
  export: (node) => ($isMarkdownImageNode(node) ? node.getTextContent() : null),
  importRegExp: IMAGE_SOURCE,
  regExp: new RegExp(`${IMAGE_SOURCE.source}$`),
  replace: (textNode, match) => {
    textNode.replace($createMarkdownImageNode(match[0]));
  },
  trigger: ")",
  type: "text-match",
};

/**
 * Export only: writes plain text with the escaping described in
 * `text-escapes.ts` (no raw HTML, no needless backslashes). Must come first.
 */
export const ESCAPE_TEXT: TextMatchTransformer = {
  dependencies: [],
  export: (node, _exportChildren, exportFormat) => {
    if (!$isTextNode(node) || $isMarkdownImageNode(node) || node.hasFormat("code")) {
      return null;
    }

    const text = node.getTextContent();
    const marked = markText(text);

    return marked === text ? null : exportFormat(node, marked);
  },
  // Never matches: nothing to import or turn into a shortcut
  regExp: /(?!)/,
  type: "text-match",
};

const INLINE_TRANSFORMERS: Transformer[] = [
  ESCAPE_TEXT,
  IMAGE,
  LINK,
  INLINE_CODE,
  BOLD_STAR,
  ITALIC_STAR,
  BOLD_UNDERSCORE,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
];

const BLOCK_TRANSFORMERS: Transformer[] = [
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  CODE,
  ...INLINE_TRANSFORMERS,
];

const INLINE_NODES: Klass<LexicalNode>[] = [LinkNode, MarkdownImageNode];

const BLOCK_NODES: Klass<LexicalNode>[] = [
  ...INLINE_NODES,
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
];

export function transformersFor(mode: MarkdownEditorMode): Transformer[] {
  return mode === "text" ? BLOCK_TRANSFORMERS : INLINE_TRANSFORMERS;
}

/** The node types an editor in this mode can contain. Anything else can't be created. */
export function nodesFor(mode: MarkdownEditorMode): Klass<LexicalNode>[] {
  return mode === "text" ? BLOCK_NODES : INLINE_NODES;
}
