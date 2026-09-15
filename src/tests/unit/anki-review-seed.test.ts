// @vitest-environment node
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createInitialReviewItemFields } from "@/utils/fsrs";

/**
 * RED phase (Issue #31, Spec Driven TDD): src/main/anki-review-seed.ts does
 * not exist yet. Every test below is expected to fail until the Developer
 * implements seedReviewStateFromAnkiCards per
 * docs/specs/issue-31-anki-sm2-fsrs-seed.md.
 *
 * Forced to the "node" environment for consistency with the other Anki
 * fixtures in this suite -- this file doesn't decode protobuf, but the
 * fixtures are still built with better-sqlite3 (a native addon).
 */

const ONE_DAY_MS = 86_400_000;
const EASE_FLOOR = 1300;
const EASE_STEP = 200;
const S_MIN = 0.001;

function difficultyFromFactor(factor: number): number {
  return Math.min(10, Math.max(1, 10 - (factor - EASE_FLOOR) / EASE_STEP));
}

interface CardFixture {
  data?: string;
  due: number;
  factor: number;
  id: number;
  ivl: number;
  lapses: number;
  mod?: number;
  queue: number;
  reps: number;
  type: number;
}

function buildDb(options: { cards: CardFixture[]; crt: number }): Database.Database {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE col (id INTEGER PRIMARY KEY, crt INTEGER NOT NULL)");
  db.exec(`CREATE TABLE cards (
    id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER, mod INTEGER,
    usn INTEGER, type INTEGER, queue INTEGER, due INTEGER, ivl INTEGER,
    factor INTEGER, reps INTEGER, lapses INTEGER, left INTEGER, odue INTEGER,
    odid INTEGER, flags INTEGER, data TEXT
  )`);

  db.prepare("INSERT INTO col (id, crt) VALUES (1, ?)").run(options.crt);

  const insert = db.prepare(`INSERT INTO cards (
    id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses,
    left, odue, odid, flags, data
  ) VALUES (?, 0, 0, 0, ?, 0, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)`);
  for (const card of options.cards) {
    insert.run(
      card.id,
      card.mod ?? 0,
      card.type,
      card.queue,
      card.due,
      card.ivl,
      card.factor,
      card.reps,
      card.lapses,
      card.data ?? ""
    );
  }

  return db;
}

