import { ipc } from "@/ipc/manager";

export function connectCalendar() {
  return ipc.client.calendarSync.connect();
}

export function getCalendarConnectionStatus() {
  return ipc.client.calendarSync.getConnectionStatus();
}

export function syncCalendar(
  reviewItems: { dueDate: string; front: string; id: string }[]
) {
  return ipc.client.calendarSync.sync({ reviewItems });
}
