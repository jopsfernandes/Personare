import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ensureReviewItems,
  listSchedule,
  toCalendarEvents,
} from "@/actions/calendar";
import {
  type CalendarEvent,
  EventCalendar,
  EventCalendarContent,
  EventCalendarNav,
  type EventCalendarRenderEventProps,
} from "@/components/reui/event-calendar";

interface CalendarEventData {
  moduleId: string;
  programId: string;
}

interface CalendarEventChipProps {
  event: CalendarEvent<CalendarEventData>;
  onSelect: (data: CalendarEventData) => void;
}

function CalendarEventChip({ event, onSelect }: CalendarEventChipProps) {
  const handleClick = useCallback(() => {
    if (event.data) {
      onSelect(event.data);
    }
  }, [event.data, onSelect]);

  return (
    <button
      className="w-full truncate text-left"
      onClick={handleClick}
      type="button"
    >
      {event.title}
    </button>
  );
}

export function CalendarPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent<CalendarEventData>[]>([]);

  useEffect(() => {
    ensureReviewItems()
      .then(() => listSchedule())
      .then((rows) => {
        setEvents(toCalendarEvents(rows));
      });
  }, []);

  const handleSelectEvent = useCallback(
    (data: CalendarEventData) => {
      navigate({
        params: { moduleId: data.moduleId, programId: data.programId },
        to: "/programs/$programId/modules/$moduleId",
      });
    },
    [navigate]
  );

  const renderEvent = useCallback(
    ({ occurrence }: EventCalendarRenderEventProps<CalendarEventData>) => (
      <CalendarEventChip
        event={occurrence.event}
        onSelect={handleSelectEvent}
      />
    ),
    [handleSelectEvent]
  );

  return (
    <EventCalendar
      className="h-full"
      defaultEvents={events}
      defaultView="month"
      interactions={{ drag: false, resize: false, selectSlot: false }}
      renderEvent={renderEvent}
      views={["month", "agenda"]}
    >
      <EventCalendarNav />
      <EventCalendarContent />
    </EventCalendar>
  );
}

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});
