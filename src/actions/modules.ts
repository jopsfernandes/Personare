import { ipc } from "@/ipc/manager";

export function listModules(programId: string) {
  return ipc.client.modules.list({ programId });
}

export function createModule(programId: string, name: string) {
  return ipc.client.modules.create({ name, programId });
}

export function updateModule(id: string, name: string) {
  return ipc.client.modules.update({ id, name });
}

export function softDeleteModule(id: string) {
  return ipc.client.modules.softDelete({ id });
}
