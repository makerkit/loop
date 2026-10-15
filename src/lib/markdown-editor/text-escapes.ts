/**
 * How plain editor text is written as Markdown, beyond Lexical's own escaping.
 * Pure string helpers, shared by the editor and its tests.
 *
 * Lexical escapes every `*`, `_`, `~`, `` ` `` and `\` in text, but leaves `<`
 * alone. Two adjustments:
 * - A `<` that would start an HTML tag (`<b>`, `<port>`) is escaped, so the
 *   stored Markdown never contains raw HTML. The document view drops raw HTML,
 *   so `<port>` written by an agent shows as text once saved from the editor.
 * - Characters that can't start formatting where they are (`audit_log`,
 *   `2 * 3`) are left as they are, so saving doesn't fill the PRD with
 *   backslashes that agents then read.
 *
 * Lexical escapes backslashes in text, so these are written as private-use
 * placeholders first and replaced in the final string (`finishEscapes`).
 */

const ESCAPED_TAG_START = "\uE000";
const LITERAL_UNDERSCORE = "\uE001";
const LITERAL_STAR = "\uE002";

const PLACEHOLDERS = /[\uE000-\uE002]/g;

/** `<` followed by what would make it a tag (`<b>`, `</p`, `<!--`, `<?`); not `<https://...>` autolinks. */
const TAG_START = /<(?=\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>]|$)|!|\?)/g;

/** An underscore between letters or digits can't open or close emphasis. */
const INTRAWORD_UNDERSCORE = /(?<=[\p{L}\p{N}])_(?=[\p{L}\p{N}])/gu;

/** A star with spaces on both sides, after other text, can't open or close emphasis (or start a list item). */
const SPACED_STAR = /(?<=\S\s)\*(?=\s)/g;

/** Removes placeholders from text before it is loaded, so they can't be forged. */
export function prepareImport(markdown: string): string {
  return markdown.replace(PLACEHOLDERS, "");
}

/** Marks the characters in plain text (not code) that need different escaping. */
export function markText(text: string): string {
  return text
    .replace(TAG_START, ESCAPED_TAG_START)
    .replace(INTRAWORD_UNDERSCORE, LITERAL_UNDERSCORE)
    .replace(SPACED_STAR, LITERAL_STAR);
}

/** Turns the placeholders left by `markText` into their final Markdown. */
export function finishEscapes(markdown: string): string {
  return markdown
    .replaceAll(ESCAPED_TAG_START, "\\<")
    .replaceAll(LITERAL_UNDERSCORE, "_")
    .replaceAll(LITERAL_STAR, "*");
}
