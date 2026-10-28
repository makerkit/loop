import type {
  CriterionProof,
  ProofKind,
  StoryComplexity,
  StoryPriority,
  StructuredPRD,
  UserStory,
} from "@makerkit/prd";

/**
 * The story editor's form values, and the update_user_story changes they
 * make. Pure, shared by the editor and its tests.
 */

/** A criterion's proof as the editor holds it; text fields, one rubric point per line. */
export interface ProofForm {
  kind: ProofKind | "";
  seam: string;
  reason: string;
  fallback: string;
  rubric: string;
}

export const EMPTY_PROOF: ProofForm = { kind: "", seam: "", reason: "", fallback: "", rubric: "" };

/** Which fields each kind of proof uses. */
export const PROOF_FIELDS: Record<ProofKind, Array<Exclude<keyof ProofForm, "kind">>> = {
  unit: ["seam"],
  integration: ["seam"],
  e2e: ["seam", "reason"],
  judge: ["rubric"],
  manual: ["reason", "fallback"],
  "post-deploy": ["reason", "fallback"],
};

export interface StoryForm {
  title: string;
  userType: string;
  action: string;
  benefit: string;
  /** One item per line, as the list editor produces. */
  acceptanceCriteria: string;
  /** Keyed by criterion text: a proof belongs to the criterion as written. */
  proofs: Record<string, ProofForm>;
  testSeams: string;
  designNotes: string;
  securityNotes: string;
  priority: StoryPriority;
  estimatedComplexity: StoryComplexity;
  dependencies: string[];
  phaseId: string | null;
}

export interface StoryChanges {
  title?: string;
  userType?: string;
  action?: string;
  benefit?: string;
  acceptanceCriteria?: string[];
  proofs?: CriterionProof[];
  testSeams?: string[];
  designNotes?: string[];
  securityNotes?: string[];
  priority?: StoryPriority;
  estimatedComplexity?: StoryComplexity;
  dependencies?: string[];
  phaseId?: string | null;
}

// Same as @makerkit/prd's splitUserStory (kept in sync by a test)
const USER_STORY_SENTENCE = /^As an?\s+(.+?),\s*I want to\s+(.+?)\s+so that\s+(.+)$/i;

export function splitUserStory(sentence: string) {
  const match = USER_STORY_SENTENCE.exec(sentence.trim());

  return match ? { userType: match[1]!, action: match[2]!, benefit: match[3]! } : undefined;
}

const lines = (items: string[] | undefined) => (items ?? []).join("\n");
const items = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

export function readStoryForm(story: UserStory, prd: StructuredPRD): StoryForm {
  const parts = splitUserStory(story.userStory) ?? { userType: "", action: "", benefit: "" };

  return {
    title: story.title,
    ...parts,
    acceptanceCriteria: lines(story.acceptanceCriteria),
    proofs: Object.fromEntries(
      (story.proofs ?? []).map((proof) => [
        proof.criterion.trim(),
        {
          kind: proof.kind,
          seam: proof.seam ?? "",
          reason: proof.reason ?? "",
          fallback: proof.fallback ?? "",
          rubric: lines(proof.rubric),
        },
      ]),
    ),
    testSeams: lines(story.testSeams),
    designNotes: lines(story.designNotes),
    securityNotes: lines(story.securityNotes),
    priority: story.priority,
    estimatedComplexity: story.estimatedComplexity,
    dependencies: [...story.dependencies],
    phaseId: prd.customPhases.find((phase) => phase.userStoryIds.includes(story.id))?.id ?? null,
  };
}

export interface StoryFormErrors {
  title?: string;
  userStory?: string;
  acceptanceCriteria?: string;
  proofs?: string;
}

/** The criteria as the form has them, in order. */
export function formCriteria(form: StoryForm) {
  return items(form.acceptanceCriteria);
}

/** The proofs to save: one per current criterion that has a kind, with only the fields its kind uses. */
export function proofList(form: StoryForm): CriterionProof[] {
  return formCriteria(form).flatMap((criterion) => {
    const proof = form.proofs[criterion];

    if (!proof?.kind) return [];

    const fields = PROOF_FIELDS[proof.kind];
    const text = (key: "seam" | "reason" | "fallback") =>
      fields.includes(key) && proof[key].trim() ? { [key]: proof[key].trim() } : {};
    const rubric = fields.includes("rubric") ? items(proof.rubric) : [];

    return [
      {
        criterion,
        kind: proof.kind,
        ...text("seam"),
        ...text("reason"),
        ...text("fallback"),
        ...(rubric.length > 0 ? { rubric } : {}),
      },
    ];
  });
}

/** Checks done before saving; PrdService checks dependencies (cycles, unknown stories). */
export function validateStoryForm(form: StoryForm): StoryFormErrors {
  const errors: StoryFormErrors = {};
  const parts = [form.userType, form.action, form.benefit].map((part) => part.trim());

  if (!form.title.trim()) {
    errors.title = "Title can't be empty.";
  }

  if (parts.some(Boolean) && !parts.every(Boolean)) {
    errors.userStory = "Fill in all three parts: who, what they want, and why.";
  }

  if (items(form.acceptanceCriteria).length === 0) {
    errors.acceptanceCriteria = "Add at least one acceptance criterion.";
  }

  for (const proof of proofList(form)) {
    if ((proof.kind === "manual" || proof.kind === "post-deploy") && !proof.reason) {
      errors.proofs ??= `Say why no test can prove "${proof.criterion}".`;
    }

    if (proof.kind === "judge" && !proof.rubric?.length) {
      errors.proofs ??= `Add a rubric the review agent scores "${proof.criterion}" against.`;
    }
  }

  return errors;
}

/** Only what changed, so a save never rewrites fields the user did not touch. */
export function storyChanges(original: StoryForm, form: StoryForm): StoryChanges {
  const changes: StoryChanges = {};

  if (form.title.trim() !== original.title) changes.title = form.title.trim();

  const parts = {
    userType: form.userType.trim(),
    action: form.action.trim(),
    benefit: form.benefit.trim(),
  };

  if (
    parts.userType &&
    parts.action &&
    parts.benefit &&
    (parts.userType !== original.userType ||
      parts.action !== original.action ||
      parts.benefit !== original.benefit)
  ) {
    // The package needs all three together when the stored sentence is not in the usual form
    Object.assign(changes, parts);
  }

  if (!same(items(form.acceptanceCriteria), items(original.acceptanceCriteria))) {
    changes.acceptanceCriteria = items(form.acceptanceCriteria);
  }

  if (JSON.stringify(proofList(form)) !== JSON.stringify(proofList(original))) {
    changes.proofs = proofList(form);
  }

  if (!same(items(form.testSeams), items(original.testSeams))) {
    changes.testSeams = items(form.testSeams);
  }

  if (!same(items(form.designNotes), items(original.designNotes))) {
    changes.designNotes = items(form.designNotes);
  }

  if (!same(items(form.securityNotes), items(original.securityNotes))) {
    changes.securityNotes = items(form.securityNotes);
  }

  if (form.priority !== original.priority) changes.priority = form.priority;
  if (form.estimatedComplexity !== original.estimatedComplexity) {
    changes.estimatedComplexity = form.estimatedComplexity;
  }

  if (!same([...form.dependencies].sort(), [...original.dependencies].sort())) {
    changes.dependencies = form.dependencies;
  }

  if (form.phaseId !== original.phaseId) changes.phaseId = form.phaseId;

  return changes;
}
