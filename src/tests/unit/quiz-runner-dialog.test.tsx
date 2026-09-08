import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import type { Activity } from "@/components/activities-data-table";

/**
 * RED phase (Issue #14, Spec Driven TDD): src/components/quiz-runner-dialog
 * does not exist yet. Every test below is expected to fail until Fundacao
 * (Developer) implements it, per docs/specs/issue-14-quiz.md AC-2.
 *
 * Contract exercised here: given a quiz Activity, fetches its questions with
 * options (listQuizQuestionsWithOptions) and renders every question with a
 * native radio group of its options -- one group per question, using a
 * distinct `name` per group so selecting an option in one question cannot
 * uncheck a selection in another (native <input type="radio"> semantics).
 * A finish action computes the score via calculateQuizScore (already
 * implemented, RED phase inherited -- src/tests/unit/quiz-scoring.test.ts)
 * and swaps the dialog's internal view to a result screen showing
 * "X of Y correct" through the interpolated i18n key `quizResultMessage`.
 * Nothing is persisted -- there is no database/IPC call involved in
 * answering or finishing, only in the initial load.
 */

vi.mock("@/actions/quiz", () => ({
  listQuizQuestionsWithOptions: vi.fn(),
}));

const { listQuizQuestionsWithOptions } = await import("@/actions/quiz");
const { default: QuizRunnerDialog } = await import(
  "@/components/quiz-runner-dialog"
);

const QUIZ_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-02"),
  filePath: null,
  id: "22222222-2222-2222-2222-222222222222",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Quiz de fixacao",
  type: "quiz",
  updatedAt: new Date("2026-01-02"),
  url: null,
};

const RUNNER_QUESTIONS = [
  {
    id: "q1",
    options: [
      { id: "q1-a", isCorrect: false, text: "Sao Paulo" },
      { id: "q1-b", isCorrect: true, text: "Brasilia" },
    ],
    text: "Qual e a capital do Brasil?",
  },
  {
    id: "q2",
    options: [
      { id: "q2-a", isCorrect: false, text: "3" },
      { id: "q2-b", isCorrect: true, text: "4" },
    ],
    text: "Quanto e 2 + 2?",
  },
];

function renderRunner(activity: Activity | null = QUIZ_ACTIVITY) {
  const onOpenChange = vi.fn();

  render(
    <QuizRunnerDialog
      activity={activity}
      onOpenChange={onOpenChange}
      open={activity !== null}
    />
  );

  return { onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listQuizQuestionsWithOptions).mockResolvedValue(RUNNER_QUESTIONS);
});

describe("QuizRunnerDialog (Issue #14)", () => {
  it("does not attempt to load questions when there is no activity", () => {
    renderRunner(null);

    expect(listQuizQuestionsWithOptions).not.toHaveBeenCalled();
  });

  it("renders every question's text and a radio option per alternative once loaded", async () => {
    renderRunner();

    expect(listQuizQuestionsWithOptions).toHaveBeenCalledWith(QUIZ_ACTIVITY.id);
    expect(
      await screen.findByText(RUNNER_QUESTIONS[0].text)
    ).toBeInTheDocument();
    expect(screen.getByText(RUNNER_QUESTIONS[1].text)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("groups each question's options under a distinct radio name so a selection in one question does not affect another", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios[0].name).not.toBe(radios[2].name);

    await user.click(radios[0]);
    await user.click(radios[2]);

    expect(radios[0].checked).toBe(true);
    expect(radios[2].checked).toBe(true);
  });

  it("renders the finish action and no result yet before finishing", async () => {
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    expect(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    ).toBeInTheDocument();
  });

  it("computes and displays the score, replacing the questions view, when the finish action is triggered", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(radios[1]); // q1 -> Brasilia (correct)
    await user.click(radios[3]); // q2 -> 4 (correct)
    await user.click(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    );

    expect(
      await screen.findByText(
        i18n.t("quizResultMessage", { correct: 2, total: 2 })
      )
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("counts an unanswered question as incorrect when the finish action is triggered", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(radios[1]); // only answers q1, correctly
    await user.click(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    );

    expect(
      await screen.findByText(
        i18n.t("quizResultMessage", { correct: 1, total: 2 })
      )
    ).toBeInTheDocument();
  });
});
