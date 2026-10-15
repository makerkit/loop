import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Markdown, PrdFileProvider } from "./markdown";

function render(text: string, inline = false) {
  return renderToStaticMarkup(
    <PrdFileProvider value="notes.json">
      <Markdown text={text} inline={inline} />
    </PrdFileProvider>,
  );
}

describe("Markdown", () => {
  it("renders basic Markdown", () => {
    const html = render("**bold** and `code`\n\n- one\n- two");

    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<li>one</li>");
  });

  it("does not render raw HTML", () => {
    const html = render('Hello <script>alert(1)</script> <img src=x onerror="alert(1)"> <b>x</b>');

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<b>");
  });

  it("links only http(s) URLs, in a new tab", () => {
    const html = render("[ok](https://example.com) [js](javascript:alert(1)) [rel](/settings)");

    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">ok</a>',
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('href="/settings"');
    expect(html).toContain("<span>js</span>");
  });

  it("loads images only from the PRD's attachments folder", () => {
    const html = render(
      [
        "![mockup](mockups/a.png)",
        "![same](.prds/notes/mockups/b.png)",
        "![remote](https://evil.com/x.png)",
        "![data](data:image/png;base64,AAAA)",
        "![escape](../other/c.png)",
        "![abs](/etc/passwd.png)",
      ].join(" "),
    );

    expect(html).toContain('src="/attachments/notes/mockups/a.png"');
    expect(html).toContain('src="/attachments/notes/mockups/b.png"');
    expect(html).not.toContain("evil.com");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain("other/c.png");
    expect(html).not.toContain("passwd");
    expect(html).toContain("[remote]");
  });

  it("keeps inline Markdown inline", () => {
    const html = render("# Heading with **bold**\n\nsecond paragraph", true);

    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<p");
    expect(html).toContain("<strong>bold</strong>");
  });
});
