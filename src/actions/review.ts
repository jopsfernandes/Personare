import { ipc } from "@/ipc/manager";
import { notifyReviewCompleted } from "@/utils/review-events";

export type RatingValue = "again" | "hard" | "good" | "easy";

export function ensureReviewItems(activityId: string) {
  return ipc.client.review.ensureReviewItems({ activityId });
}

export function listDue(activityId: string) {
  return ipc.client.review.listDue({ activityId });
}

export function submitRating(reviewItemId: string, rating: RatingValue) {
  return ipc.client.review
    .submitRating({ rating, reviewItemId })
    .then((result) => {
      notifyReviewCompleted();
      return result;
    });
}

export function markActivityDifficulty(
  activityId: string,
  rating: RatingValue
) {
  return ipc.client.review
    .markActivityDifficulty({ activityId, rating })
    .then((result) => {
      notifyReviewCompleted();
      return result;
    });
}

export function listActivityReviewState(moduleId: string) {
  return ipc.client.review.listActivityReviewState({ moduleId });
}

export function armPendingActivityRating(activityId: string) {
  return ipc.client.review.armPendingActivityRating({ activityId });
}

export function clearPendingActivityRating(activityId: string) {
  return ipc.client.review.clearPendingActivityRating({ activityId });
}

export function getPendingActivityRating() {
  return ipc.client.review.getPendingActivityRating();
}
