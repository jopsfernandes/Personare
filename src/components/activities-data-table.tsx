import {
  ExternalLink,
  FileText,
  Layers,
  ListChecks,
  Pencil,
  Play,
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

const ACTIVITY_TYPE_TRANSLATION_KEYS: Record<string, string> = {
  flashcard_deck: "activityTypeFlashcardDeck",
  link: "activityTypeLink",
  pdf: "activityTypePdf",
  quiz: "activityTypeQuiz",
};

interface ActivitiesDataTableProps {
  activities: Activity[];
  onEdit: (activity: Activity) => void;
  onManageFlashcards: (activity: Activity) => void;
  onManageQuiz: (activity: Activity) => void;
  onRequestDelete: (activity: Activity) => void;
  onTakeQuiz: (activity: Activity) => void;
  onViewPdf: (activity: Activity) => void;
}

interface ActivityRowProps {
  activity: Activity;
  onEdit: (activity: Activity) => void;
  onManageFlashcards: (activity: Activity) => void;
  onManageQuiz: (activity: Activity) => void;
  onRequestDelete: (activity: Activity) => void;
  onTakeQuiz: (activity: Activity) => void;
  onViewPdf: (activity: Activity) => void;
}

function ActivityRow({
  activity,
  onEdit,
  onManageFlashcards,
  onManageQuiz,
  onRequestDelete,
  onTakeQuiz,
  onViewPdf,
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

  const typeTranslationKey =
    ACTIVITY_TYPE_TRANSLATION_KEYS[activity.type] ?? activity.type;

  return (
    <tr>
      <td>{activity.title}</td>
      <td>
        <Badge>{t(typeTranslationKey)}</Badge>
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
  onRequestDelete,
  onTakeQuiz,
  onViewPdf,
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
            onRequestDelete={onRequestDelete}
            onTakeQuiz={onTakeQuiz}
            onViewPdf={onViewPdf}
          />
        ))}
      </tbody>
    </table>
  );
}
