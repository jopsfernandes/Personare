import { ipc } from "@/ipc/manager";

export function listActivities(moduleId: string) {
  return ipc.client.activities.list({ moduleId });
}

export function createActivity(moduleId: string, title: string, type: string) {
  return ipc.client.activities.create({ moduleId, title, type });
}

export function updateActivity(id: string, title: string, type: string) {
  return ipc.client.activities.update({ id, title, type });
}

export function softDeleteActivity(id: string) {
  return ipc.client.activities.softDelete({ id });
}
