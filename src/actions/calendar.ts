import { addDays } from "date-fns";
import type { CalendarEvent } from "@/components/reui/event-calendar";
import { ipc } from "@/ipc/manager";

export interface ScheduleRow {
  activityId: string;
  activityTitle: string;
  dueDate: Date;
  /** Only set for a Flashcard-scoped row -- null for an Activity-scoped one (Issue #77). */
  front: string | null;
  id: string;
  moduleId: string;
  programId: string;
}

export function ensureReviewItems() {
  return ipc.client.review.ensureReviewItems({});
}

export function listSchedule() {
  return ipc.client.review.listSchedule();
}

export function toCalendarEvents(
  rows: ScheduleRow[]
): CalendarEvent<{ moduleId: string; programId: string }>[] {
  return rows.map((row) => ({
    allDay: true,
    data: { moduleId: row.moduleId, programId: row.programId },
    end: addDays(row.dueDate, 1),
    id: row.id,
    readOnly: true,
    start: row.dueDate,
    title: row.front ?? row.activityTitle,
  }));
}
