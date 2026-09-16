import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (Issue #14, Spec Driven TDD): src/actions/quiz.ts does not exist
 * yet. Every test below is expected to fail until Fundacao (Developer)
 * implements it, mirroring the thin ipc.client.* wrappers already used by
 * src/actions/activities.ts.
 *
 * Contract exercised here (spec docs/specs/issue-14-quiz.md, AC-1):
 * - one wrapper per src/ipc/quiz procedure, so the manager/runner dialogs
 *   never call `ipc.client.quiz.*` directly (mirrors every other actions/*
 *   module in the codebase).
 * - `listQuizQuestionsWithOptions(activityId)`: a renderer-side composition
 *   (NOT an IPC handler -- the spec is explicit this runs in the renderer
 *   process to avoid N+1 inside a single handler) that calls
 *   `listQuestions` and then `listOptions` per question, returning
 *   `{ id, text, options: { id, text, isCorrect }[] }[]`.
 */

vi.mock("@/ipc/manager", () => ({
  ipc: {
    client: {
      quiz: {
        createOption: vi.fn(),
        createQuestion: vi.fn(),
        listOptions: vi.fn(),
        listQuestions: vi.fn(),
        softDeleteOption: vi.fn(),
        softDeleteQuestion: vi.fn(),
        updateOption: vi.fn(),
        updateQuestion: vi.fn(),
      },
    },
  },
}));

const { ipc } = await import("@/ipc/manager");
const {
  createQuizOption,
  createQuizQuestion,
  listQuizOptions,
  listQuizQuestions,
  listQuizQuestionsWithOptions,
  softDeleteQuizOption,
  softDeleteQuizQuestion,
  updateQuizOption,
  updateQuizQuestion,
} = await import("@/actions/quiz");

describe("quiz actions (Issue #14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("questions", () => {
    it("listQuizQuestions delegates to ipc.client.quiz.listQuestions", async () => {
      const questions = [{ activityId: "a1", id: "q1", text: "Pergunta 1" }];
      vi.mocked(ipc.client.quiz.listQuestions).mockResolvedValue(questions);

      await expect(listQuizQuestions("a1")).resolves.toBe(questions);
      expect(ipc.client.quiz.listQuestions).toHaveBeenCalledWith({
        activityId: "a1",
      });
    });

    it("createQuizQuestion delegates to ipc.client.quiz.createQuestion", async () => {
      const created = { activityId: "a1", id: "q1", text: "Pergunta 1" };
      vi.mocked(ipc.client.quiz.createQuestion).mockResolvedValue(created);

      await expect(createQuizQuestion("a1", "Pergunta 1")).resolves.toBe(
        created
      );
      expect(ipc.client.quiz.createQuestion).toHaveBeenCalledWith({
        activityId: "a1",
        imagePath: null,
        text: "Pergunta 1",
      });
    });

    it("updateQuizQuestion delegates to ipc.client.quiz.updateQuestion", async () => {
      const updated = { activityId: "a1", id: "q1", text: "Pergunta editada" };
      vi.mocked(ipc.client.quiz.updateQuestion).mockResolvedValue(updated);

      await expect(updateQuizQuestion("q1", "Pergunta editada")).resolves.toBe(
        updated
      );
      expect(ipc.client.quiz.updateQuestion).toHaveBeenCalledWith({
        id: "q1",
        imagePath: null,
        text: "Pergunta editada",
      });
    });

    it("softDeleteQuizQuestion delegates to ipc.client.quiz.softDeleteQuestion", async () => {
      await softDeleteQuizQuestion("q1");

      expect(ipc.client.quiz.softDeleteQuestion).toHaveBeenCalledWith({
        id: "q1",
      });
    });
  });

  describe("options", () => {
    it("listQuizOptions delegates to ipc.client.quiz.listOptions", async () => {
      const options = [
        { id: "o1", isCorrect: true, questionId: "q1", text: "Opcao 1" },
      ];
      vi.mocked(ipc.client.quiz.listOptions).mockResolvedValue(options);

      await expect(listQuizOptions("q1")).resolves.toBe(options);
      expect(ipc.client.quiz.listOptions).toHaveBeenCalledWith({
        questionId: "q1",
      });
    });

    it("createQuizOption delegates to ipc.client.quiz.createOption", async () => {
      const created = {
        id: "o1",
        isCorrect: true,
        questionId: "q1",
        text: "Opcao 1",
      };
      vi.mocked(ipc.client.quiz.createOption).mockResolvedValue(created);

      await expect(createQuizOption("q1", "Opcao 1", true)).resolves.toBe(
        created
      );
      expect(ipc.client.quiz.createOption).toHaveBeenCalledWith({
        imagePath: null,
        isCorrect: true,
        questionId: "q1",
        text: "Opcao 1",
      });
    });

    it("updateQuizOption delegates to ipc.client.quiz.updateOption", async () => {
      const updated = {
        id: "o1",
        isCorrect: false,
        questionId: "q1",
        text: "Opcao editada",
      };
      vi.mocked(ipc.client.quiz.updateOption).mockResolvedValue(updated);

      await expect(
        updateQuizOption("o1", "Opcao editada", false)
      ).resolves.toBe(updated);
      expect(ipc.client.quiz.updateOption).toHaveBeenCalledWith({
        id: "o1",
        imagePath: null,
        isCorrect: false,
        text: "Opcao editada",
      });
    });

    it("softDeleteQuizOption delegates to ipc.client.quiz.softDeleteOption", async () => {
      await softDeleteQuizOption("o1");

      expect(ipc.client.quiz.softDeleteOption).toHaveBeenCalledWith({
        id: "o1",
      });
    });
  });

  describe("listQuizQuestionsWithOptions", () => {
    it("composes listQuestions with listOptions per question", async () => {
      const questions = [
        { activityId: "a1", id: "q1", imagePath: null, text: "Pergunta 1" },
        { activityId: "a1", id: "q2", imagePath: null, text: "Pergunta 2" },
      ];
      vi.mocked(ipc.client.quiz.listQuestions).mockResolvedValue(questions);
      vi.mocked(ipc.client.quiz.listOptions).mockImplementation(
        ({ questionId }: { questionId: string }) => {
          if (questionId === "q1") {
            return Promise.resolve([
              {
                id: "o1",
                imagePath: null,
                isCorrect: true,
                questionId: "q1",
                text: "A",
              },
            ]);
          }
          return Promise.resolve([
            {
              id: "o2",
              imagePath: null,
              isCorrect: false,
              questionId: "q2",
              text: "B",
            },
          ]);
        }
      );

      const result = await listQuizQuestionsWithOptions("a1");

      expect(ipc.client.quiz.listQuestions).toHaveBeenCalledWith({
        activityId: "a1",
      });
      expect(ipc.client.quiz.listOptions).toHaveBeenCalledWith({
        questionId: "q1",
      });
      expect(ipc.client.quiz.listOptions).toHaveBeenCalledWith({
        questionId: "q2",
      });
      expect(result).toEqual([
        {
          id: "q1",
          imagePath: null,
          options: [{ id: "o1", imagePath: null, isCorrect: true, text: "A" }],
          text: "Pergunta 1",
        },
        {
          id: "q2",
          imagePath: null,
          options: [{ id: "o2", imagePath: null, isCorrect: false, text: "B" }],
          text: "Pergunta 2",
        },
      ]);
    });

    it("returns an empty array without calling listOptions when the activity has no questions", async () => {
      vi.mocked(ipc.client.quiz.listQuestions).mockResolvedValue([]);

      await expect(listQuizQuestionsWithOptions("a1")).resolves.toEqual([]);
      expect(ipc.client.quiz.listOptions).not.toHaveBeenCalled();
    });
  });
});
