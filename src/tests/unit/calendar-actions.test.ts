import { startOfDay } from "date-fns";
import { describe, expect, it } from "vitest";
import { type ScheduleRow, toCalendarEvents } from "@/actions/calendar";

/**
 * RED phase (Issue #18, Spec Driven TDD): src/actions/calendar.ts does not
 * exist yet. Every test below is expected to fail until the Developer
 * implements it, per docs/specs/issue-18-calendario.md AC-3.
 *
 * `toCalendarEvents` is a pure mapping function -- no I/O, no ipc.client
 * call -- from the rows returned by ipc.client.review.listSchedule() to the
 * `CalendarEvent` shape the `@reui/event-calendar` component expects (AC-1
 * installs that component; this test does not depend on it or import it,
 * only on the plain-object shape the spec documents):
 *
 * - `allDay: true`, `start`/`end` floored to the local day dueDate falls on
 *   (start of that day, end at start of the next) -- event-calendar-lib.tsx
 *   documents that an allDay occurrence's bounds must already be
 *   display-zone midnights, or its day-by-day segmentation walks past the
 *   scheduled day and paints the bar into the next day too (reported as a
 *   review event visually spanning two days when dueDate still carried the
 *   time-of-day the review happened at).
 * - `readOnly: true` on every event -- the calendar is read-only, and this
 *   is the second layer of protection against accidental edits (the first
 *   being `interactions={{ drag: false, resize: false, selectSlot: false }}`
 *   on `<EventCalendar>` itself, which is AC-4, not this pure function).
 * - `data: { programId, moduleId }` -- carried through so a click on the
 *   rendered event can navigate back to the source Module.
 */

const SCHEDULE_ROWS: ScheduleRow[] = [
  {
    activityId: "a1",
    activityTitle: "Baralho de fixacao",
    dueDate: new Date("2026-02-01T10:00:00Z"),
    front: "Brasilia",
    id: "r1",
    moduleId: "m1",
    programId: "p1",
  },
  {
    activityId: "a2",
    activityTitle: "Outro baralho",
    dueDate: new Date("2026-02-03T08:00:00Z"),
    front: "Qual oceano banha o Brasil?",
    id: "r2",
    moduleId: "m2",
    programId: "p2",
  },
];

describe("toCalendarEvents (Issue #18)", () => {
  it("maps each schedule row to one calendar event", () => {
    const events = toCalendarEvents(SCHEDULE_ROWS);

    expect(events).toHaveLength(2);
  });

  it("uses the review_item id as the event id", () => {
    const events = toCalendarEvents(SCHEDULE_ROWS);

    expect(events.map((event) => event.id)).toEqual(["r1", "r2"]);
  });

  it("marks every event as allDay, floored to the local day dueDate falls on and ending the next day", () => {
    const events = toCalendarEvents(SCHEDULE_ROWS);
    const dayStart = startOfDay(SCHEDULE_ROWS[0].dueDate);

    expect(events[0].allDay).toBe(true);
    expect(events[0].start).toEqual(dayStart);
    expect(events[0].start.getHours()).toBe(0);
    expect(events[0].start.getMinutes()).toBe(0);
    expect(events[0].end.getTime() - dayStart.getTime()).toBe(
      24 * 60 * 60 * 1000
    );
  });

  it("marks every event as readOnly, so the calendar cannot edit review_items", () => {
    const events = toCalendarEvents(SCHEDULE_ROWS);

    expect(events.every((event) => event.readOnly === true)).toBe(true);
  });

  it("carries the flashcard's front as the event title", () => {
    const events = toCalendarEvents(SCHEDULE_ROWS);

    expect(events[0].title).toBe("Brasilia");
    expect(events[1].title).toBe("Qual oceano banha o Brasil?");
  });

  it("carries moduleId and programId in data, for navigating back to the source Module on click", () => {
    const events = toCalendarEvents(SCHEDULE_ROWS);

    expect(events[0].data).toEqual({ moduleId: "m1", programId: "p1" });
    expect(events[1].data).toEqual({ moduleId: "m2", programId: "p2" });
  });

  it("returns an empty array for an empty schedule", () => {
    expect(toCalendarEvents([])).toEqual([]);
  });

  it("falls back to the activityTitle when front is null (Activity-scoped row, Issue #77)", () => {
    const events = toCalendarEvents([
      {
        activityId: "a3",
        activityTitle: "Quiz de Historia",
        dueDate: new Date("2026-02-05T10:00:00Z"),
        front: null,
        id: "r3",
        moduleId: "m3",
        programId: "p3",
      },
    ]);

    expect(events[0].title).toBe("Quiz de Historia");
  });
});
