/**
 * Watches the project's .prds folder while at least one browser is
 * listening, and tells listeners when PRD files change. Changes arrive in
 * bursts (a PRD write, an agent's several tool calls), so they are batched.
 * Pure: the file watching and timers are injected.
 */

export interface WatchDeps {
  /** Starts watching a directory; returns a function that stops it. */
  watch(dir: string, onChange: (file: string | null) => void, recursive: boolean): () => void;
  exists(path: string): Promise<boolean>;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  projectRoot: string;
  prdsDir: string;
  /** How long to wait for a burst of changes to settle. */
  debounceMs?: number;
}

export type ChangeListener = (files: string[]) => void;

export function createPrdsWatcher(deps: WatchDeps) {
  const debounceMs = deps.debounceMs ?? 150;
  const listeners = new Set<ChangeListener>();
  let stop: (() => void) | null = null;
  let pending = new Set<string>();
  let timer: unknown = null;
  let starting = false;

  function flush() {
    timer = null;
    const files = [...pending].sort();
    pending = new Set();

    for (const listener of listeners) {
      listener(files);
    }
  }

  function changed(file: string | null) {
    pending.add(file ?? "");

    if (timer === null) {
      timer = deps.setTimeout(flush, debounceMs);
    }
  }

  async function start() {
    if (stop || starting) {
      return;
    }

    starting = true;

    try {
      if (await deps.exists(deps.prdsDir)) {
        stop = deps.watch(deps.prdsDir, (file) => changed(file), true);
      } else {
        // No .prds yet: watch the project folder until the agent creates it
        stop = deps.watch(
          deps.projectRoot,
          (file) => {
            if (file === ".prds") {
              // Restart first: it drops pending changes, and this one must be sent
              restart();
              changed(null);
            }
          },
          false,
        );
      }
    } finally {
      starting = false;
    }

    // Everyone may have left while we were starting
    if (listeners.size === 0) {
      shutdown();
    }
  }

  function shutdown() {
    stop?.();
    stop = null;

    if (timer !== null) {
      deps.clearTimeout(timer);
      timer = null;
    }

    pending = new Set();
  }

  function restart() {
    shutdown();
    void start();
  }

  return {
    /** Listens for changes; returns the function that stops listening. */
    subscribe(listener: ChangeListener) {
      listeners.add(listener);
      void start();

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0) {
          shutdown();
        }
      };
    },
    /** Whether a file watcher is running (only while someone listens). */
    get watching() {
      return stop !== null;
    },
  };
}

export type PrdsWatcher = ReturnType<typeof createPrdsWatcher>;
