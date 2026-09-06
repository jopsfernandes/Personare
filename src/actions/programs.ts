import { ipc } from "@/ipc/manager";

export function listPrograms() {
  return ipc.client.programs.list();
}

export function createProgram(name: string) {
  return ipc.client.programs.create({ name });
}

export function updateProgram(id: string, name: string) {
  return ipc.client.programs.update({ id, name });
}

export function softDeleteProgram(id: string) {
  return ipc.client.programs.softDelete({ id });
}
