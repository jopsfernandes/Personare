import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  clearPendingActivityRating,
  markActivityDifficulty,
  type RatingValue,
} from "@/actions/review";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const RATINGS: RatingValue[] = ["again", "hard", "good", "easy"];

const RATING_TRANSLATION_KEYS: Record<RatingValue, string> = {
  again: "ratingAgainAction",
  easy: "ratingEasyAction",
  good: "ratingGoodAction",
  hard: "ratingHardAction",
};

interface RatingButtonProps {
  label: string;
  onClick: (rating: RatingValue) => void;
  rating: RatingValue;
}

function RatingButton({ label, onClick, rating }: RatingButtonProps) {
  const handleClick = useCallback(() => {
    onClick(rating);
  }, [onClick, rating]);

  return <Button onClick={handleClick}>{label}</Button>;
}

interface ActivityDifficultyDialogProps {
  activityId: string | null;
  activityTitle: string;
  moduleName: string;
  onOpenChange: (open: boolean) => void;
  onRated: () => void;
  open: boolean;
  programName: string;
}

/**
 * One review_item per whole Activity (Issue #77): unlike
 * ReviewSessionDialog (a queue of Flashcards, each revealed before rating),
 * this is a single Again/Hard/Good/Easy step for the Activity as a whole --
 * no "reveal answer" step, since there is no answer to reveal here.
 *
 * Takes primitives (activityId/activityTitle/programName/moduleName)
 * instead of a whole Activity (Issue #103): it's now opened both from the
 * Activities route (which has a full Activity in hand) and from the app
 * root on launch (which only has what getPendingActivityRating() returns --
 * no filePath/url/moduleId, just enough to display and rate).
 */
export default function ActivityDifficultyDialog({
  activityId,
  activityTitle,
  moduleName,
  onOpenChange,
  onRated,
  open,
  programName,
}: ActivityDifficultyDialogProps) {
  const { t } = useTranslation();

  const handleRatingClick = useCallback(
    (rating: RatingValue) => {
      if (!activityId) {
        return;
      }

      Promise.resolve(markActivityDifficulty(activityId, rating)).then(() => {
        clearPendingActivityRating(activityId);
        onOpenChange(false);
        onRated();
      });
    },
    [activityId, onOpenChange, onRated]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activityTitle}</DialogTitle>
          <DialogDescription>
            {t("activityDifficultyContextLabel", { moduleName, programName })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          {t("activityDifficultyPromptMessage")}
        </p>
        <DialogFooter>
          {RATINGS.map((rating) => (
            <RatingButton
              key={rating}
              label={t(RATING_TRANSLATION_KEYS[rating])}
              onClick={handleRatingClick}
              rating={rating}
            />
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
