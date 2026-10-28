import type { ProofKind } from "@makerkit/prd";
import { useId } from "react";

import { Markdown } from "#/components/markdown";
import { FieldDescription, FieldError } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { NativeSelect, NativeSelectOption } from "#/components/ui/native-select";
import { Textarea } from "#/components/ui/textarea";
import { PROOF_KIND_LABELS } from "#/lib/stories/proofs";
import { EMPTY_PROOF, PROOF_FIELDS, type ProofForm } from "#/lib/stories/story-edit";

const KINDS = Object.keys(PROOF_KIND_LABELS) as ProofKind[];

const PLACEHOLDERS: Record<Exclude<keyof ProofForm, "kind">, string> = {
  seam: "The route, server function or service the test calls",
  reason: "Why a test can't prove it here",
  fallback: "What is still tested automatically",
  rubric: "One point per line the review agent checks",
};

/**
 * How each acceptance criterion is proven, one row per criterion as the form
 * has them now. A proof belongs to a criterion's text: rewording a criterion
 * leaves it without one.
 */
export function ProofEditor({
  criteria,
  proofs,
  error,
  onChange,
}: {
  criteria: string[];
  proofs: Record<string, ProofForm>;
  error?: string;
  onChange: (proofs: Record<string, ProofForm>) => void;
}) {
  const id = useId();

  if (criteria.length === 0) {
    return null;
  }

  const update = (criterion: string, change: Partial<ProofForm>) =>
    onChange({ ...proofs, [criterion]: { ...(proofs[criterion] ?? EMPTY_PROOF), ...change } });

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">How each criterion is proven</legend>
      <FieldDescription>
        Prefer a test at the lowest level that can check it. Choose a check by you only when the
        truth lives outside the tests: a real outside service, production, or your judgment.
      </FieldDescription>
      <ol className="grid gap-3">
        {criteria.map((criterion, index) => {
          const proof = proofs[criterion] ?? EMPTY_PROOF;
          const fields = proof.kind ? PROOF_FIELDS[proof.kind] : [];
          const kindId = `${id}-${index}-kind`;

          return (
            <li key={criterion} className="grid gap-2 rounded-lg border px-3 py-2">
              <label htmlFor={kindId} className="text-sm">
                <Markdown text={criterion} inline />
              </label>
              <NativeSelect
                id={kindId}
                value={proof.kind}
                onChange={(event) => update(criterion, { kind: event.target.value as ProofKind })}
              >
                <NativeSelectOption value="">Not said</NativeSelectOption>
                {KINDS.map((kind) => (
                  <NativeSelectOption key={kind} value={kind}>
                    {PROOF_KIND_LABELS[kind]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {fields.map((field) =>
                field === "rubric" ? (
                  <Textarea
                    key={field}
                    aria-label={`Rubric for: ${criterion}`}
                    value={proof.rubric}
                    onChange={(event) => update(criterion, { rubric: event.target.value })}
                    placeholder={PLACEHOLDERS.rubric}
                    className="min-h-16"
                  />
                ) : (
                  <Input
                    key={field}
                    aria-label={`${PLACEHOLDERS[field]}: ${criterion}`}
                    value={proof[field]}
                    onChange={(event) => update(criterion, { [field]: event.target.value })}
                    placeholder={PLACEHOLDERS[field]}
                  />
                ),
              )}
            </li>
          );
        })}
      </ol>
      {error ? <FieldError>{error}</FieldError> : null}
    </fieldset>
  );
}
