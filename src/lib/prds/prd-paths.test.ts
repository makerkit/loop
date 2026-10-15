import { describe, expect, it } from "vitest";

import { PrdFilenameSchema, attachmentUrl, resolveImageSrc } from "./prd-paths";

describe("PrdFilenameSchema", () => {
  it.each(["notes.json", "makerkit-loop.json", "v2.billing_plan.json"])("accepts %s", (name) => {
    expect(PrdFilenameSchema.safeParse(name).success).toBe(true);
  });

  it.each([
    "",
    "notes",
    "notes.md",
    ".notes.json",
    "../notes.json",
    "a/notes.json",
    "a\\notes.json",
    "a..json",
    "/etc/passwd.json",
  ])("rejects %s", (name) => {
    expect(PrdFilenameSchema.safeParse(name).success).toBe(false);
  });
});

describe("resolveImageSrc", () => {
  it("maps paths in the attachments folder to Loop's attachment URL", () => {
    expect(resolveImageSrc("mockups/a.png", "notes.json")).toBe("/attachments/notes/mockups/a.png");
    expect(resolveImageSrc("./a.png", "notes.json")).toBe("/attachments/notes/a.png");
    expect(resolveImageSrc(".prds/notes/a.png", "notes.json")).toBe("/attachments/notes/a.png");
    expect(resolveImageSrc("my%20mockup.png", "notes.json")).toBe(
      "/attachments/notes/my%20mockup.png",
    );
  });

  it.each([
    "https://example.com/a.png",
    "//example.com/a.png",
    "data:image/png;base64,AAAA",
    "javascript:alert(1)",
    "/a.png",
    "../a.png",
    ".prds/other/a.png",
    "%2e%2e/a.png",
    "C:/a.png",
  ])("refuses %s", (src) => {
    expect(resolveImageSrc(src, "notes.json")).toBeNull();
  });
});

describe("attachmentUrl", () => {
  it("encodes each path segment", () => {
    expect(attachmentUrl("my notes.json", "a b/c#d.png")).toBe(
      "/attachments/my%20notes/a%20b/c%23d.png",
    );
  });
});
