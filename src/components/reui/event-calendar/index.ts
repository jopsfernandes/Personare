// biome-ignore-all lint/performance/noBarrelFile: intentional -- calendar.tsx
// and its tests import EventCalendar/EventCalendarContent/EventCalendarNav/
// CalendarEvent from this single path, matching the official ReUI usage
// example and the RED test's vi.mock("@/components/reui/event-calendar").
export type {
  EventCalendarProps,
  EventCalendarRenderEventProps,
} from "./event-calendar";
export { EventCalendar } from "./event-calendar";
export { EventCalendarContent } from "./event-calendar-content";
export { EventCalendarNav } from "./event-calendar-nav";
export type { CalendarEvent } from "./event-calendar-types";
