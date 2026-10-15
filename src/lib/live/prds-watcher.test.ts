import { describe, expect, it } from "vitest";

import { createPrdsWatcher } from "./prds-watcher";

function setup({ prdsExists = true } = {}) {
  const watchers: Array<{ dir: string; emit: (file: string | null) => void; closed: boolean }> = [];
  const timers: Array<{ callback: () => void; cleared: boolean }> = [];
  let exists = prdsExists;

  const watcher = createPrdsWatcher({
    projectRoot: "/project",
    prdsDir: "/project/.prds",
    exists: async () => exists,
    watch: (dir, onChange) => {
      const entry = { dir, emit: onChange, closed: false };
      watchers.push(entry);

      return () => {
        entry.closed = true;
      };
    },
    setTimeout: (callback) => {
      const timer = { callback, cleared: false };
      timers.push(timer);

      return timer;
    },
    clearTimeout: (handle) => {
      (handle as { cleared: boolean }).cleared = true;
    },
  });

  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const runTimers = () => {
    for (const timer of timers.splice(0)) {
      if (!timer.cleared) timer.callback();
    }
  };

  return {
    watcher,
    watchers,
    tick,
    runTimers,
    createPrds: () => {
      exists = true;
    },
  };
}

describe("createPrdsWatcher", () => {
  it("watches only while someone listens", async () => {
    const { watcher, watchers, tick } = setup();

    expect(watcher.watching).toBe(false);

    const first = watcher.subscribe(() => undefined);
    const second = watcher.subscribe(() => undefined);
    await tick();

    expect(watchers).toHaveLength(1);
    expect(watcher.watching).toBe(true);

    first();
    expect(watcher.watching).toBe(true);

    second();
    expect(watcher.watching).toBe(false);
    expect(watchers[0]!.closed).toBe(true);
  });

  it("batches a burst of changes into one notification", async () => {
    const { watcher, watchers, tick, runTimers } = setup();
    const received: string[][] = [];

    watcher.subscribe((files) => received.push(files));
    await tick();

    watchers[0]!.emit("notes.json");
    watchers[0]!.emit("notes.json");
    watchers[0]!.emit("notes/mockup.png");
    runTimers();

    expect(received).toEqual([["notes.json", "notes/mockup.png"]]);
  });

  it("waits for the .prds folder to be created, then watches it", async () => {
    const { watcher, watchers, tick, runTimers, createPrds } = setup({ prdsExists: false });
    const received: string[][] = [];

    watcher.subscribe((files) => received.push(files));
    await tick();

    expect(watchers[0]!.dir).toBe("/project");

    watchers[0]!.emit("README.md");
    runTimers();
    expect(received).toEqual([]);

    createPrds();
    watchers[0]!.emit(".prds");
    await tick();
    runTimers();

    expect(received).toEqual([[""]]);
    expect(watchers[0]!.closed).toBe(true);
    expect(watchers[1]!.dir).toBe("/project/.prds");
  });

  it("does not keep watching when the last listener left during start-up", async () => {
    const { watcher, watchers, tick } = setup();

    const unsubscribe = watcher.subscribe(() => undefined);
    unsubscribe();
    await tick();

    expect(watcher.watching).toBe(false);
    expect(watchers.every((entry) => entry.closed)).toBe(true);
  });
});
