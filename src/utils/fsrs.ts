import type { Card, Grade, ReviewLog, StateType } from "ts-fsrs";
import { createEmptyCard, fsrs, State } from "ts-fsrs";

export interface ReviewItemRow {
  createdAt: Date;
  difficulty: number;
  dueDate: Date;
  flashcardId: string;
  id: string;
  lapses: number;
  lastRating: string;
  lastReviewedAt: Date | null;
  learningSteps: number;
  ratingHistory: string;
  reps: number;
  scheduledDays: number;
  stability: number;
  state: StateType;
  updatedAt: Date;
}

export interface ReviewItemInsertFields {
  difficulty: number;
  dueDate: Date;
  lapses: number;
  lastReviewedAt: Date | null;
  learningSteps: number;
  reps: number;
  scheduledDays: number;
  stability: number;
  state: StateType;
}

export type ReviewItemUpdateFields = ReviewItemInsertFields;

export function createInitialReviewItemFields(): ReviewItemInsertFields {
  const card = createEmptyCard();

  return {
    difficulty: card.difficulty,
    dueDate: card.due,
    lapses: card.lapses,
    lastReviewedAt: card.last_review ?? null,
    learningSteps: card.learning_steps,
    reps: card.reps,
    scheduledDays: card.scheduled_days,
    stability: card.stability,
    state: State[card.state] as StateType,
  };
}

export function toFsrsCard(row: ReviewItemRow): Card {
  return {
    difficulty: row.difficulty,
    due: row.dueDate,
    elapsed_days: 0,
    lapses: row.lapses,
    last_review: row.lastReviewedAt ?? undefined,
    learning_steps: row.learningSteps,
    reps: row.reps,
    scheduled_days: row.scheduledDays,
    stability: row.stability,
    state: State[row.state],
  };
}

export function applyRating(
  row: ReviewItemRow,
  rating: Grade,
  now: Date
): { card: Card; log: ReviewLog } {
  return fsrs().next(toFsrsCard(row), now, rating);
}

export function fromFsrsCard(card: Card): ReviewItemUpdateFields {
  return {
    difficulty: card.difficulty,
    dueDate: card.due,
    lapses: card.lapses,
    lastReviewedAt: card.last_review ?? null,
    learningSteps: card.learning_steps,
    reps: card.reps,
    scheduledDays: card.scheduled_days,
    stability: card.stability,
    state: State[card.state] as StateType,
  };
}
