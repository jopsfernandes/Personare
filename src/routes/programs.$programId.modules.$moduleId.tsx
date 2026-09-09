// biome-ignore-all lint/style/useFilenamingConvention: TanStack Router file-based routing requires the "$paramName" filename convention for dynamic route segments.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  createActivity,
  listActivities,
  softDeleteActivity,
  updateActivity,
} from "@/actions/activities";
import ActivitiesDataTable, {
  type Activity,
} from "@/components/activities-data-table";
import ActivityFormDialog from "@/components/activity-form-dialog";
import DeleteActivityDialog from "@/components/delete-activity-dialog";
import FlashcardManagerDialog from "@/components/flashcard-manager-dialog";
import PdfViewerDialog from "@/components/pdf-viewer-dialog";
import QuizQuestionManagerDialog from "@/components/quiz-question-manager-dialog";
import QuizRunnerDialog from "@/components/quiz-runner-dialog";
import { Button } from "@/components/ui/button";

function ModuleActivitiesPage() {
  const { t } = useTranslation();
  const { moduleId } = Route.useParams();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [, startTransition] = useTransition();
  const [formActivity, setFormActivity] = useState<Activity | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activityPendingDelete, setActivityPendingDelete] =
    useState<Activity | null>(null);
  const [activityBeingViewed, setActivityBeingViewed] =
    useState<Activity | null>(null);
  const [activityBeingManaged, setActivityBeingManaged] =
    useState<Activity | null>(null);
  const [activityTakingQuiz, setActivityTakingQuiz] = useState<Activity | null>(
    null
  );
  const [activityBeingManagedFlashcards, setActivityBeingManagedFlashcards] =
    useState<Activity | null>(null);

  const refreshActivities = useCallback(() => {
    startTransition(() => {
      listActivities(moduleId).then(setActivities);
    });
  }, [moduleId]);

  useEffect(() => {
    refreshActivities();
  }, [refreshActivities]);

  const handleCreateClick = useCallback(() => {
    setFormActivity(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((activity: Activity) => {
    setFormActivity(activity);
    setIsFormOpen(true);
  }, []);

  const handleRequestDelete = useCallback((activity: Activity) => {
    setActivityPendingDelete(activity);
  }, []);

  const handleViewPdf = useCallback((activity: Activity) => {
    setActivityBeingViewed(activity);
  }, []);

  const handleManageQuiz = useCallback((activity: Activity) => {
    setActivityBeingManaged(activity);
  }, []);

  const handleTakeQuiz = useCallback((activity: Activity) => {
    setActivityTakingQuiz(activity);
  }, []);

  const handleManageFlashcards = useCallback((activity: Activity) => {
    setActivityBeingManagedFlashcards(activity);
  }, []);

  const handleFormOpenChange = useCallback((open: boolean) => {
    setIsFormOpen(open);
  }, []);

  const handleFormSubmit = useCallback(
    (
      title: string,
      type: string,
      url: string | null,
      filePath: string | null
    ) => {
      const submit = formActivity
        ? updateActivity(formActivity.id, title, type, url, filePath)
        : createActivity(moduleId, title, type, url, filePath);

      submit.then(() => {
        setIsFormOpen(false);
        refreshActivities();
      });
    },
    [formActivity, moduleId, refreshActivities]
  );

  const handlePdfViewerOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActivityBeingViewed(null);
    }
  }, []);

  const handleQuizManagerOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActivityBeingManaged(null);
    }
  }, []);

  const handleQuizRunnerOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActivityTakingQuiz(null);
    }
  }, []);

  const handleFlashcardManagerOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActivityBeingManagedFlashcards(null);
    }
  }, []);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActivityPendingDelete(null);
    }
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!activityPendingDelete) {
      return;
    }

    softDeleteActivity(activityPendingDelete.id).then(() => {
      setActivityPendingDelete(null);
      refreshActivities();
    });
  }, [activityPendingDelete, refreshActivities]);

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">{t("activitiesPageTitle")}</h1>
        <Button onClick={handleCreateClick}>{t("createActivityAction")}</Button>
      </div>
      <ActivitiesDataTable
        activities={activities}
        onEdit={handleEdit}
        onManageFlashcards={handleManageFlashcards}
        onManageQuiz={handleManageQuiz}
        onRequestDelete={handleRequestDelete}
        onTakeQuiz={handleTakeQuiz}
        onViewPdf={handleViewPdf}
      />
      <ActivityFormDialog
        activity={formActivity}
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
      />
      <DeleteActivityDialog
        activity={activityPendingDelete}
        onConfirm={handleConfirmDelete}
        onOpenChange={handleDeleteDialogOpenChange}
        open={activityPendingDelete !== null}
      />
      <PdfViewerDialog
        activity={activityBeingViewed}
        onOpenChange={handlePdfViewerOpenChange}
        open={activityBeingViewed !== null}
      />
      <QuizQuestionManagerDialog
        activity={activityBeingManaged}
        onOpenChange={handleQuizManagerOpenChange}
        open={activityBeingManaged !== null}
      />
      <QuizRunnerDialog
        activity={activityTakingQuiz}
        onOpenChange={handleQuizRunnerOpenChange}
        open={activityTakingQuiz !== null}
      />
      <FlashcardManagerDialog
        activity={activityBeingManagedFlashcards}
        onOpenChange={handleFlashcardManagerOpenChange}
        open={activityBeingManagedFlashcards !== null}
      />
    </div>
  );
}

export const Route = createFileRoute("/programs/$programId/modules/$moduleId")({
  component: ModuleActivitiesPage,
});
