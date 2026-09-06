import { Pencil, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface Activity {
  createdAt: Date;
  id: string;
  moduleId: string;
  title: string;
  type: string;
  updatedAt: Date;
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
  onRequestDelete: (activity: Activity) => void;
}

interface ActivityRowProps {
  activity: Activity;
  onEdit: (activity: Activity) => void;
  onRequestDelete: (activity: Activity) => void;
}

function ActivityRow({ activity, onEdit, onRequestDelete }: ActivityRowProps) {
  const { t } = useTranslation();

  const handleEditClick = useCallback(() => {
    onEdit(activity);
  }, [onEdit, activity]);

  const handleDeleteClick = useCallback(() => {
    onRequestDelete(activity);
  }, [onRequestDelete, activity]);

  const typeTranslationKey =
    ACTIVITY_TYPE_TRANSLATION_KEYS[activity.type] ?? activity.type;

  return (
    <tr>
      <td>{activity.title}</td>
      <td>
        <Badge>{t(typeTranslationKey)}</Badge>
      </td>
      <td>
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
  onRequestDelete,
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
            onRequestDelete={onRequestDelete}
          />
        ))}
      </tbody>
    </table>
  );
}
