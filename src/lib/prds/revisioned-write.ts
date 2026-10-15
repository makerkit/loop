import type { OpenQuestion } from "@makerkit/prd";

export type RevisionedWriteResult = { status: "saved" } | { status: "conflict" };

/**
 * Runs a PrdService write that carries the revision the user loaded. A
 * revision conflict is a result, so the UI can reload and say so; other
 * failures throw. Matches the error by code: no runtime import of @makerkit/prd.
 */
export async function revisionedWrite(
  write: () => Promise<unknown>,
): Promise<RevisionedWriteResult> {
  try {
    await write();

    return { status: "saved" };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "PRD_REVISION_CONFLICT"
    ) {
      return { status: "conflict" };
    }

    throw error;
  }
}

export interface NewQuestion {
  question: string;
  why?: string;
  options?: string[];
  recommended?: string;
  storyIds?: string[];
}

/** The openQuestions value with a new question added; existing ones keep their ids. */
export function withNewQuestion(existing: OpenQuestion[], draft: NewQuestion) {
  const options = (draft.options ?? []).map((option) => option.trim()).filter(Boolean);

  return [
    ...existing,
    {
      question: draft.question.trim(),
      ...(draft.why?.trim() ? { why: draft.why.trim() } : {}),
      ...(options.length ? { options } : {}),
      ...(draft.recommended?.trim() ? { recommended: draft.recommended.trim() } : {}),
      ...(draft.storyIds?.length ? { storyIds: draft.storyIds } : {}),
    },
  ];
}

/** The openQuestions value without one question; the others keep their ids. */
export function withoutQuestion(existing: OpenQuestion[], questionId: string) {
  return existing.filter((question) => question.id !== questionId);
}
