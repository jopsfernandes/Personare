import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (streak-refresh bug fix, Spec Driven TDD): submitRating and
 * markActivityDifficulty do not notify review-events yet -- StreakWidget
 * (src/components/streak-widget.tsx) fetches listActivityCounts() once on
 * mount and never again, so completing a review anywhere in the app never
 * updates the sidebar's streak count until the app is relaunched. Every
 * test below is expected to fail until the Developer wires
 * notifyReviewCompleted() into both actions.
 */

vi.mock("@/ipc/manager", () => ({
  ipc: {
    client: {
      review: {
        markActivityDifficulty: vi.fn(),
        submitRating: vi.fn(),
      },
    },
  },
}));
vi.mock("@/utils/review-events", () => ({
  notifyReviewCompleted: vi.fn(),
}));

const { ipc } = await import("@/ipc/manager");
const { notifyReviewCompleted } = await import("@/utils/review-events");
const { markActivityDifficulty, submitRating } = await import(
  "@/actions/review"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("submitRating (streak refresh bug)", () => {
  it("notifies review-events after the rating is persisted", async () => {
    vi.mocked(ipc.client.review.submitRating).mockResolvedValue({
      id: "r1",
    } as Awaited<ReturnType<typeof ipc.client.review.submitRating>>);

    await submitRating("r1", "good");

    expect(notifyReviewCompleted).toHaveBeenCalledTimes(1);
  });

  it("still resolves with the underlying result", async () => {
    const resolved = { id: "r1" } as Awaited<
      ReturnType<typeof ipc.client.review.submitRating>
    >;
    vi.mocked(ipc.client.review.submitRating).mockResolvedValue(resolved);

    await expect(submitRating("r1", "good")).resolves.toBe(resolved);
  });
});

describe("markActivityDifficulty (streak refresh bug)", () => {
  it("notifies review-events after the rating is persisted", async () => {
    vi.mocked(ipc.client.review.markActivityDifficulty).mockResolvedValue({
      id: "r1",
    } as Awaited<ReturnType<typeof ipc.client.review.markActivityDifficulty>>);

    await markActivityDifficulty("a1", "good");

    expect(notifyReviewCompleted).toHaveBeenCalledTimes(1);
  });
});
