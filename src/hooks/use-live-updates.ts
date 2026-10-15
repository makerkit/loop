import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export type LiveStatus = "connecting" | "live" | "reconnecting";

/**
 * Reloads the page's data when PRD files change (e.g. the agent moved a
 * story), using the /api/events stream. Open editors keep their drafts:
 * saving still checks the revision they started from.
 */
export function useLiveUpdates() {
  const router = useRouter();
  const [status, setStatus] = useState<LiveStatus>("connecting");

  useEffect(() => {
    const source = new EventSource("/api/events");
    let timer: ReturnType<typeof setTimeout> | undefined;

    source.addEventListener("open", () => setStatus("live"));
    source.addEventListener("error", () => setStatus("reconnecting"));
    source.addEventListener("prds", () => {
      clearTimeout(timer);
      // Loop's own writes also arrive here; one reload per burst is enough
      timer = setTimeout(() => void router.invalidate(), 100);
    });

    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [router]);

  return status;
}
