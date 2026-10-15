import { $createLinkNode } from "@lexical/link";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  IS_UNDERLINE,
  $createLineBreakNode,
} from "lexical";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Markdown, PrdFileProvider } from "#/components/markdown";
import { SECTION_EDITS, buildSectionValue } from "#/lib/prds/section-edits";

import { createTestEditor, exportFrom, pasteInto, roundTrip } from "./testing";

function render(text: string, inline = false) {
  return renderToStaticMarkup(
    <PrdFileProvider value="notes.json">
      <Markdown text={text} inline={inline} />
    </PrdFileProvider>,
  );
}

describe("text fields (block Markdown)", () => {
  it.each([
    "Take **notes**, *ideas*, ~~old ones~~ and `code`.",
    "A [link](https://example.com/page?q=1) here.",
    "First paragraph.\n\nSecond paragraph.",
    "- one\n- two\n- three",
    "1. one\n2. two",
    "```ts\nconst a = 1;\n```",
    "## Heading\n\n> A quote",
    "An image ![diagram](attachments/flow.png) in text.",
    "",
  ])("keeps %j unchanged", (markdown) => {
    expect(roundTrip("text", markdown)).toBe(markdown);
  });

  it("is stable after the first round trip", () => {
    const once = roundTrip("text", "_under_ and __bold__ and 2*3 ~5\n\n- a\n  - nested");

    expect(roundTrip("text", once)).toBe(once);
  });

  it("keeps raw HTML as text, written escaped", () => {
    const markdown = roundTrip(
      "text",
      'Hello <b>there</b> <script>alert(1)</script> <img src=x onerror="alert(1)">',
    );

    expect(markdown).toBe(
      'Hello \\<b>there\\</b> \\<script>alert(1)\\</script> \\<img src=x onerror="alert(1)">',
    );
    expect(render(markdown)).not.toMatch(/<(b|script|img)\b/);
    expect(render(markdown)).toContain("&lt;script&gt;");
  });

  it("keeps placeholders like <port> instead of losing them", () => {
    const markdown = roundTrip("inline", "Not 127.0.0.1:<port> or localhost:<port>.");

    expect(markdown).toBe("Not 127.0.0.1:\\<port> or localhost:\\<port>.");
    expect(render(markdown, true)).toContain("127.0.0.1:&lt;port&gt;");
  });

  it("doesn't add needless backslashes", () => {
    const value = "The audit_log table, 2 * 3 rows, GET /v1/x";

    expect(roundTrip("text", value)).toBe(value);
  });

  it("keeps HTML-like text inside code", () => {
    const markdown = "Use `<div>` here\n\n```html\n<p>hi</p>\n```";

    expect(roundTrip("text", markdown)).toBe(markdown);
  });

  it("escapes typed text that looks like an HTML tag", () => {
    const editor = createTestEditor("text");
    editor.update(
      () => {
        const paragraph = $createParagraphNode().append($createTextNode("Wrap it in <b>bold</b>"));
        $getRoot().clear().append(paragraph);
      },
      { discrete: true },
    );

    const markdown = exportFrom(editor, "text");

    expect(markdown).toBe("Wrap it in \\<b>bold\\</b>");
    expect(render(markdown)).toContain("Wrap it in &lt;b&gt;bold&lt;/b&gt;");
    // Loading it again shows the same text, and saving gives the same Markdown
    expect(roundTrip("text", markdown)).toBe(markdown);
  });

  it("escapes a star that would start a list item", () => {
    const editor = createTestEditor("text");
    editor.update(
      () => {
        const paragraph = $createParagraphNode().append(
          $createTextNode(" * not a bullet"),
          $createLineBreakNode(),
          $createTextNode("* nor this"),
        );
        $getRoot().clear().append(paragraph);
      },
      { discrete: true },
    );

    const markdown = exportFrom(editor, "text");

    expect(markdown).toContain("\\* not a bullet");
    expect(markdown).toContain("\\* nor this");
    expect(render(markdown)).not.toContain("<li>");
  });

  it("keeps autolinks and comparisons as text", () => {
    expect(roundTrip("text", "Go to <https://example.com>, if a < b")).toBe(
      "Go to <https://example.com>, if a < b",
    );
  });

  it("removes links that are not http(s), keeping their text", () => {
    const markdown = roundTrip(
      "text",
      "[bad](javascript:alert(1)) [data](data:text/html,x) [rel](docs/x.md) [ok](http://a.com)",
    );

    expect(markdown).toBe("bad data rel [ok](http://a.com)");
    expect(render(markdown)).not.toContain("javascript:");
  });

  it("removes links added with an unsafe URL", () => {
    const editor = createTestEditor("text");
    editor.update(
      () => {
        const link = $createLinkNode("javascript:alert(1)").append($createTextNode("click"));
        $getRoot().clear().append($createParagraphNode().append(link));
      },
      { discrete: true },
    );

    expect(exportFrom(editor, "text")).toBe("click");
  });

  it("keeps attachment images", () => {
    const markdown = roundTrip("text", "See ![flow](attachments/flow.png)");

    expect(markdown).toBe("See ![flow](attachments/flow.png)");
    expect(render(markdown)).toContain('alt="flow"');
  });

  it("drops formats Markdown can't store", () => {
    const editor = createTestEditor("text");
    editor.update(
      () => {
        const text = $createTextNode("underlined").toggleFormat("bold");
        text.setFormat(text.getFormat() | IS_UNDERLINE);
        text.setStyle("color: red");
        $getRoot().clear().append($createParagraphNode().append(text));
      },
      { discrete: true },
    );

    expect(exportFrom(editor, "text")).toBe("**underlined**");
  });

  it("parses pasted plain text as Markdown", () => {
    const editor = createTestEditor("text", "Intro");
    pasteInto(editor, "text", "- **one**\n- two <i>x</i>");

    expect(exportFrom(editor, "text")).toBe("Intro\n\n- **one**\n- two \\<i>x\\</i>");
  });
});

