import { createContext, useContext } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "#/lib/utils";
import { isHttpUrl, resolveImageSrc } from "#/lib/prds/prd-paths";

/** The PRD file whose attachments folder Markdown images may load from. */
const PrdFileContext = createContext<string | null>(null);

export const PrdFileProvider = PrdFileContext.Provider;

/** Inline Markdown only: what list items (criteria, non-goals...) may use. */
const INLINE_ELEMENTS = ["strong", "em", "del", "code", "a", "img", "br"];

/**
 * Renders Markdown from PRD text safely:
 * - raw HTML is dropped, never rendered
 * - links are clickable only for http(s) URLs, and open in a new tab
 * - images load only from the PRD's attachments folder; others show their alt text
 */
export function Markdown({
  text,
  inline = false,
  className,
}: {
  text: string;
  /** Render inside a line (e.g. a list item): block elements are unwrapped. */
  inline?: boolean;
  className?: string;
}) {
  const filename = useContext(PrdFileContext);

  const components: Components = {
    a: ({ href, children }) =>
      href && isHttpUrl(href) ? (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
          {children}
        </a>
      ) : (
        <span>{children}</span>
      ),
    img: ({ src, alt }) => {
      const url = typeof src === "string" && filename ? resolveImageSrc(src, filename) : null;

      return url ? (
        <img src={url} alt={alt ?? ""} loading="lazy" className="max-w-full rounded-md border" />
      ) : (
        <span className="text-muted-foreground">{alt ? `[${alt}]` : "[image]"}</span>
      );
    },
  };

  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      // Links and images are checked in `components`; keep the original URL
      urlTransform={(url) => url}
      components={components}
      allowedElements={inline ? INLINE_ELEMENTS : undefined}
      unwrapDisallowed={inline}
    >
      {text}
    </ReactMarkdown>
  );

  if (inline) {
    return <span className={className}>{markdown}</span>;
  }

  return (
    <div
      className={cn(
        "prose prose-neutral max-w-none text-[15px] leading-7 [--tw-prose-body:var(--color-foreground)] dark:prose-invert prose-p:my-3 prose-a:font-normal prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none [&>:first-child]:mt-0 [&>:last-child]:mb-0",
        className,
      )}
    >
      {markdown}
    </div>
  );
}
