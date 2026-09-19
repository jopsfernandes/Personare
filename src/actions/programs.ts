import { ipc } from "@/ipc/manager";

export interface ProgramActivityCount {
  count: number;
  date: string;
  programId: string;
}

export function listPrograms() {
  return ipc.client.programs.list();
}

export function listProgramActivityCounts() {
  return ipc.client.review.listActivityCounts();
}

export function groupActivityCountsByProgram(
  rows: ProgramActivityCount[]
): Map<string, { count: number; date: string }[]> {
  const grouped = new Map<string, { count: number; date: string }[]>();

  for (const row of rows) {
    const existing = grouped.get(row.programId) ?? [];
    existing.push({ count: row.count, date: row.date });
    grouped.set(row.programId, existing);
  }

  return grouped;
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
