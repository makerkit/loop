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
  parent(path: string): { dir: string; name: string };
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
  let restartRequested = false;

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
      let target = deps.prdsDir;
      let child: string | undefined;
      let missingPath: string | undefined;

      while (!(await deps.exists(target))) {
        const { dir, name } = deps.parent(target);
        if (dir === target) return;

        child = name;
        missingPath = target;
        target = dir;
      }

      stop = deps.watch(
        target,
        (file) => {
          if (child === undefined) {
            changed(file);
          } else if (file === child || file === null) {
            if (starting) {
              restartRequested = true;
            } else {
              restart();
              changed(null);
            }
          }
        },
        child === undefined,
      );

      if (missingPath !== undefined && (await deps.exists(missingPath))) {
        // The missing child appeared before the ancestor watch was registered.
        restartRequested = true;
      }
    } finally {
      starting = false;
    }

    const shouldRestart = restartRequested;
    restartRequested = false;

    if (listeners.size === 0) {
      shutdown();
    } else if (shouldRestart) {
      restart();
      changed(null);
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
