import { describe, expect, it } from "vitest";

// @ts-expect-error plain JavaScript module shipped in bin/
import { choosePort, openCommand, parseArgs, projectNotes } from "../../bin/launcher.mjs";

describe("choosePort", () => {
  it("takes the first free preferred port, else lets the OS choose", async () => {
    const taken = new Set([3000, 3001]);

    expect(await choosePort(async (port: number) => !taken.has(port))).toBe(3002);
    expect(await choosePort(async () => false)).toBe(0);
  });
});

describe("openCommand", () => {
  it("opens the browser per platform without a shell string", () => {
    const url = "http://127.0.0.1:3000/?token=a&b";

    expect(openCommand("darwin", url)).toEqual({ command: "open", args: [url] });
    expect(openCommand("linux", url)).toEqual({ command: "xdg-open", args: [url] });
    expect(openCommand("win32", url)).toEqual({
      command: "cmd",
      args: ["/c", "start", '""', "http://127.0.0.1:3000/?token=a^&b"],
    });
    expect(openCommand("aix", url)).toBeNull();
  });
});

describe("parseArgs", () => {
  it("reads --port, --no-open and --help", () => {
    expect(parseArgs([])).toEqual({ open: true, help: false, port: null });
    expect(parseArgs(["--port", "4000", "--no-open"])).toEqual({
      open: false,
      help: false,
      port: 4000,
    });
    expect(parseArgs(["--port=5000"])).toMatchObject({ port: 5000 });
    expect(parseArgs(["-h"])).toMatchObject({ help: true });
  });

  it("rejects bad input", () => {
    expect(parseArgs(["--port", "99999"]).error).toBe("Invalid port: 99999");
    expect(parseArgs(["--verbose"]).error).toBe("Unknown option: --verbose");
  });
});

describe("projectNotes", () => {
  it("explains what a bare folder means", () => {
    expect(projectNotes({ hasPrds: true, hasPackageJson: true, hasGit: true })).toEqual([]);
    expect(projectNotes({ hasPrds: false, hasPackageJson: false, hasGit: false })).toHaveLength(3);
  });
});
