import { createEmptyCard, fsrs, type Grade, Rating, State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

/**
 * Regression test for the FSRS scheduling algorithm as implemented by ts-fsrs.
 *
 * All expected values below are copied verbatim from ts-fsrs's own official
 * test suite (not invented for this project), so they double as a check that
 * our dependency behaves exactly like the upstream reference implementation:
 * https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/__tests__/FSRS-6.test.ts
 *
 * `fsrs()` with no arguments uses ts-fsrs's exported `default_w` parameters
 * (FSRS-6, the library's current default algorithm version), which is the
 * same weight set the upstream test pins explicitly as `w`.
 */
describe("ts-fsrs correctness regression", () => {
  it("matches the official ivl_history reference sequence", () => {
    const scheduler = fsrs();
    let card = createEmptyCard(new Date(2022, 11, 29, 12, 30, 0, 0));
    let now = card.due;

    const ratings: Grade[] = [
      Rating.Good,
      Rating.Good,
      Rating.Good,
      Rating.Good,
      Rating.Good,
      Rating.Good,
      Rating.Again,
      Rating.Again,
      Rating.Good,
      Rating.Good,
      Rating.Good,
      Rating.Good,
      Rating.Good,
    ];

    const ivlHistory: number[] = [];
    for (const rating of ratings) {
      ({ card } = scheduler.next(card, now, rating));
      ivlHistory.push(card.scheduled_days);
      now = card.due;
    }

    expect(ivlHistory).toEqual([0, 2, 11, 46, 163, 498, 0, 0, 2, 4, 7, 12, 21]);
  });

  it("matches the official memory state (stability/difficulty) reference", () => {
    const scheduler = fsrs({ enable_short_term: true });
    const ratings: Grade[] = [
      Rating.Again,
      Rating.Good,
      Rating.Good,
      Rating.Good,
      Rating.Good,
      Rating.Good,
    ];
    const intervalsInDays = [0, 0, 1, 3, 8, 21];

    let card = createEmptyCard(new Date(2022, 11, 29, 12, 30, 0, 0));
    let now = card.due;

    for (const [index, rating] of ratings.entries()) {
      now = new Date(+now + intervalsInDays[index] * 24 * 60 * 60 * 1000);
      ({ card } = scheduler.next(card, now, rating));
    }

    expect(card.stability).toBeCloseTo(53.626_91, 4);
    expect(card.difficulty).toBeCloseTo(6.357_486_7, 4);
  });

  it("matches the official first-repeat preview reference for every rating", () => {
    const scheduler = fsrs();
    const card = createEmptyCard(new Date(2022, 11, 29, 12, 30, 0, 0));
    const now = card.due;

    const preview = scheduler.repeat(card, now);
    const gradesInOrder: Grade[] = [
      Rating.Again,
      Rating.Hard,
      Rating.Good,
      Rating.Easy,
    ];

    const stability = gradesInOrder.map((g) => preview[g].card.stability);
    const difficulty = gradesInOrder.map((g) => preview[g].card.difficulty);
    const scheduledDays = gradesInOrder.map(
      (g) => preview[g].card.scheduled_days
    );
    const states = gradesInOrder.map((g) => preview[g].card.state);

    expect(stability).toEqual([0.212, 1.2931, 2.3065, 8.2956]);
    expect(difficulty).toEqual([6.4133, 5.112_170_71, 2.118_103_97, 1]);
    expect(scheduledDays).toEqual([0, 0, 0, 8]);
    expect(states).toEqual([
      State.Learning,
      State.Learning,
      State.Learning,
      State.Review,
    ]);
  });
});
