import type { Attachment, UserStory } from "@makerkit/prd";
import { DownloadIcon, ExternalLinkIcon, FileIcon, FileWarningIcon } from "lucide-react";
import { createContext, useContext } from "react";

import { Markdown } from "#/components/markdown";

import { AttachmentActions } from "./attachment-editors";
import { attachmentKind } from "#/lib/prds/attachment-file";
import { attachmentUrl, isHttpUrl } from "#/lib/prds/prd-paths";

/** Ids of file attachments whose file is missing (checked on the server). */
const MissingAttachmentsContext = createContext<ReadonlySet<string>>(new Set());

export const MissingAttachmentsProvider = MissingAttachmentsContext.Provider;

/**
 * A PRD's attachments: images previewed, other files and links opened in a
 * new tab (or downloaded), missing files shown as missing.
 */
export function AttachmentList({
  filename,
  attachments,
  stories = [],
  editable = false,
}: {
  filename: string;
  attachments: Attachment[];
  /** Show Edit and Remove on each card (the document view). */
  editable?: boolean;
  /** To show which stories use each attachment. */
  stories?: UserStory[];
}) {
  const missing = useContext(MissingAttachmentsContext);

  return (
    <ul className="grid items-start gap-3 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <AttachmentCard
            filename={filename}
            attachment={attachment}
            missing={missing.has(attachment.id)}
            editable={editable}
            usedBy={stories
              .filter((story) => story.attachmentIds?.includes(attachment.id))
              .map((story) => story.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function AttachmentCard({
  filename,
  attachment,
  missing,
  usedBy,
  editable,
}: {
  filename: string;
  attachment: Attachment;
  missing: boolean;
  usedBy: string[];
  editable: boolean;
}) {
  const link = attachment.url && isHttpUrl(attachment.url) ? attachment.url : null;
  const path = attachment.path ?? null;
  const kind = path ? attachmentKind(path) : null;
  const href = link ?? (path && !missing ? attachmentUrl(filename, path) : null);

  return (
    <div className="grid content-start gap-2 overflow-hidden rounded-lg border bg-background text-sm">
      {kind?.isImage && href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block border-b bg-muted/40"
        >
          <img
            src={href}
            alt={attachment.title}
            loading="lazy"
            className="mx-auto max-h-48 w-full object-contain"
          />
        </a>
      ) : null}

      <div className="grid gap-1 px-3 pb-3 first:pt-3 [&:not(:first-child)]:pt-0">
        <span className="flex items-start gap-2">
          {missing ? (
            <FileWarningIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          ) : link ? (
            <ExternalLinkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-4 hover:underline"
            >
              {attachment.title}
            </a>
          ) : (
            <span className="font-medium">{attachment.title}</span>
          )}
          {href && kind?.disposition === "attachment" ? (
            <DownloadIcon
              aria-label="Downloads"
              className="mt-0.5 ml-auto size-3.5 shrink-0 text-muted-foreground"
            />
          ) : null}
        </span>

        {missing ? (
          <span className="text-xs text-destructive">
            Missing file: <span className="font-mono">{path}</span>
          </span>
        ) : path ? (
          <span className="truncate font-mono text-xs text-muted-foreground" title={path}>
            {path}
          </span>
        ) : link ? (
          <span className="truncate text-xs text-muted-foreground" title={link}>
            {new URL(link).host}
          </span>
        ) : null}

        {attachment.note ? (
          <span className="text-muted-foreground">
            <Markdown text={attachment.note} inline />
          </span>
        ) : null}

        {usedBy.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            Used by <span className="font-mono">{usedBy.join(", ")}</span>
          </span>
        ) : null}
      </div>
      {editable ? <AttachmentActions attachment={attachment} usedBy={usedBy} /> : null}
    </div>
  );
}
