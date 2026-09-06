import { ipc } from "@/ipc/manager";

export function listActivities(moduleId: string) {
  return ipc.client.activities.list({ moduleId });
}

export function createActivity(
  moduleId: string,
  title: string,
  type: string,
  url: string | null
) {
  return ipc.client.activities.create({ moduleId, title, type, url });
}

export function updateActivity(
  id: string,
  title: string,
  type: string,
  url: string | null
) {
  return ipc.client.activities.update({ id, title, type, url });
}

export function softDeleteActivity(id: string) {
  return ipc.client.activities.softDelete({ id });
}
