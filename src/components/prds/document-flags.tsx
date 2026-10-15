import type { PlanCheckItem } from "@makerkit/prd";
import { CircleAlertIcon } from "lucide-react";
import { createContext, useContext } from "react";

import type { DocumentFlags, StoryFlag } from "#/lib/prds/document-sections";
import { cn } from "#/lib/utils";

/** The plan check, placed on the document's sections and stories. */
const DocumentFlagsContext = createContext<DocumentFlags | null>(null);

export const DocumentFlagsProvider = DocumentFlagsContext.Provider;

/** Plan check items about a section, shown under its heading. */
export function SectionFlags({ sectionId }: { sectionId: string }) {
  const items = useContext(DocumentFlagsContext)?.sectionItems[sectionId] ?? [];

  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="grid gap-1.5">
      {items.map((item) => (
        <li key={item.id}>
          <FlagCallout item={item} />
        </li>
      ))}
    </ul>
  );
}

function FlagCallout({ item }: { item: PlanCheckItem }) {
  const required = item.severity === "required";

  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        required
          ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300"
          : "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200",
      )}
    >
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>
        {item.message}
        {required ? <span className="ml-1.5 font-medium">· Required</span> : null}
      </span>
    </p>
  );
}

/** Short plan check flags on one story. */
export function StoryFlags({ storyId }: { storyId: string }) {
  const flags: StoryFlag[] = useContext(DocumentFlagsContext)?.stories[storyId] ?? [];

  if (flags.length === 0) {
    return null;
  }

  return (
    <span className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <span
          key={flag.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            flag.severity === "required"
              ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300"
              : "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200",
          )}
        >
          <CircleAlertIcon className="size-3" />
          {flag.label}
        </span>
      ))}
    </span>
  );
}
