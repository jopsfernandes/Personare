import { ipc } from "@/ipc/manager";

export function listFlashcards(activityId: string) {
  return ipc.client.flashcards.list({ activityId });
}

export function createFlashcard(
  activityId: string,
  front: string,
  back: string
) {
  return ipc.client.flashcards.create({ activityId, back, front });
}

export function updateFlashcard(id: string, front: string, back: string) {
  return ipc.client.flashcards.update({ back, front, id });
}

export function softDeleteFlashcard(id: string) {
  return ipc.client.flashcards.softDelete({ id });
}
