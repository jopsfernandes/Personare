import { describe, expect, it } from "vitest";

/**
 * RED phase (Issue #21, Spec Driven TDD): src/utils/backup-codec.ts does not
 * exist yet. Every test below is expected to fail until the Developer
 * implements serializeBackup/deserializeBackup per
 * docs/specs/issue-21-backup-local.md AC-1.
 *
 * drizzle-orm reads timestamp/timestamp_ms columns back as JS Date objects,
 * which a plain JSON.stringify/parse round-trip would turn into strings (or
 * silently drop for nested non-Date fields) -- this module's whole job is to
 * survive that round-trip losslessly.
 */

describe("backup-codec (Issue #21)", () => {
  it("round-trips a BackupData object through serializeBackup/deserializeBackup, preserving Date instances", async () => {
    const { deserializeBackup, serializeBackup } = await import(
      "@/utils/backup-codec"
    );

    const exportedAt = new Date("2026-01-15T10:30:00.123Z");
    const dueDate = new Date("2026-02-01T00:00:00.680Z");
    const data = {
      activities: [],
      appSettings: [{ autoStartEnabled: true, id: 1 }],
      exportedAt,
      flashcards: [],
      modules: [],
      programs: [
        {
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
          deletedAt: null,
          id: "program-1",
          name: "Bacharelado II",
          updatedAt: new Date("2025-06-01T12:00:00.456Z"),
        },
      ],
      quizOptions: [],
      quizQuestions: [],
      reviewItems: [
        {
          activityId: null,
          createdAt: new Date("2025-06-01T00:00:00.000Z"),
          difficulty: 5,
          dueDate,
          flashcardId: "flashcard-1",
          id: "review-1",
          lapses: 0,
          lastRating: "good",
          lastReviewedAt: null,
          learningSteps: 0,
          ratingHistory: "[]",
          reps: 0,
          scheduledDays: 0,
          stability: 2.5,
          state: "New",
          updatedAt: new Date("2025-06-01T00:00:00.000Z"),
        },
      ],
      version: 1 as const,
    };

    const json = serializeBackup(data);
    const restored = deserializeBackup(json);

    expect(restored.exportedAt).toBeInstanceOf(Date);
    expect(restored.exportedAt.getTime()).toBe(exportedAt.getTime());
    expect(restored.programs[0].createdAt).toBeInstanceOf(Date);
    expect(restored.programs[0].createdAt.getTime()).toBe(
      data.programs[0].createdAt.getTime()
    );
    expect(restored.programs[0].deletedAt).toBeNull();
    expect(restored.reviewItems[0].dueDate).toBeInstanceOf(Date);
    expect(restored.reviewItems[0].dueDate.getTime()).toBe(dueDate.getTime());
    expect(restored.version).toBe(1);
    expect(restored.appSettings).toEqual(data.appSettings);
  });

  it("produces plain JSON text, parseable by JSON.parse on its own", async () => {
    const { serializeBackup } = await import("@/utils/backup-codec");

    const json = serializeBackup({
      activities: [],
      appSettings: [],
      exportedAt: new Date(),
      flashcards: [],
      modules: [],
      programs: [],
      quizOptions: [],
      quizQuestions: [],
      reviewItems: [],
      version: 1,
    });

    expect(() => JSON.parse(json)).not.toThrow();
  });
});
