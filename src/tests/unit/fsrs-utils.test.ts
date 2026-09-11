import { Rating, State } from "ts-fsrs";
import { describe, expect, it } from "vitest";
import {
  applyRating,
  createInitialReviewItemFields,
  fromFsrsCard,
  type ReviewItemRow,
  toFsrsCard,
} from "@/utils/fsrs";

/**
 * RED phase (Issue #16, Spec Driven TDD): src/utils/fsrs.ts does not exist
 * yet. Every test below is expected to fail until the Developer implements
 * it, per docs/specs/issue-16-fsrs-review-session.md AC-2.
 *
 * This module is the ONLY bridge between how review_items is persisted
 * (camelCase columns, `state` stored as the ts-fsrs `StateType` string, not
 * the numeric `State` enum, dates as JS Date) and the `Card`/`Grade`/
 * `ReviewLog` shapes the real ts-fsrs library expects -- pure functions, no
 * I/O, mirroring the spirit of src/utils/quiz-scoring.ts. `elapsed_days` is
 * `@deprecated` in ts-fsrs (removed in v6) and is never read back from a
 * persisted row -- toFsrsCard always reconstructs it as 0.
 *
 * These tests exercise the real ts-fsrs package (not a mock/fake) -- its
 * default scheduler has enable_fuzz=false, so its scheduling outcomes are
 * fully deterministic for a given Card/rating/now.
 */