describe("anki-review-seed (Issue #31)", () => {
  it("seeds a New card via createInitialReviewItemFields, unchanged", async () => {
    const { seedReviewStateFromAnkiCards } = await import(
      "@/main/anki-review-seed"
    );
    const db = buildDb({
      cards: [
        {
          due: 5,
          factor: 0,
          id: 1,
          ivl: 0,
          lapses: 0,
          queue: 0,
          reps: 0,
          type: 0,
        },
      ],
      crt: 1_600_000_000,
    });

    const before = new Date();
    const [seed] = seedReviewStateFromAnkiCards(db);
    const after = new Date();
    const expected = createInitialReviewItemFields();

    expect(seed.cardId).toBe(1);
    expect(seed.state).toBe(expected.state);
    expect(seed.difficulty).toBe(expected.difficulty);
    expect(seed.stability).toBe(expected.stability);
    expect(seed.reps).toBe(expected.reps);
    expect(seed.lapses).toBe(expected.lapses);
    expect(seed.scheduledDays).toBe(expected.scheduledDays);
    expect(seed.learningSteps).toBe(expected.learningSteps);
    expect(seed.lastReviewedAt).toBeNull();
    expect(seed.dueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(seed.dueDate.getTime()).toBeLessThanOrEqual(after.getTime());

    db.close();
  });

  it("uses cards.data's native FSRS stability/difficulty when present", async () => {
    const { seedReviewStateFromAnkiCards } = await import(
      "@/main/anki-review-seed"
    );
    const crt = 1_600_000_000;
    const db = buildDb({
      cards: [
        {
          data: JSON.stringify({ d: 6.1, s: 34.2 }),
          due: 100,
          factor: 2500,
          id: 2,
          ivl: 15,
          lapses: 0,
          mod: 1_700_000_000,
          queue: 2,
          reps: 3,
          type: 2,
        },
      ],
      crt,
    });

    const [seed] = seedReviewStateFromAnkiCards(db);

    expect(seed.stability).toBe(34.2);
    expect(seed.difficulty).toBe(6.1);
    expect(seed.state).toBe("Review");
    expect(seed.reps).toBe(3);
    expect(seed.lapses).toBe(0);
    expect(seed.scheduledDays).toBe(15);
    expect(seed.learningSteps).toBe(0);
    expect(seed.lastReviewedAt).toEqual(new Date(1_700_000_000 * 1000));
    expect(seed.dueDate).toEqual(new Date(crt * 1000 + 100 * ONE_DAY_MS));

    db.close();
  });

  it("derives stability/difficulty from ivl/factor when cards.data has no native FSRS state", async () => {
    const { seedReviewStateFromAnkiCards } = await import(
      "@/main/anki-review-seed"
    );
    const db = buildDb({
      cards: [
        {
          data: "",
          due: 40,
          factor: 2500,
          id: 3,
          ivl: 20,
          lapses: 1,
          queue: 2,
          reps: 4,
          type: 2,
        },
      ],
      crt: 1_600_000_000,
    });

    const [seed] = seedReviewStateFromAnkiCards(db);

    expect(seed.stability).toBe(20);
    expect(seed.difficulty).toBe(difficultyFromFactor(2500));
    expect(seed.difficulty).toBe(4);

    db.close();
  });

  it("clamps difficulty to the 1-10 range at the ease extremes", async () => {
    const { seedReviewStateFromAnkiCards } = await import(
      "@/main/anki-review-seed"
    );
    const db = buildDb({
      cards: [
        {
          data: "",
          due: 1,
          factor: 1300,
          id: 10,
          ivl: 1,
          lapses: 0,
          queue: 2,
          reps: 1,
          type: 2,
        },
        {
          data: "",
          due: 1,
          factor: 3300,
          id: 11,
          ivl: 1,
          lapses: 0,
          queue: 2,
          reps: 1,
          type: 2,
        },
      ],
      crt: 1_600_000_000,
    });

    const [hardest, easiest] = seedReviewStateFromAnkiCards(db);

    expect(hardest.difficulty).toBe(10);
    expect(easiest.difficulty).toBe(1);

    db.close();
  });

  it("floors stability at S_MIN for a Learn/Relearn card with a non-positive ivl", async () => {
    const { seedReviewStateFromAnkiCards } = await import(
      "@/main/anki-review-seed"
    );
    const db = buildDb({
      cards: [
        {
          data: "",
          due: 1_700_003_600,
          factor: 2500,
          id: 4,
          ivl: -600,
          lapses: 0,
          queue: 1,
          reps: 1,
          type: 1,
        },
      ],
      crt: 1_600_000_000,
    });

    const [seed] = seedReviewStateFromAnkiCards(db);

    expect(seed.stability).toBe(S_MIN);
    expect(seed.state).toBe("Learning");
    expect(seed.scheduledDays).toBe(0);

    db.close();
  });

  it("computes dueDate from a direct Unix timestamp when queue is Learn (1)", async () => {
    const { seedReviewStateFromAnkiCards } = await import(
      "@/main/anki-review-seed"
    );
    const db = buildDb({
      cards: [
        {
          data: "",
          due: 1_700_003_600,
          factor: 2500,
          id: 5,
          ivl: 0,
          lapses: 0,
          queue: 1,
          reps: 1,
          type: 1,
        },
      ],
      crt: 1_600_000_000,
    });

    const [seed] = seedReviewStateFromAnkiCards(db);

    expect(seed.dueDate).toEqual(new Date(1_700_003_600 * 1000));

    db.close();
  });

  it("computes dueDate from days-since-collection-creation when queue is Review (2)", async () => {
    const { seedReviewStateFromAnkiCards } = await import(
      "@/main/anki-review-seed"
    );
    const crt = 1_650_000_000;
    const db = buildDb({
      cards: [
        {
          data: "",
          due: 30,
          factor: 2500,
          id: 6,
          ivl: 10,
          lapses: 0,
          queue: 2,
          reps: 2,
          type: 2,
        },
      ],
      crt,
    });

    const [seed] = seedReviewStateFromAnkiCards(db);

    expect(seed.dueDate).toEqual(new Date(crt * 1000 + 30 * ONE_DAY_MS));

    db.close();
  });

  it("still seeds a suspended card coherently with its type", async () => {
    const { seedReviewStateFromAnkiCards } = await import(
      "@/main/anki-review-seed"
    );
    const crt = 1_600_000_000;
    const db = buildDb({
      cards: [
        {
          data: "",
          due: 50,
          factor: 2200,
          id: 7,
          ivl: 30,
          lapses: 0,
          queue: -1,
          reps: 6,
          type: 2,
        },
      ],
      crt,
    });

    const [seed] = seedReviewStateFromAnkiCards(db);

    expect(seed.state).toBe("Review");
    expect(seed.stability).toBe(30);
    expect(seed.difficulty).toBe(difficultyFromFactor(2200));
    expect(seed.dueDate).toEqual(new Date(crt * 1000 + 50 * ONE_DAY_MS));

    db.close();
  });

  it("maps type=3 to Relearning", async () => {
    const { seedReviewStateFromAnkiCards } = await import(
      "@/main/anki-review-seed"
    );
    const db = buildDb({
      cards: [
        {
          data: "",
          due: 1_700_000_000,
          factor: 2100,
          id: 8,
          ivl: -60,
          lapses: 2,
          queue: 1,
          reps: 7,
          type: 3,
        },
      ],
      crt: 1_600_000_000,
    });

    const [seed] = seedReviewStateFromAnkiCards(db);

    expect(seed.state).toBe("Relearning");
    expect(seed.lapses).toBe(2);

    db.close();
  });

  it("returns one seed per card row, in id order, none dropped", async () => {
    const { seedReviewStateFromAnkiCards } = await import(
      "@/main/anki-review-seed"
    );
    const db = buildDb({
      cards: [
        { data: "", due: 1, factor: 2500, id: 20, ivl: 5, lapses: 0, queue: 2, reps: 1, type: 2 },
        { data: "", due: 5, factor: 0, id: 21, ivl: 0, lapses: 0, queue: 0, reps: 0, type: 0 },
        { data: "", due: 2, factor: 2400, id: 22, ivl: 3, lapses: 0, queue: 2, reps: 1, type: 2 },
      ],
      crt: 1_600_000_000,
    });

    const seeds = seedReviewStateFromAnkiCards(db);

    expect(seeds.map((seed) => seed.cardId)).toEqual([20, 21, 22]);

    db.close();
  });
});
