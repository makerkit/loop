import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import type { SectionEdit } from "#/lib/prds/section-edits";
import { cn } from "#/lib/utils";

import {
  NotWrittenYet,
  SECTION_ACTION_REVEAL,
  SECTION_CLASS,
  SECTION_TITLE_CLASS,
  SUBSECTION_CLASS,
  SUBSECTION_TITLE_CLASS,
} from "./document-parts";
import { SectionFlags } from "./document-flags";
import {
  NotApplicableAction,
  NotApplicableBody,
  useSectionApplicability,
} from "./section-applicability";
import { SectionEditor } from "./section-editor";

/** Renders a custom editor in place of the form-based SectionEditor. */
export type RenderEditor = (props: {
  latest: React.ReactNode;
  onDone: () => void;
}) => React.ReactNode;

/** A document section (h2) with an Edit button that edits it in place. */
export function EditableSection({
  id,
  title,
  edit,
  isEmpty = false,
  children,
}: {
  id: string;
  title: string;
  /** A form-based edit, or a custom editor (e.g. the edge case table). */
  edit: SectionEdit | RenderEditor;
  isEmpty?: boolean;
  children?: React.ReactNode;
}) {
  const { reason } = useSectionApplicability(id);
  const heading = (
    <h2 id={`${id}-title`} className={SECTION_TITLE_CLASS}>
      {title}
    </h2>
  );

  return (
    <section id={id} aria-labelledby={`${id}-title`} className={SECTION_CLASS}>
      {reason !== null ? (
        <>
          <div className="flex min-h-7 items-center">{heading}</div>
          <NotApplicableBody sectionId={id} />
        </>
      ) : (
        <Editable
          edit={edit}
          level="section"
          heading={heading}
          title={title}
          actions={
            <NotApplicableAction sectionId={id} title={title} className={SECTION_ACTION_REVEAL} />
          }
          flags={<SectionFlags sectionId={id} />}
          view={isEmpty ? <NotWrittenYet /> : children}
        />
      )}
    </section>
  );
}

/** A labelled part inside a section (h3), e.g. "Non-goals", edited on its own. */
export function EditableSubsection({
  title,
  edit,
  isEmpty = false,
  children,
}: {
  title: string;
  edit: SectionEdit;
  isEmpty?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={SUBSECTION_CLASS}>
      <Editable
        edit={edit}
        level="subsection"
        heading={<h3 className={SUBSECTION_TITLE_CLASS}>{title}</h3>}
        title={title}
        view={isEmpty ? <NotWrittenYet /> : children}
      />
    </div>
  );
}

// On devices with a mouse, the Edit button shows when the section is hovered or focused
const REVEAL_CLASSES = {
  section:
    "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/section:opacity-100 [@media(hover:hover)]:group-focus-within/section:opacity-100",
  subsection:
    "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/subsection:opacity-100 [@media(hover:hover)]:group-focus-within/subsection:opacity-100",
};

function Editable({
  edit,
  level,
  heading,
  title,
  actions,
  flags,
  view,
}: {
  edit: SectionEdit | RenderEditor;
  level: "section" | "subsection";
  heading: React.ReactNode;
  title: string;
  /** Other header actions, e.g. N/A, hidden while editing. */
  actions?: React.ReactNode;
  flags?: React.ReactNode;
  view: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div className="flex min-h-7 items-center justify-between gap-2">
        {heading}
        {editing ? null : (
          <span className="flex items-center gap-1">
            {actions}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${title}`}
              className={cn(
                "text-muted-foreground transition-opacity focus-visible:opacity-100",
                REVEAL_CLASSES[level],
              )}
            >
              <PencilIcon data-icon="inline-start" />
              Edit
            </Button>
          </span>
        )}
      </div>

      {flags}

      {editing ? (
        typeof edit === "function" ? (
          edit({ latest: view, onDone: () => setEditing(false) })
        ) : (
          <SectionEditor edit={edit} latest={view} onDone={() => setEditing(false)} />
        )
      ) : (
        view
      )}
    </>
  );
}
