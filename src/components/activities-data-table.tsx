import { format } from "date-fns";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Layers,
  ListChecks,
  Pencil,
  Play,
  Repeat,
  Trash2,
} from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { openExternalLink } from "@/actions/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface Activity {
  createdAt: Date;
  filePath: string | null;
  id: string;
  moduleId: string;
  title: string;
  type: string;
  updatedAt: Date;
  url: string | null;
}

export interface ActivityReviewState {
  dueDate: Date;
  lastRating: string;
}

const ACTIVITY_TYPE_TRANSLATION_KEYS: Record<string, string> = {
  flashcard_deck: "activityTypeFlashcardDeck",
  link: "activityTypeLink",
  pdf: "activityTypePdf",
  quiz: "activityTypeQuiz",
};

/**
 * flashcard_deck already has its own per-Flashcard review flow
 * (onStartReview) -- markActivityDifficulty (Issue #77) is only for the 3
 * types that never had any FSRS scheduling before.
 */
const MARKABLE_ACTIVITY_TYPES = new Set(["link", "pdf", "quiz"]);

const RATING_TRANSLATION_KEYS: Record<string, string> = {
  again: "ratingAgainAction",
  easy: "ratingEasyAction",
  good: "ratingGoodAction",
  hard: "ratingHardAction",
};

interface ActivitiesDataTableProps {
  activities: Activity[];
  onEdit: (activity: Activity) => void;
  onManageFlashcards: (activity: Activity) => void;
  onManageQuiz: (activity: Activity) => void;
  onMarkDifficulty: (activity: Activity) => void;
  onRequestDelete: (activity: Activity) => void;
  onStartReview: (activity: Activity) => void;
  onTakeQuiz: (activity: Activity) => void;
  onViewPdf: (activity: Activity) => void;
  reviewStateByActivityId: Record<string, ActivityReviewState | undefined>;
}

interface ActivityRowProps {
  activity: Activity;
  onEdit: (activity: Activity) => void;
  onManageFlashcards: (activity: Activity) => void;
  onManageQuiz: (activity: Activity) => void;
  onMarkDifficulty: (activity: Activity) => void;
  onRequestDelete: (activity: Activity) => void;
  onStartReview: (activity: Activity) => void;
  onTakeQuiz: (activity: Activity) => void;
  onViewPdf: (activity: Activity) => void;
  reviewState: ActivityReviewState | undefined;
}

function ActivityRow({
  activity,
  onEdit,
  onManageFlashcards,
  onManageQuiz,
  onMarkDifficulty,
  onRequestDelete,
  onStartReview,
  onTakeQuiz,
  onViewPdf,
  reviewState,
}: ActivityRowProps) {
  const { t } = useTranslation();

  const handleEditClick = useCallback(() => {
    onEdit(activity);
  }, [onEdit, activity]);

  const handleDeleteClick = useCallback(() => {
    onRequestDelete(activity);
  }, [onRequestDelete, activity]);

  const handleOpenUrlClick = useCallback(() => {
    if (activity.url) {
      openExternalLink(activity.url);
    }
  }, [activity.url]);

  const handleViewPdfClick = useCallback(() => {
    onViewPdf(activity);
  }, [onViewPdf, activity]);

  const handleManageQuizClick = useCallback(() => {
    onManageQuiz(activity);
  }, [onManageQuiz, activity]);

  const handleTakeQuizClick = useCallback(() => {
    onTakeQuiz(activity);
  }, [onTakeQuiz, activity]);

  const handleManageFlashcardsClick = useCallback(() => {
    onManageFlashcards(activity);
  }, [onManageFlashcards, activity]);

  const handleStartReviewClick = useCallback(() => {
    onStartReview(activity);
  }, [onStartReview, activity]);

  const handleMarkDifficultyClick = useCallback(() => {
    onMarkDifficulty(activity);
  }, [onMarkDifficulty, activity]);

  const typeTranslationKey =
    ACTIVITY_TYPE_TRANSLATION_KEYS[activity.type] ?? activity.type;

  return (
    <tr>
      <td>{activity.title}</td>
      <td>
        <Badge>{t(typeTranslationKey)}</Badge>
      </td>
      <td>
        {reviewState
          ? t("activityReviewStateLabel", {
              date: format(reviewState.dueDate, "yyyy-MM-dd"),
              rating: t(
                RATING_TRANSLATION_KEYS[reviewState.lastRating] ??
                  reviewState.lastRating
              ),
            })
          : null}
      </td>
      <td>
        {activity.type === "link" && (
          <Button
            aria-label={t("openActivityUrlAction")}
            onClick={handleOpenUrlClick}
            size="icon"
            variant="ghost"
          >
            <ExternalLink />
          </Button>
        )}
        {activity.type === "pdf" && (
          <Button
            aria-label={t("viewPdfAction")}
            onClick={handleViewPdfClick}
            size="icon"
            variant="ghost"
          >
            <FileText />
          </Button>
        )}
        {activity.type === "quiz" && (
          <Button
            aria-label={t("manageQuizQuestionsAction")}
            onClick={handleManageQuizClick}
            size="icon"
            variant="ghost"
          >
            <ListChecks />
          </Button>
        )}
        {activity.type === "quiz" && (
          <Button
            aria-label={t("takeQuizAction")}
            onClick={handleTakeQuizClick}
            size="icon"
            variant="ghost"
          >
            <Play />
          </Button>
        )}
        {activity.type === "flashcard_deck" && (
          <Button
            aria-label={t("manageFlashcardsAction")}
            onClick={handleManageFlashcardsClick}
            size="icon"
            variant="ghost"
          >
            <Layers />
          </Button>
        )}
        {activity.type === "flashcard_deck" && (
          <Button
            aria-label={t("startReviewAction")}
            onClick={handleStartReviewClick}
            size="icon"
            variant="ghost"
          >
            <Repeat />
          </Button>
        )}
        {MARKABLE_ACTIVITY_TYPES.has(activity.type) && (
          <Button
            aria-label={t("markActivityDoneAction")}
            onClick={handleMarkDifficultyClick}
            size="icon"
            variant="ghost"
          >
            <CheckCircle2 />
          </Button>
        )}
        <Button
          aria-label={t("editActivityAction")}
          onClick={handleEditClick}
          size="icon"
          variant="ghost"
        >
          <Pencil />
        </Button>
        <Button
          aria-label={t("deleteActivityAction")}
          onClick={handleDeleteClick}
          size="icon"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </td>
    </tr>
  );
}

export default function ActivitiesDataTable({
  activities,
  onEdit,
  onManageFlashcards,
  onManageQuiz,
  onMarkDifficulty,
  onRequestDelete,
  onStartReview,
  onTakeQuiz,
  onViewPdf,
  reviewStateByActivityId,
}: ActivitiesDataTableProps) {
  const { t } = useTranslation();

  if (activities.length === 0) {
    return <p>{t("activitiesTableEmptyMessage")}</p>;
  }

  return (
    <table>
      <tbody>
        {activities.map((activity) => (
          <ActivityRow
            activity={activity}
            key={activity.id}
            onEdit={onEdit}
            onManageFlashcards={onManageFlashcards}
            onManageQuiz={onManageQuiz}
            onMarkDifficulty={onMarkDifficulty}
            onRequestDelete={onRequestDelete}
            onStartReview={onStartReview}
            onTakeQuiz={onTakeQuiz}
            onViewPdf={onViewPdf}
            reviewState={reviewStateByActivityId[activity.id]}
          />
        ))}
      </tbody>
    </table>
  );
}
