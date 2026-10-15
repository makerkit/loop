import type { Attachment, UserStory } from "@makerkit/prd";
import { useServerFn } from "@tanstack/react-start";
import { LinkIcon, PencilIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { StoryPicker } from "#/components/stories/story-picker";
import { Button } from "#/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { MAX_UPLOAD_BYTES, titleFromFileName } from "#/lib/prds/attachment-upload";
import {
  addAttachmentLink,
  editAttachment,
  removeAttachmentFn,
  uploadAttachment,
} from "#/lib/prds/attachments.functions";
import { cn } from "#/lib/utils";

import { usePrdEdit } from "./prd-edit-context";
import { usePrdWrite } from "./use-prd-write";

type WriteResult = Awaited<ReturnType<typeof editAttachment>>;

/** Turns an attachment write result into what usePrdWrite expects (errors thrown to show). */
function toWrite(result: WriteResult) {
  if (result.status === "invalid") {
    throw new Error(result.message);
  }

  return result;
}

/** Edit (title, note, stories) and Remove, on an attachment card. */
export function AttachmentActions({
  attachment,
  usedBy,
}: {
  attachment: Attachment;
  usedBy: string[];
}) {
  const edit = useServerFn(editAttachment);
  const remove = useServerFn(removeAttachmentFn);
  const { run, pending, error } = usePrdWrite();
  const id = useId();
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  const [title, setTitle] = useState(attachment.title);
  const [note, setNote] = useState(attachment.note ?? "");
  const [storyIds, setStoryIds] = useState(usedBy);

  if (mode === "remove") {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs">
        <span className="flex-1">Remove this attachment? The file stays in the PRD's folder.</span>
        <Button
          variant="destructive"
          size="xs"
          disabled={pending}
          onClick={() =>
            void run(async (base) =>
              toWrite(await remove({ data: { ...base, attachmentId: attachment.id } })),
            )
          }
        >
          {pending ? "Removing…" : "Remove"}
        </Button>
        <Button variant="ghost" size="xs" onClick={() => setMode("view")}>
          Cancel
        </Button>
        {error ? <span className="w-full text-destructive">{error}</span> : null}
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <form
        className="grid gap-3 border-t bg-muted/20 p-3"
        onSubmit={async (event) => {
          event.preventDefault();

          const saved = await run(async (base) =>
            toWrite(
              await edit({ data: { ...base, attachmentId: attachment.id, title, note, storyIds } }),
            ),
          );

          if (saved) setMode("view");
        }}
      >
        <Field>
          <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
          <Input
            id={`${id}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-note`}>Note</FieldLabel>
          <Input
            id={`${id}-note`}
            value={note}
            placeholder="What to take from it, e.g. Layout only"
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-stories`}>Used by</FieldLabel>
          <StoryPicker id={`${id}-stories`} value={storyIds} onChange={setStoryIds} />
        </Field>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={!title.trim() || pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setMode("view")}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex gap-1 border-t px-2 py-1">
      <Button
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        onClick={() => setMode("edit")}
      >
        <PencilIcon data-icon="inline-start" />
        Edit
      </Button>
      <Button
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        onClick={() => setMode("remove")}
      >
        <Trash2Icon data-icon="inline-start" />
        Remove
      </Button>
    </div>
  );
}

/**
 * "Add a file" (drop or pick) and "Add a link", under the attachment list.
 * `storyIds` preselects the stories that use it, e.g. the story being viewed.
 */
export function AddAttachment({
  stories,
  storyIds = [],
}: {
  stories: UserStory[];
  storyIds?: string[];
}) {
  const [mode, setMode] = useState<"closed" | "file" | "link">("closed");

  if (mode === "closed") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setMode("file")}>
          <UploadIcon data-icon="inline-start" />
          Add a file
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMode("link")}>
          <LinkIcon data-icon="inline-start" />
          Add a link
        </Button>
      </div>
    );
  }

  return mode === "file" ? (
    <AddFileForm
      onDone={() => setMode("closed")}
      hasStories={stories.length > 0}
      initialStoryIds={storyIds}
    />
  ) : (
    <AddLinkForm
      onDone={() => setMode("closed")}
      hasStories={stories.length > 0}
      initialStoryIds={storyIds}
    />
  );
}

function AddFileForm({
  onDone,
  hasStories,
  initialStoryIds,
}: {
  onDone: () => void;
  hasStories: boolean;
  initialStoryIds: string[];
}) {
  const { filename } = usePrdEdit();
  const upload = useServerFn(uploadAttachment);
  const { run, pending, error } = usePrdWrite();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [storyIds, setStoryIds] = useState(initialStoryIds);
  const [dragging, setDragging] = useState(false);
  const tooLarge = file !== null && file.size > MAX_UPLOAD_BYTES;

  const choose = (next: File | undefined) => {
    if (!next) return;
    setFile(next);
    setTitle((current) => current || titleFromFileName(next.name));
  };

  return (
    <form
      className="grid gap-3 rounded-lg border bg-muted/20 p-3"
      onSubmit={async (event) => {
        event.preventDefault();

        if (!file || tooLarge) return;

        const saved = await run(async (base) => {
          const data = new FormData();

          data.set("file", file);
          data.set("filename", filename);
          data.set("title", title);
          data.set("note", note);
          data.set("storyIds", JSON.stringify(storyIds));
          data.set("expectedRevision", String(base.expectedRevision));

          return toWrite(await upload({ data }));
        });

        if (saved) onDone();
      }}
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files[0]);
        }}
        className={cn(
          "grid place-items-center gap-1 rounded-lg border border-dashed bg-background px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/40",
          dragging && "border-foreground bg-muted/40",
        )}
      >
        <UploadIcon className="size-5" />
        {file ? (
          <span className="font-medium text-foreground">{file.name}</span>
        ) : (
          <span>Drop a file here, or click to choose one</span>
        )}
        <span className="text-xs">
          Images, PDFs and text, up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB
        </span>
      </button>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => choose(event.target.files?.[0])}
      />

      {tooLarge ? (
        <p className="text-xs text-destructive">This file is larger than 20 MB.</p>
      ) : null}

      <Field>
        <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-note`}>Note</FieldLabel>
        <Input
          id={`${id}-note`}
          value={note}
          placeholder="What to take from it, e.g. Layout only; colours are placeholders"
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      {hasStories ? (
        <Field>
          <FieldLabel htmlFor={`${id}-stories`}>Used by</FieldLabel>
          <StoryPicker id={`${id}-stories`} value={storyIds} onChange={setStoryIds} />
          <FieldDescription>The agent sees it when it works on these stories.</FieldDescription>
        </Field>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!file || tooLarge || !title.trim() || pending}>
          {pending ? "Uploading…" : "Add file"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AddLinkForm({
  onDone,
  hasStories,
  initialStoryIds,
}: {
  onDone: () => void;
  hasStories: boolean;
  initialStoryIds: string[];
}) {
  const add = useServerFn(addAttachmentLink);
  const { run, pending, error } = usePrdWrite();
  const id = useId();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [storyIds, setStoryIds] = useState(initialStoryIds);
  const validUrl = /^https?:\/\/\S+$/i.test(url.trim());

  return (
    <form
      className="grid gap-3 rounded-lg border bg-muted/20 p-3"
      onSubmit={async (event) => {
        event.preventDefault();

        const saved = await run(async (base) =>
          toWrite(await add({ data: { ...base, url: url.trim(), title, note, storyIds } })),
        );

        if (saved) onDone();
      }}
    >
      <Field>
        <FieldLabel htmlFor={`${id}-url`}>Link</FieldLabel>
        <Input
          id={`${id}-url`}
          value={url}
          placeholder="https://"
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={url && !validUrl ? true : undefined}
        />
        {url && !validUrl ? (
          <FieldDescription className="text-destructive">
            Use an http or https link.
          </FieldDescription>
        ) : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-note`}>Note</FieldLabel>
        <Input id={`${id}-note`} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {hasStories ? (
        <Field>
          <FieldLabel htmlFor={`${id}-stories`}>Used by</FieldLabel>
          <StoryPicker id={`${id}-stories`} value={storyIds} onChange={setStoryIds} />
        </Field>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!validUrl || !title.trim() || pending}>
          {pending ? "Adding…" : "Add link"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
