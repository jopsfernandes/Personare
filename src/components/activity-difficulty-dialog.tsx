import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { markActivityDifficulty, type RatingValue } from "@/actions/review";
import type { Activity } from "@/components/activities-data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  activity: Activity | null;
  onOpenChange: (open: boolean) => void;
  onRated: () => void;
  open: boolean;
}

/**
 * One review_item per whole Activity (Issue #77): unlike
 * ReviewSessionDialog (a queue of Flashcards, each revealed before rating),
 * this is a single Again/Hard/Good/Easy step for the Activity as a whole --
 * no "reveal answer" step, since there is no answer to reveal here.
 */
export default function ActivityDifficultyDialog({
  activity,
  onOpenChange,
  onRated,
  open,
}: ActivityDifficultyDialogProps) {
  const { t } = useTranslation();

  const handleRatingClick = useCallback(
    (rating: RatingValue) => {
      if (!activity) {
        return;
      }

      Promise.resolve(markActivityDifficulty(activity.id, rating)).then(() => {
        onOpenChange(false);
        onRated();
      });
    },
    [activity, onOpenChange, onRated]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activity?.title}</DialogTitle>
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
