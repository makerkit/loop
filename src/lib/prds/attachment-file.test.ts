import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { attachmentKind, resolveAttachmentFile } from "./attachment-file";

let root: string;
let prdsDir: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "loop-attachments-"));
  prdsDir = join(root, ".prds");

  mkdirSync(join(prdsDir, "notes", "mockups"), { recursive: true });
  mkdirSync(join(prdsDir, "other"), { recursive: true });
  writeFileSync(join(prdsDir, "notes", "mockups", "a.png"), "png");
  writeFileSync(join(prdsDir, "notes", "readme.md"), "md");
  writeFileSync(join(prdsDir, "other", "b.png"), "png");
  writeFileSync(join(root, "secret.png"), "secret");

  // A file and a folder inside notes/ that point outside it
  symlinkSync(join(root, "secret.png"), join(prdsDir, "notes", "link.png"));
  symlinkSync(join(prdsDir, "other"), join(prdsDir, "notes", "linked-dir"));
  // A PRD folder that is itself a symlink
  symlinkSync(root, join(prdsDir, "escape"));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

function resolve(folder: string, path: string) {
  return resolveAttachmentFile({ folder, path }, { prdsDir, realpath, join, sep });
}

describe("resolveAttachmentFile", () => {
  it("serves an image inside the PRD's folder", async () => {
    const file = await resolve("notes", "mockups/a.png");

    expect(file?.contentType).toBe("image/png");
    expect(file?.absolutePath).toBe(await realpath(join(prdsDir, "notes", "mockups", "a.png")));
  });

  it.each([
    ["notes", "../other/b.png"],
    ["notes", "mockups/../../other/b.png"],
    ["notes", "/etc/hosts.png"],
    ["notes", ".hidden.png"],
    ["notes", "mockups//a.png"],
    ["..", "secret.png"],
    ["notes/mockups", "a.png"],
    ["", "a.png"],
  ])("refuses the unsafe path %s / %s", async (folder, path) => {
    expect(await resolve(folder, path)).toBeNull();
  });

  it("serves text inline and other files as downloads", async () => {
    expect(await resolve("notes", "readme.md")).toMatchObject({
      contentType: "text/plain; charset=utf-8",
      disposition: "inline",
      isImage: false,
    });
  });

  it("refuses missing files", async () => {
    expect(await resolve("notes", "mockups/missing.png")).toBeNull();
    expect(await resolve("missing", "a.png")).toBeNull();
  });

  it("refuses symlinks that leave the PRD's folder", async () => {
    expect(await resolve("notes", "link.png")).toBeNull();
    expect(await resolve("notes", "linked-dir/b.png")).toBeNull();
    expect(await resolve("escape", "secret.png")).toBeNull();
  });
});

describe("attachmentKind", () => {
  it("opens images and text in the tab and downloads everything else", () => {
    expect(attachmentKind("mockups/a.PNG")).toEqual({
      contentType: "image/png",
      disposition: "inline",
      isImage: true,
    });
    expect(attachmentKind("notes.md").disposition).toBe("inline");
    expect(attachmentKind("spec.pdf")).toEqual({
      contentType: "application/octet-stream",
      disposition: "attachment",
      isImage: false,
    });
    expect(attachmentKind("page.html").disposition).toBe("attachment");
  });
});
