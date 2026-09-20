/**
 * Notifies interested UI (currently just StreakWidget, src/components/
 * streak-widget.tsx) that a rating was just persisted somewhere in the app
 * -- submitRating (Flashcard review) or markActivityDifficulty (Activity
 * review, Issue #77), see src/actions/review.ts.
 *
 * A rating can happen from deep inside a route (e.g. a Module's Activities
 * page, or the app-root pending-rating dialog) while the sidebar's
 * StreakWidget is a persistent sibling that never remounts on navigation --
 * there is no shared parent to lift refetch-triggering state into, and this
 * app has no global store/query-cache framework to invalidate instead.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyReviewCompleted() {
  for (const listener of listeners) {
    listener();
  }
}

export function onReviewCompleted(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
