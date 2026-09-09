import { ipc } from "@/ipc/manager";

export function ensureReviewItems(activityId: string) {
  return ipc.client.review.ensureReviewItems({ activityId });
}

export function listDue(activityId: string) {
  return ipc.client.review.listDue({ activityId });
}

export function submitRating(
  reviewItemId: string,
  rating: "again" | "hard" | "good" | "easy"
) {
  return ipc.client.review.submitRating({ rating, reviewItemId });
}
