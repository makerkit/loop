import { Markdown } from "#/components/markdown";

import { SectionFlags } from "./document-flags";
import {
  NotApplicableAction,
  NotApplicableBody,
  useSectionApplicability,
} from "./section-applicability";
import { cn } from "#/lib/utils";

/** Building blocks of the PRD document view. */

/** Shared with EditableSection so editable and read-only sections look the same. */
export const SECTION_CLASS = "group/section grid gap-3 border-t pt-8 first:border-t-0 first:pt-0";
export const SECTION_TITLE_CLASS = "text-lg font-semibold tracking-tight";
export const SUBSECTION_CLASS = "group/subsection grid gap-2";
/** On devices with a mouse, section actions (Edit, N/A) show when the section is hovered or focused. */
export const SECTION_ACTION_REVEAL =
  "focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/section:opacity-100 [@media(hover:hover)]:group-focus-within/section:opacity-100 data-[popup-open]:opacity-100";
export const SUBSECTION_TITLE_CLASS =
  "text-xs font-medium tracking-wider text-muted-foreground uppercase";

export function DocumentSection({
  id,
  title,
  isEmpty = false,
  children,
}: {
  id: string;
  title: string;
  isEmpty?: boolean;
  children?: React.ReactNode;
}) {
  const { reason } = useSectionApplicability(id);

  return (
    <section id={id} aria-labelledby={`${id}-title`} className={SECTION_CLASS}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h2 id={`${id}-title`} className={SECTION_TITLE_CLASS}>
          {title}
        </h2>
        <NotApplicableAction sectionId={id} title={title} className={SECTION_ACTION_REVEAL} />
      </div>
      {reason !== null ? (
        <NotApplicableBody sectionId={id} />
      ) : (
        <>
          <SectionFlags sectionId={id} />
          {isEmpty ? <NotWrittenYet /> : children}
        </>
      )}
    </section>
  );
}

/** A labelled part inside a section, e.g. "Target users" under Problem. */
export function DocumentSubsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={SUBSECTION_CLASS}>
      <h3 className={SUBSECTION_TITLE_CLASS}>{title}</h3>
      {children}
    </div>
  );
}

export function BulletList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul
      className={cn(
        "grid list-disc gap-1.5 pl-5 text-[15px] leading-7 marker:text-muted-foreground",
        className,
      )}
    >
      {items.map((item, index) => (
        <li key={index}>
          <Markdown text={item} inline />
        </li>
      ))}
    </ul>
  );
}

/** A list under a heading, left out when empty. */
export function OptionalList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <DocumentSubsection title={title}>
      <BulletList items={items} />
    </DocumentSubsection>
  );
}

/** Block Markdown under an optional heading, left out when empty. */
export function OptionalText({ title, text }: { title?: string; text: string }) {
  if (!text.trim()) {
    return null;
  }

  const content = <Markdown text={text} />;

  return title ? <DocumentSubsection title={title}>{content}</DocumentSubsection> : content;
}

export function NotWrittenYet() {
  return <p className="text-sm text-muted-foreground italic">Not written yet.</p>;
}
