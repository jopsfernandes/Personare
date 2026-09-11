import { addDays, startOfDay } from "date-fns";
import type { CalendarEvent } from "@/components/reui/event-calendar";
import { ipc } from "@/ipc/manager";

export interface ScheduleRow {
  activityId: string;
  activityTitle: string;
  dueDate: Date;
  front: string;
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
  return rows.map((row) => {
    // allDay bounds must already be display-zone midnights, or the
    // calendar's own day-segmentation walks past the day it's stored on and
    // paints the bar into the next day too (event-calendar-lib.tsx's
    // segmentOccurrence contract) -- dueDate carries whatever time-of-day
    // the review happened at, so it has to be floored to the local day
    // first.
    const day = startOfDay(row.dueDate);

    return {
      allDay: true,
      data: { moduleId: row.moduleId, programId: row.programId },
      end: addDays(day, 1),
      id: row.id,
      readOnly: true,
      start: day,
      title: row.front,
    };
  });
}
