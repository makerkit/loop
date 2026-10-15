import { useId, useState } from "react";

import { MarkdownEditor } from "#/components/editor/markdown-editor";
import { Button } from "#/components/ui/button";
import { Field, FieldError, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import {
  buildSectionValue,
  parseSectionErrors,
  readEditValues,
  type SectionEdit,
  type SectionEditErrors,
} from "#/lib/prds/section-edits";

import { usePrdEdit } from "./prd-edit-context";
import { ConflictNotice, useSectionSave } from "./use-section-save";

const NO_ERRORS: SectionEditErrors = { fields: {}, form: [] };

/**
 * Edits one PRD section in place. Saves through update_prd_section with the
 * revision the user started from; if the PRD changed elsewhere meanwhile,
 * nothing is saved, the latest version is loaded and the user is told.
 */
export function SectionEditor({
  edit,
  latest,
  onDone,
}: {
  edit: SectionEdit;
  /** The section as currently saved, shown after a conflict. */
  latest: React.ReactNode;
  onDone: () => void;
}) {
  const { prd } = usePrdEdit();
  const { submit, saving, conflict } = useSectionSave(edit.section);
  const formId = useId();

  const [values, setValues] = useState(() => readEditValues(edit, prd));
  const [errors, setErrors] = useState(NO_ERRORS);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors(NO_ERRORS);

    const outcome = await submit(buildSectionValue(edit, values));

    if (outcome.status === "saved") {
      onDone();
    } else if (outcome.status === "invalid") {
      setErrors(parseSectionErrors(edit, outcome.message));
    } else if (outcome.status === "error") {
      setErrors({ fields: {}, form: [outcome.message] });
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border bg-muted/20 p-3" noValidate>
      {conflict ? <ConflictNotice latest={latest} /> : null}

      {edit.fields.map((field) => {
        const id = `${formId}-${field.key}`;
        const labelId = `${id}-label`;
        const error = errors.fields[field.key];
        const setValue = (value: string) =>
          setValues((current) => ({ ...current, [field.key]: value }));

        return (
          <Field key={field.key} data-invalid={error ? true : undefined}>
            <FieldLabel
              id={labelId}
              htmlFor={id}
              // A single field repeats the section heading above it: keep it for screen readers only
              className={edit.fields.length === 1 ? "sr-only" : undefined}
            >
              {field.label}
            </FieldLabel>
            {field.kind === "line" ? (
              <Input
                id={id}
                value={values[field.key] ?? ""}
                aria-invalid={error ? true : undefined}
                onChange={(event) => setValue(event.target.value)}
              />
            ) : (
              <MarkdownEditor
                mode={field.kind}
                id={id}
                labelledBy={labelId}
                name={field.label}
                value={values[field.key] ?? ""}
                onChange={setValue}
                placeholder={
                  field.placeholder ?? (field.kind === "list" ? "Add an item" : undefined)
                }
                invalid={Boolean(error)}
              />
            )}
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        );
      })}

      {errors.form.length > 0 ? (
        <FieldError>
          {errors.form.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </FieldError>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