describe("list fields (one inline item per line)", () => {
  it("loads each line as one item and writes one item per line", () => {
    const value = "**Fast** search\nWorks with `git`\nSee [docs](https://example.com)";

    expect(roundTrip("list", value)).toBe(value);
  });

  it("keeps block Markdown as plain text in an item", () => {
    const value = "- not a nested list\n# not a heading";

    // The leading "- " is how readEditValues/buildSectionValue mark a list
    // line anyway; the item stays one line either way
    expect(roundTrip("list", value).split("\n")).toHaveLength(2);
    expect(render(roundTrip("list", value).split("\n")[1]!, true)).not.toContain("<h1");
  });

  it("keeps a typed leading star as text, not a bullet marker", () => {
    const editor = createTestEditor("list");
    editor.update(
      () => {
        $getRoot()
          .clear()
          .append($createParagraphNode().append($createTextNode(" * starred item")));
      },
      { discrete: true },
    );

    const value = exportFrom(editor, "list");

    expect(value).toBe("\\* starred item");
    // buildSectionValue strips "- " / "* " list markers; an escaped star survives
    expect(buildSectionValue(SECTION_EDITS.nonGoals, { nonGoals: value })).toEqual([
      "\\* starred item",
    ]);
  });

  it("drops empty lines", () => {
    expect(roundTrip("list", "One\n\n  \nTwo")).toBe("One\nTwo");
  });

  it("never splits an item with a line break", () => {
    const editor = createTestEditor("list", "One");
    editor.update(
      () => {
        const paragraph = $getRoot().getFirstChild();

        if ($isElementNode(paragraph)) {
          paragraph.append($createLineBreakNode(), $createTextNode("still one"));
        }
      },
      { discrete: true },
    );

    expect(exportFrom(editor, "list")).toBe("One still one");
  });

  it("pastes one item per line", () => {
    const editor = createTestEditor("list");
    pasteInto(editor, "list", "- first\n\n* **second**\nthird");

    expect(exportFrom(editor, "list").split("\n")).toEqual(["first", "**second**", "third"]);
  });

  it("renders every item as one line of inline Markdown", () => {
    const items = roundTrip("list", "**a** and *b*\n[c](https://c.com) `d`").split("\n");

    for (const item of items) {
      expect(render(item, true)).not.toMatch(/<(p|ul|ol|li|h\d|pre)\b/);
    }
  });
});

describe("inline fields (one line)", () => {
  it("keeps inline Markdown", () => {
    const value = "Show **an error** and keep the [draft](https://x.com)";

    expect(roundTrip("inline", value)).toBe(value);
  });

  it("joins lines into one", () => {
    expect(roundTrip("inline", "First line\nsecond line")).toBe("First line second line");
  });

  it("joins pasted lines into one", () => {
    const editor = createTestEditor("inline", "Start");
    pasteInto(editor, "inline", " then\nmore");

    expect(exportFrom(editor, "inline")).toBe("Start then more");
  });
});
