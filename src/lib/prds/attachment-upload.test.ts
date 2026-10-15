import { describe, expect, it } from "vitest";

import { safeUploadName, titleFromFileName, uniqueName } from "./attachment-upload";

describe("safeUploadName", () => {
  it.each([
    ["Approve View (v2).PNG", "approve-view-v2.png"],
    ["../../etc/passwd", "passwd"],
    ["C:\\Users\\me\\mock up.jpg", "mock-up.jpg"],
    [".env", "env"],
    ["Café résumé.pdf", "cafe-resume.pdf"],
    ["", "attachment"],
    ["...", "attachment"],
    ["script.<svg>.html", "script.svg.html"],
  ])("%s -> %s", (input, expected) => {
    expect(safeUploadName(input)).toBe(expected);
  });
});

describe("uniqueName", () => {
  it("never reuses a name that exists", () => {
    const taken = new Set(["mock.png", "mock-2.png"]);

    expect(uniqueName("new.png", (name) => taken.has(name))).toBe("new.png");
    expect(uniqueName("mock.png", (name) => taken.has(name))).toBe("mock-3.png");
  });
});

describe("titleFromFileName", () => {
  it("reads a file name as a title", () => {
    expect(titleFromFileName("approve-view_mockup.png")).toBe("Approve view mockup");
  });
});
