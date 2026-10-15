// Pure helpers for the `loop` command (bin/loop.mjs). Plain JavaScript so the
// published package runs on Node without a build step; tested from src/cli.

/** The ports Loop tries first, in order; after these, any free port. */
export const PREFERRED_PORTS = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009];

/**
 * The first preferred port that is free, else port 0 (the OS picks one).
 * @param {(port: number) => Promise<boolean>} isFree
 * @returns {Promise<number>}
 */
export async function choosePort(isFree, preferred = PREFERRED_PORTS) {
  for (const port of preferred) {
    if (await isFree(port)) {
      return port;
    }
  }

  return 0;
}

/**
 * The command that opens a URL in the default browser, as an argument array.
 * @param {NodeJS.Platform} platform
 * @param {string} url
 * @returns {{ command: string; args: string[] } | null}
 */
export function openCommand(platform, url) {
  if (platform === "darwin") return { command: "open", args: [url] };
  // `start` treats the first quoted argument as the window title
  if (platform === "win32")
    return { command: "cmd", args: ["/c", "start", '""', url.replace(/&/g, "^&")] };
  if (platform === "linux" || platform === "freebsd" || platform === "openbsd") {
    return { command: "xdg-open", args: [url] };
  }

  return null;
}

/**
 * @param {string[]} argv the arguments after `loop`
 * @returns {{ open: boolean; help: boolean; port: number | null; error?: string }}
 */
export function parseArgs(argv) {
  const options = { open: true, help: false, port: /** @type {number | null} */ (null) };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--no-open") options.open = false;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--port" || arg.startsWith("--port=")) {
      const value = arg.includes("=") ? arg.slice("--port=".length) : argv[++index];
      const port = Number(value);

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return { ...options, error: `Invalid port: ${value}` };
      }

      options.port = port;
    } else {
      return { ...options, error: `Unknown option: ${arg}` };
    }
  }

  return options;
}

/**
 * What the project folder looks like, for a friendly note at start.
 * @param {{ hasPrds: boolean; hasPackageJson: boolean; hasGit: boolean }} project
 * @returns {string[]}
 */
export function projectNotes({ hasPrds, hasPackageJson, hasGit }) {
  const notes = [];

  if (!hasPrds) {
    notes.push(
      "No .prds folder yet: plan a feature with your agent's shape_prd prompt to create one.",
    );
  }

  if (!hasGit) {
    notes.push("Not a git repository: approving a story marks it completed without a commit.");
  }

  if (!hasPackageJson) {
    notes.push("No package.json: approving a story runs no project checks.");
  }

  return notes;
}

export const HELP = `Usage: npx @makerkit/loop [options]

Starts Makerkit Loop for the project in the current folder and opens it in
your browser. Loop only listens on 127.0.0.1.

Options:
  --port <number>  Use this port (default: 3000, or the next free one)
  --no-open        Do not open the browser; just print the link
  -h, --help       Show this help
`;
