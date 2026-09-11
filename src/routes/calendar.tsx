import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ensureReviewItems,
  listSchedule,
  type ScheduleRow,
  toCalendarEvents,
} from "@/actions/calendar";
import {
  getCalendarConnectionStatus,
  syncCalendar,
} from "@/actions/calendar-sync";
import {
  type CalendarEvent,
  EventCalendar,
  EventCalendarContent,
  EventCalendarNav,
  type EventCalendarRenderEventProps,
} from "@/components/reui/event-calendar";
import { Button } from "@/components/ui/button";

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent<CalendarEventData>[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    ensureReviewItems()
      .then(() => listSchedule())
      .then((rows) => {
        setScheduleRows(rows);
        setEvents(toCalendarEvents(rows));
      });
    getCalendarConnectionStatus().then(setIsCalendarConnected);
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

  const handleSyncClick = useCallback(() => {
    setIsSyncing(true);
    setSyncMessage(null);

    syncCalendar(
      scheduleRows.map((row) => ({
        dueDate: row.dueDate.toISOString(),
        front: row.front ?? row.activityTitle,
        id: row.id,
      }))
    )
      .then((result) => {
        if ("error" in result) {
          setSyncMessage(
            result.error === "calendar_not_connected"
              ? t("calendarNotConnectedErrorMessage")
              : t("calendarSyncErrorMessage")
          );
          return;
        }

        setSyncMessage(
          t("calendarSyncResultMessage", {
            created: result.created,
            deleted: result.deleted,
            updated: result.updated,
          })
        );
      })
      .catch(() => {
        setSyncMessage(t("calendarSyncErrorMessage"));
      })
      .finally(() => {
        setIsSyncing(false);
      });
  }, [scheduleRows, t]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          disabled={!isCalendarConnected || isSyncing}
          onClick={handleSyncClick}
          variant="outline"
        >
          {t("syncCalendarAction")}
        </Button>
        {syncMessage ? (
          <p className="text-muted-foreground text-sm">{syncMessage}</p>
        ) : null}
      </div>
      <EventCalendar
        className="h-full"
        defaultView="month"
        events={events}
        interactions={{ drag: false, resize: false, selectSlot: false }}
        onEventsChange={setEvents}
        renderEvent={renderEvent}
        views={["month", "agenda"]}
      >
        <EventCalendarNav />
        <EventCalendarContent />
      </EventCalendar>
    </div>
  );
}

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});
