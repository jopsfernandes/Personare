import type Database from "better-sqlite3";
import type { ReviewItemInsertFields, StateType } from "@/utils/fsrs";
import { createInitialReviewItemFields } from "@/utils/fsrs";

const ONE_DAY_MS = 86_400_000;

/**
 * Anki's own ease floor and ease-adjustment step (Anki always keeps `factor`
 * at or above 1300, and its "easy bonus"/interval-adjustment UI moves ease
 * in ~200-permille increments) -- anchors for the difficulty heuristic
 * below, not arbitrary constants. Default ease (2500) lands on difficulty 4,
 * close to ts-fsrs's own typical post-first-"Good" difficulty.
 */
const EASE_FLOOR = 1300;
const EASE_STEP = 200;

/** ts-fsrs's S_MIN -- the stability floor for a card with no real interval yet. */
const S_MIN = 0.001;

export interface AnkiReviewSeed extends ReviewItemInsertFields {
  cardId: number;
}

interface CardRow {
  data: string;
  due: number;
  factor: number;
  id: number;
  ivl: number;
  lapses: number;
  mod: number;
  queue: number;
  reps: number;
  type: number;
}

function stateFromType(type: number): StateType {
  if (type === 1) {
    return "Learning";
  }
  if (type === 3) {
    return "Relearning";
  }
  return "Review";
}

function dueDateFrom(card: CardRow, crtSeconds: number): Date {
  if (card.queue === 1 || card.queue === 4) {
    return new Date(card.due * 1000);
  }
  return new Date(crtSeconds * 1000 + card.due * ONE_DAY_MS);
}

function difficultyFromFactor(factor: number): number {
  return Math.min(10, Math.max(1, 10 - (factor - EASE_FLOOR) / EASE_STEP));
}

function nativeFsrsState(
  data: string
): { difficulty: number; stability: number } | null {
  if (!data) {
    return null;
  }

  const parsed = JSON.parse(data) as { d?: number; s?: number };
  if (typeof parsed.s === "number" && typeof parsed.d === "number") {
    return { difficulty: parsed.d, stability: parsed.s };
  }

  return null;
}

function memoryStateFor(card: CardRow): {
  difficulty: number;
  stability: number;
} {
  return (
    nativeFsrsState(card.data) ?? {
      difficulty: difficultyFromFactor(card.factor),
      stability: Math.max(card.ivl > 0 ? card.ivl : 0, S_MIN),
    }
  );
}

function seedForReviewedCard(
  card: CardRow,
  crtSeconds: number
): AnkiReviewSeed {
  const { difficulty, stability } = memoryStateFor(card);

  return {
    cardId: card.id,
    difficulty,
    dueDate: dueDateFrom(card, crtSeconds),
    lapses: card.lapses,
    lastReviewedAt: new Date(card.mod * 1000),
    learningSteps: 0,
    reps: card.reps,
    scheduledDays: card.ivl > 0 ? card.ivl : 0,
    stability,
    state: stateFromType(card.type),
  };
}

export function seedReviewStateFromAnkiCards(
  db: Database.Database
): AnkiReviewSeed[] {
  const { crt } = db.prepare("SELECT crt FROM col").get() as { crt: number };
  const cards = db
    .prepare(
      "SELECT id, type, queue, due, ivl, factor, reps, lapses, mod, data FROM cards ORDER BY id"
    )
    .all() as CardRow[];

  return cards.map((card) =>
    card.type === 0
      ? { cardId: card.id, ...createInitialReviewItemFields() }
      : seedForReviewedCard(card, crt)
  );
}
