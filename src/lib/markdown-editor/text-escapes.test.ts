import { describe, expect, it } from "vitest";

import { parseLinkInput, toSafeLinkUrl } from "./safe-link";
import { finishEscapes, markText, prepareImport } from "./text-escapes";

const write = (text: string) => finishEscapes(markText(text));

describe("text escapes", () => {
  it("escapes only brackets that would start an HTML tag", () => {
    expect(write("<b> </i> <!-- <port> a < b <https://x.com>")).toBe(
      "\\<b> \\</i> \\<!-- \\<port> a < b <https://x.com>",
    );
  });

  it("leaves underscores inside words and spaced stars alone", () => {
    expect(write("audit_log, 2 * 3, émoji_ok")).toBe("audit_log, 2 * 3, émoji_ok");
  });

  it("leaves other underscores and stars for Lexical to escape", () => {
    expect(write("_lead *star* end_")).toBe("_lead *star* end_");
  });

  it("removes placeholders from loaded text, so they can't be forged", () => {
    expect(prepareImport(`a\uE000b\uE001c\uE002d`)).toBe("abcd");
  });
});

describe("toSafeLinkUrl", () => {
  it.each([
    ["https://example.com", "https://example.com"],
    ["  http://example.com/a b  ", "http://example.com/a%20b"],
  ])("accepts %j", (input, expected) => {
    expect(toSafeLinkUrl(input)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,x",
    "/relative",
    "attachments/a.png",
    "mailto:a@b.com",
    "http://",
    "https://exa\u0000mple.com",
    "",
  ])("rejects %j", (input) => {
    expect(toSafeLinkUrl(input)).toBeNull();
  });
});

describe("parseLinkInput", () => {
  it("adds https:// to a bare domain", () => {
    expect(parseLinkInput("example.com/docs")).toBe("https://example.com/docs");
  });

  it("rejects other schemes and text", () => {
    expect(parseLinkInput("javascript:alert(1)")).toBeNull();
    expect(parseLinkInput("ftp://example.com")).toBeNull();
    expect(parseLinkInput("not a link")).toBeNull();
  });
});
