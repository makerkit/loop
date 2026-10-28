import type { StoryComplexity, StoryPriority, UserStory } from "@makerkit/prd";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";

import { MarkdownEditor } from "#/components/editor/markdown-editor";
import { usePrdEdit } from "#/components/prds/prd-edit-context";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { NativeSelect, NativeSelectOption } from "#/components/ui/native-select";
import {
  formCriteria,
  readStoryForm,
  storyChanges,
  validateStoryForm,
  type StoryForm,
  type StoryFormErrors,
} from "#/lib/stories/story-edit";
import { editStory } from "#/lib/stories/stories.functions";

import { ProofEditor } from "./proof-editor";
import { StoryPicker } from "./story-picker";

const PRIORITIES: StoryPriority[] = ["P0", "P1", "P2", "P3"];
const COMPLEXITIES: StoryComplexity[] = ["XS", "S", "M", "L", "XL"];

const CONFLICT_MESSAGE =
  "The PRD changed while you were editing, so nothing was saved. The latest version is loaded; save again to apply your changes on top of it.";

/**
 * Edits a story in place: title, user story, acceptance criteria and their
 * proofs, test seams, priority, complexity, dependencies and phase. Saves only the fields
 * that changed, in one update_user_story write based on the loaded revision.
 */
export function StoryEditor({ story, onDone }: { story: UserStory; onDone: () => void }) {
  const { filename, prd } = usePrdEdit();
  const router = useRouter();
  const save = useServerFn(editStory);
  const id = useId();

  const [original] = useState(() => readStoryForm(story, prd));
  const [form, setForm] = useState<StoryForm>(original);
  const [errors, setErrors] = useState<StoryFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // After a conflict, the next save is based on the latest revision
  const [baseRevision, setBaseRevision] = useState<number | null>(prd.metadata.revision ?? 0);

  const set = <K extends keyof StoryForm>(key: K, value: StoryForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const agentMayBeWorking = story.status === "in_progress" || story.status === "review";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found = validateStoryForm(form);

    setErrors(found);
    setFormError(null);

    if (Object.keys(found).length > 0) {
      return;
    }

    setSaving(true);

    try {
      const result = await save({
        data: {
          filename,
          storyId: story.id,
          changes: storyChanges(original, form),
          expectedRevision: baseRevision ?? prd.metadata.revision ?? 0,
        },
      });

      await router.invalidate();

      if (result.status === "edited") {
        onDone();
      } else if (result.status === "conflict") {
        setFormError(CONFLICT_MESSAGE);
        setBaseRevision(null);
      } else if (result.status === "refused") {
        setFormError(result.message);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save the story.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {agentMayBeWorking ? (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Your agent may be working on this story</AlertTitle>
          <AlertDescription>
            It is {story.status === "review" ? "in review" : "in progress"}. Changes apply the next
            time the agent reads the story.
          </AlertDescription>
        </Alert>
      ) : null}

      <Field data-invalid={errors.title ? true : undefined}>
        <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
        <Input
          id={`${id}-title`}
          value={form.title}
          aria-invalid={errors.title ? true : undefined}
          onChange={(event) => set("title", event.target.value)}
        />
        {errors.title ? <FieldError>{errors.title}</FieldError> : null}
      </Field>

      <fieldset className="grid gap-2" aria-invalid={errors.userStory ? true : undefined}>
        <legend className="mb-2 text-sm font-medium">User story</legend>
        <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <label htmlFor={`${id}-who`} className="text-sm text-muted-foreground">
            As a
          </label>
          <Input
            id={`${id}-who`}
            value={form.userType}
            onChange={(event) => set("userType", event.target.value)}
          />
          <label htmlFor={`${id}-what`} className="text-sm text-muted-foreground">
            I want to
          </label>
          <Input
            id={`${id}-what`}
            value={form.action}
            onChange={(event) => set("action", event.target.value)}
          />
          <label htmlFor={`${id}-why`} className="text-sm text-muted-foreground">
            so that
          </label>
          <Input
            id={`${id}-why`}
            value={form.benefit}
            onChange={(event) => set("benefit", event.target.value)}
          />
        </div>
        {errors.userStory ? <FieldError>{errors.userStory}</FieldError> : null}
      </fieldset>

      <Field data-invalid={errors.acceptanceCriteria ? true : undefined}>
        <FieldLabel id={`${id}-criteria-label`}>Acceptance criteria</FieldLabel>
        <MarkdownEditor
          mode="list"
          name="Format acceptance criteria"
          labelledBy={`${id}-criteria-label`}
          value={form.acceptanceCriteria}
          onChange={(value) => set("acceptanceCriteria", value)}
          placeholder="Add a criterion"
          invalid={Boolean(errors.acceptanceCriteria)}
        />
        {errors.acceptanceCriteria ? <FieldError>{errors.acceptanceCriteria}</FieldError> : null}
      </Field>

      <ProofEditor
        criteria={formCriteria(form)}
        proofs={form.proofs}
        error={errors.proofs}
        onChange={(value) => set("proofs", value)}
      />

      <Field>
        <FieldLabel id={`${id}-seams-label`}>Where it is tested</FieldLabel>
        <MarkdownEditor
          mode="list"
          name="Format test seams"
          labelledBy={`${id}-seams-label`}
          value={form.testSeams}
          onChange={(value) => set("testSeams", value)}
          placeholder="Add a route, server function or service"
        />
      </Field>

      <Field>
        <FieldLabel id={`${id}-design-label`}>Design notes</FieldLabel>
        <MarkdownEditor
          mode="list"
          name="Format design notes"
          labelledBy={`${id}-design-label`}
          value={form.designNotes}
          onChange={(value) => set("designNotes", value)}
          placeholder="Add a layout, state or copy detail for this story"
        />
        <FieldDescription>
          Only what the PRD's design guidance doesn't already cover.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel id={`${id}-security-label`}>Security notes</FieldLabel>
        <MarkdownEditor
          mode="list"
          name="Format security notes"
          labelledBy={`${id}-security-label`}
          value={form.securityNotes}
          onChange={(value) => set("securityNotes", value)}
          placeholder="Add a way this story could be abused, and the defence"
        />
        <FieldDescription>
          Only what the PRD's security considerations don't already cover.
        </FieldDescription>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor={`${id}-priority`}>Priority</FieldLabel>
          <NativeSelect
            id={`${id}-priority`}
            value={form.priority}
            onChange={(event) => set("priority", event.target.value as StoryPriority)}
          >
            {PRIORITIES.map((priority) => (
              <NativeSelectOption key={priority} value={priority}>
                {priority}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-complexity`}>Complexity</FieldLabel>
          <NativeSelect
            id={`${id}-complexity`}
            value={form.estimatedComplexity}
            onChange={(event) => set("estimatedComplexity", event.target.value as StoryComplexity)}
          >
            {COMPLEXITIES.map((complexity) => (
              <NativeSelectOption key={complexity} value={complexity}>
                {complexity}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-phase`}>Phase</FieldLabel>
          <NativeSelect
            id={`${id}-phase`}
            value={form.phaseId ?? ""}
            onChange={(event) => set("phaseId", event.target.value || null)}
          >
            <NativeSelectOption value="">Not in a phase</NativeSelectOption>
            {[...prd.customPhases]
              .sort((a, b) => a.order - b.order)
              .map((phase) => (
                <NativeSelectOption key={phase.id} value={phase.id}>
                  {phase.name}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor={`${id}-dependencies`}>Depends on</FieldLabel>
        <StoryPicker
          id={`${id}-dependencies`}
          value={form.dependencies}
          onChange={(value) => set("dependencies", value)}
          exclude={[story.id]}
          placeholder="Search stories this one needs first"
        />
        <FieldDescription>
          Stories that must be completed before this one can start.
        </FieldDescription>
      </Field>

      {formError ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save story"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
