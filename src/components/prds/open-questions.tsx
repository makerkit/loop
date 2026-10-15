import type { OpenQuestion, UserStory } from "@makerkit/prd";
import { useServerFn } from "@tanstack/react-start";
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";

import { MarkdownEditor } from "#/components/editor/markdown-editor";
import { Markdown } from "#/components/markdown";
import { Button } from "#/components/ui/button";
import { Field, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { addOpenQuestion, answerOpenQuestion, deleteOpenQuestion } from "#/lib/prds/prds.functions";
import { cn } from "#/lib/utils";

import { StoryPicker } from "#/components/stories/story-picker";

import { usePrdEdit } from "./prd-edit-context";
import { usePrdWrite } from "./use-prd-write";

/**
 * Open questions as cards to answer. Answering records a decision and
 * removes the question (resolve_open_question); questions are rarely edited.
 */
/**
 * The Open questions section: the questions are answered in the "Waiting on
 * you" panel at the top of the page, so here they are only listed.
 */
export function OpenQuestions({ questions }: { questions: OpenQuestion[] }) {
  return (
    <div className="grid gap-3">
      {questions.length > 0 ? (
        <div className="grid gap-2 text-[15px]">
          <ul className="grid list-disc gap-1.5 pl-5 leading-7 marker:text-muted-foreground">
            {questions.map((question) => (
              <li key={question.id}>
                <span className="font-mono text-xs text-muted-foreground">{question.id}</span>{" "}
                <Markdown text={question.question} inline />
              </li>
            ))}
          </ul>
          <a
            href="#waiting-on-you"
            className="w-fit text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Answer them at the top of the page
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No open questions.</p>
      )}

      <AddQuestion />
    </div>
  );
}

/** The question cards, to answer. Shown in the "Waiting on you" panel. */
export function QuestionCards({ questions }: { questions: OpenQuestion[] }) {
  const { prd } = usePrdEdit();
  const stories = new Map(prd.userStories.map((story) => [story.id, story]));

  return (
    <ul className="grid gap-3">
      {questions.map((question) => (
        <li key={question.id}>
          <QuestionCard question={question} stories={stories} />
        </li>
      ))}
    </ul>
  );
}

function QuestionCard({
  question,
  stories,
}: {
  question: OpenQuestion;
  stories: Map<string, UserStory>;
}) {
  const answer = useServerFn(answerOpenQuestion);
  const { run, pending, error } = usePrdWrite();
  const otherId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [other, setOther] = useState("");

  // The recommended answer first, marked, then the other options
  const options = [
    ...(question.recommended ? [question.recommended] : []),
    ...(question.options ?? []).filter((option) => option !== question.recommended),
  ];
  const chosen = other.trim() || selected;

  return (
    <form
      className="grid gap-3 rounded-lg border bg-background p-4"
      onSubmit={async (event) => {
        event.preventDefault();

        if (chosen) {
          await run((base) =>
            answer({ data: { ...base, questionId: question.id, answer: chosen } }),
          );
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{question.id}</span>
        {question.storyIds?.length ? (
          <span>
            Blocks{" "}
            {question.storyIds.map((id, index) => (
              <span key={id}>
                {index > 0 ? ", " : null}
                <span className="font-mono">{id}</span>
                {stories.get(id) ? ` ${stories.get(id)!.title}` : null}
              </span>
            ))}
          </span>
        ) : null}
        <DeleteQuestion questionId={question.id} />
      </div>

      <Markdown text={question.question} inline className="text-[15px] font-medium" />

      {question.why ? (
        <p className="text-sm text-muted-foreground">
          <Markdown text={question.why} inline />
        </p>
      ) : null}

      {options.length > 0 ? (
        <div role="radiogroup" aria-label="Answers" className="grid gap-2">
          {options.map((option) => {
            const isSelected = selected === option && !other.trim();

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  setSelected(option);
                  setOther("");
                }}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                  isSelected && "border-foreground bg-muted/50",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    isSelected && "border-foreground bg-foreground text-background",
                  )}
                >
                  {isSelected ? <CheckIcon className="size-3" /> : null}
                </span>
                <span className="flex-1">
                  <Markdown text={option} inline />
                </span>
                {option === question.recommended ? (
                  <span className="rounded-full bg-blue-100 px-2 text-xs font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
                    Recommended
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <Field>
        <FieldLabel htmlFor={otherId} className="sr-only">
          {options.length > 0 ? "Other answer" : "Answer"}
        </FieldLabel>
        <Input
          id={otherId}
          placeholder={options.length > 0 ? "Other answer" : "Your answer"}
          value={other}
          onChange={(event) => setOther(event.target.value)}
        />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={!chosen || pending}>
          {pending ? "Saving…" : "Record answer"}
        </Button>
        <span className="text-xs text-muted-foreground">
          The answer is added to the decision log.
        </span>
      </div>
    </form>
  );
}

function AddQuestion() {
  const add = useServerFn(addOpenQuestion);
  const { run, pending, error } = usePrdWrite();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [why, setWhy] = useState("");
  const [options, setOptions] = useState("");
  const [storyIds, setStoryIds] = useState<string[]>([]);

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        Add a question
      </Button>
    );
  }

  return (
    <form
      className="grid gap-3 rounded-lg border bg-muted/20 p-3"
      onSubmit={async (event) => {
        event.preventDefault();

        const saved = await run((base) =>
          add({
            data: {
              ...base,
              question,
              why,
              options: options.split("\n").filter((option) => option.trim()),
              storyIds,
            },
          }),
        );

        if (saved) {
          setOpen(false);
          setQuestion("");
          setWhy("");
          setOptions("");
          setStoryIds([]);
        }
      }}
    >
      <Field>
        <FieldLabel htmlFor={`${formId}-question`}>Question</FieldLabel>
        <Input
          id={`${formId}-question`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="e.g. Can a shared note be edited by others?"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`${formId}-why`}>Why it matters</FieldLabel>
        <Input
          id={`${formId}-why`}
          value={why}
          onChange={(event) => setWhy(event.target.value)}
          placeholder="What goes wrong if the agent guesses"
        />
      </Field>

      <Field>
        <FieldLabel id={`${formId}-options-label`}>Options</FieldLabel>
        <MarkdownEditor
          mode="list"
          name="Format options"
          labelledBy={`${formId}-options-label`}
          value={options}
          onChange={setOptions}
          placeholder="Add an option"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`${formId}-stories`}>Blocks stories</FieldLabel>
        <StoryPicker
          id={`${formId}-stories`}
          value={storyIds}
          onChange={setStoryIds}
          placeholder="Search stories by id or title"
        />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!question.trim() || pending}>
          {pending ? "Saving…" : "Add question"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Deletes a question that no longer matters, after an inline confirmation. */
function DeleteQuestion({ questionId }: { questionId: string }) {
  const remove = useServerFn(deleteOpenQuestion);
  const { run, pending, error } = usePrdWrite();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Delete ${questionId}`}
        className="ml-auto text-muted-foreground"
        onClick={() => setConfirming(true)}
      >
        <Trash2Icon />
      </Button>
    );
  }

  return (
    <span className="ml-auto flex items-center gap-2">
      {error ? <span className="text-destructive">{error}</span> : null}
      <span>Delete this question?</span>
      <Button
        type="button"
        variant="destructive"
        size="xs"
        disabled={pending}
        onClick={() => void run((base) => remove({ data: { ...base, questionId } }))}
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
      <Button type="button" variant="ghost" size="xs" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}
