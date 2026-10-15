import type { EditorThemeClasses } from "lexical";

import type { MarkdownEditorMode } from "#/lib/markdown-editor/transformers";

/**
 * Lexical theme classes. Content is styled like the rendered document
 * (`markdown.tsx` for text, `document-parts.tsx` for lists).
 */
const TEXT_FORMATS: EditorThemeClasses["text"] = {
  bold: "font-semibold",
  italic: "italic",
  strikethrough: "line-through",
  code: "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]",
};

const LINK = "text-foreground underline underline-offset-2";

const THEMES: Record<MarkdownEditorMode, EditorThemeClasses> = {
  text: {
    text: TEXT_FORMATS,
    link: LINK,
    paragraph: "my-3",
    heading: {
      h1: "mt-6 mb-3 text-2xl font-semibold",
      h2: "mt-6 mb-3 text-xl font-semibold",
      h3: "mt-5 mb-2 text-lg font-semibold",
      h4: "mt-4 mb-2 font-semibold",
      h5: "mt-4 mb-2 font-semibold",
      h6: "mt-4 mb-2 font-semibold",
    },
    quote: "my-3 border-l-2 pl-4 text-muted-foreground italic",
    list: {
      ul: "my-3 list-disc pl-6 marker:text-muted-foreground",
      ol: "my-3 list-decimal pl-6 marker:text-muted-foreground",
      listitem: "my-1",
      nested: { listitem: "list-none" },
    },
    code: "my-3 block overflow-x-auto rounded-md bg-muted p-3 font-mono text-[0.85em] leading-6 whitespace-pre",
  },
  // One bullet per item, like the document's lists
  list: {
    text: TEXT_FORMATS,
    link: LINK,
    paragraph: "list-item list-disc marker:text-muted-foreground",
  },
  inline: {
    text: TEXT_FORMATS,
    link: LINK,
    paragraph: "m-0",
  },
};

export function themeFor(mode: MarkdownEditorMode): EditorThemeClasses {
  return THEMES[mode];
}

/** Classes for the editable area, per mode. */
export const CONTENT_CLASSES: Record<MarkdownEditorMode, string> = {
  text: "min-h-24 px-3 py-2 text-[15px] leading-7 [&>:first-child]:mt-0 [&>:last-child]:mb-0",
  list: "grid min-h-9 gap-1.5 py-1.5 pr-3 pl-8 text-[15px] leading-7",
  inline: "min-h-9 px-3 py-1.5 text-sm leading-6",
};

/** Where the placeholder sits, so it lines up with the first line of text. */
export const PLACEHOLDER_CLASSES: Record<MarkdownEditorMode, string> = {
  text: "top-2 left-3 text-[15px] leading-7",
  list: "top-1.5 left-8 text-[15px] leading-7",
  inline: "top-1.5 left-3 text-sm leading-6",
};
