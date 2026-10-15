import { $isLinkNode, LinkNode } from "@lexical/link";
import { mergeRegister } from "@lexical/utils";
import {
  $createTextNode,
  $isElementNode,
  IS_BOLD,
  IS_CODE,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  LineBreakNode,
  RootNode,
  TextNode,
  type LexicalEditor,
} from "lexical";

import { toSafeLinkUrl } from "./safe-link";
import type { MarkdownEditorMode } from "./transformers";

/** The text formats Markdown (and so the document view) can show. */
const MARKDOWN_FORMATS = IS_BOLD | IS_ITALIC | IS_STRIKETHROUGH | IS_CODE;

/**
 * Keeps the editor's content to what its Markdown can express, however it got
 * there (loading, typing, shortcuts, paste, the toolbar):
 * - links: only http(s) URLs; any other link becomes plain text
 * - text: no underline, highlight, colours or other formats Markdown can't store
 * - `list` and `inline`: no line breaks inside an item
 * - `inline`: one paragraph only
 *
 * Returns a function that removes the guards.
 */
export function registerMarkdownGuards(
  editor: LexicalEditor,
  mode: MarkdownEditorMode,
): () => void {
  const guards = [
    editor.registerNodeTransform(LinkNode, (link) => {
      if (!$isLinkNode(link)) {
        return;
      }

      const url = toSafeLinkUrl(link.getURL());

      if (url === null) {
        for (const child of link.getChildren().reverse()) {
          link.insertAfter(child);
        }

        link.remove();
      } else if (url !== link.getURL()) {
        link.setURL(url);
      }
    }),

    editor.registerNodeTransform(TextNode, (text) => {
      const format = text.getFormat();

      if ((format & ~MARKDOWN_FORMATS) !== 0) {
        text.setFormat(format & MARKDOWN_FORMATS);
      }

      if (text.getStyle() !== "") {
        text.setStyle("");
      }
    }),
  ];

  if (mode !== "text") {
    guards.push(
      editor.registerNodeTransform(LineBreakNode, (lineBreak) => {
        lineBreak.replace($createTextNode(" "));
      }),
    );
  }

  if (mode === "inline") {
    guards.push(
      editor.registerNodeTransform(RootNode, (root) => {
        const [first, ...rest] = root.getChildren();

        if (!$isElementNode(first)) {
          return;
        }

        for (const block of rest) {
          if ($isElementNode(block) && !block.isEmpty()) {
            if (!first.isEmpty()) {
              first.append($createTextNode(" "));
            }

            first.append(...block.getChildren());
          }

          block.remove();
        }
      }),
    );
  }

  return mergeRegister(...guards);
}