const REVIEW_ROW: ReviewItemRow = {
  createdAt: new Date("2026-01-01T00:00:00Z"),
  difficulty: 5.2,
  dueDate: new Date("2026-01-10T00:00:00Z"),
  id: "r1",
  lapses: 1,
  lastRating: "good",
  lastReviewedAt: new Date("2026-01-01T00:00:00Z"),
  learningSteps: 0,
  ratingHistory: JSON.stringify(["good"]),
  reps: 5,
  scheduledDays: 9,
  stability: 10.5,
  state: "Review",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("createInitialReviewItemFields (Issue #16)", () => {
  it("returns a brand-new ts-fsrs card's scheduling fields", () => {
    const fields = createInitialReviewItemFields();

    expect(fields.state).toBe("New");
    expect(fields.reps).toBe(0);
    expect(fields.lapses).toBe(0);
    expect(fields.scheduledDays).toBe(0);
    expect(fields.learningSteps).toBe(0);
    expect(fields.difficulty).toBe(0);
    expect(fields.stability).toBe(0);
    expect(fields.lastReviewedAt).toBeNull();
  });

  it("sets dueDate to now, making a new card immediately eligible for review", () => {
    const before = new Date();
    const fields = createInitialReviewItemFields();
    const after = new Date();

    expect(fields.dueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(fields.dueDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("toFsrsCard (Issue #16)", () => {
  it("reconstructs a full ts-fsrs Card from a review_items row", () => {
    const card = toFsrsCard(REVIEW_ROW);

    expect(card.due).toEqual(REVIEW_ROW.dueDate);
    expect(card.stability).toBe(REVIEW_ROW.stability);
    expect(card.difficulty).toBe(REVIEW_ROW.difficulty);
    expect(card.scheduled_days).toBe(REVIEW_ROW.scheduledDays);
    expect(card.learning_steps).toBe(REVIEW_ROW.learningSteps);
    expect(card.reps).toBe(REVIEW_ROW.reps);
    expect(card.lapses).toBe(REVIEW_ROW.lapses);
    expect(card.state).toBe(State.Review);
    expect(card.last_review).toEqual(REVIEW_ROW.lastReviewedAt);
  });

  it("never persists elapsed_days -- it is always reconstructed as 0 (deprecated in ts-fsrs)", () => {
    const card = toFsrsCard(REVIEW_ROW);

    expect(card.elapsed_days).toBe(0);
  });

  it("maps a null lastReviewedAt to an undefined last_review, matching a never-reviewed card", () => {
    const card = toFsrsCard({ ...REVIEW_ROW, lastReviewedAt: null });

    expect(card.last_review).toBeUndefined();
  });

  it.each([
    ["New", State.New],
    ["Learning", State.Learning],
    ["Review", State.Review],
    ["Relearning", State.Relearning],
  ] as const)(
    "maps the persisted state string %s back to the matching State enum member",
    (stateString, stateEnum) => {
      const card = toFsrsCard({ ...REVIEW_ROW, state: stateString });

      expect(card.state).toBe(stateEnum);
    }
  );
});

describe("applyRating (Issue #16)", () => {
  it("returns the raw ts-fsrs scheduling result for the given rating", () => {
    const now = new Date("2026-01-15T00:00:00Z");

    const result = applyRating(REVIEW_ROW, Rating.Again, now);

    expect(result.card).toBeDefined();
    expect(result.log).toBeDefined();
    expect(result.log.rating).toBe(Rating.Again);
  });

  it("always increments reps by one, regardless of the rating applied", () => {
    const now = new Date("2026-01-15T00:00:00Z");

    const result = applyRating(REVIEW_ROW, Rating.Good, now);

    expect(result.card.reps).toBe(REVIEW_ROW.reps + 1);
  });

  it("increments lapses and moves to Relearning when Again is applied to a card in the Review state", () => {
    const now = new Date("2026-01-15T00:00:00Z");

    const result = applyRating(REVIEW_ROW, Rating.Again, now);

    expect(result.card.lapses).toBe(REVIEW_ROW.lapses + 1);
    expect(result.card.state).toBe(State.Relearning);
  });

  it("schedules the next due date after the given now", () => {
    const now = new Date("2026-01-15T00:00:00Z");

    const result = applyRating(REVIEW_ROW, Rating.Good, now);

    expect(result.card.due.getTime()).toBeGreaterThan(now.getTime());
  });

  /**
   * RED phase (Issue #77 follow-up, Spec Driven TDD): applyRating does not
   * accept a shortTermEnabled option yet. Default ts-fsrs behavior
   * (enable_short_term: true, the Flashcard review default) schedules a
   * brand-new card's first "Good"/"Easy" rating as a short learning step
   * just minutes away, not the multi-day interval the stability value
   * implies -- correct for a Flashcard drilled repeatedly in one sitting,
   * but confusing for markActivityDifficulty's one-shot "I just finished
   * this Quiz/PDF/Link, here's how hard it was" (a user reported this as
   * a strange same-day/2-day reschedule). shortTermEnabled: false makes
   * even the very first rating graduate straight to a real, whole-day
   * interval.
   */
  it("schedules a real multi-day interval on the very first rating when shortTermEnabled is false", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const newCardRow: ReviewItemRow = {
      ...REVIEW_ROW,
      dueDate: now,
      lapses: 0,
      lastReviewedAt: null,
      learningSteps: 0,
      ratingHistory: "[]",
      reps: 0,
      state: "New",
    };

    const result = applyRating(newCardRow, Rating.Good, now, {
      shortTermEnabled: false,
    });

    const hoursUntilDue =
      (result.card.due.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(hoursUntilDue).toBeGreaterThanOrEqual(24);
    expect(result.card.state).toBe(State.Review);
  });

  it("defaults to the short-term (same-session drilling) scheduler, matching Flashcard review's existing behavior", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const newCardRow: ReviewItemRow = {
      ...REVIEW_ROW,
      dueDate: now,
      lapses: 0,
      lastReviewedAt: null,
      learningSteps: 0,
      ratingHistory: "[]",
      reps: 0,
      state: "New",
    };

    const result = applyRating(newCardRow, Rating.Good, now);

    const hoursUntilDue =
      (result.card.due.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(hoursUntilDue).toBeLessThan(1);
    expect(result.card.state).toBe(State.Learning);
  });
});

describe("fromFsrsCard (Issue #16)", () => {
  it("extracts the fields to persist back onto review_items from an updated Card", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const { card } = applyRating(REVIEW_ROW, Rating.Good, now);

    const fields = fromFsrsCard(card);

    expect(fields.difficulty).toBe(card.difficulty);
    expect(fields.stability).toBe(card.stability);
    expect(fields.dueDate).toEqual(card.due);
    expect(fields.state).toBe(State[card.state]);
    expect(fields.reps).toBe(card.reps);
    expect(fields.lapses).toBe(card.lapses);
    expect(fields.scheduledDays).toBe(card.scheduled_days);
    expect(fields.learningSteps).toBe(card.learning_steps);
    expect(fields.lastReviewedAt).toEqual(card.last_review);
  });

  it("maps an undefined last_review back to null", () => {
    const card = toFsrsCard({ ...REVIEW_ROW, lastReviewedAt: null });

    const fields = fromFsrsCard(card);

    expect(fields.lastReviewedAt).toBeNull();
  });
});
