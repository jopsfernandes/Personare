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

  const handleFormOpenChange = useCallback((open: boolean) => {
    setIsFormOpen(open);
  }, []);

  const handleFormSubmit = useCallback(
    (title: string, type: string) => {
      const submit = formActivity
        ? updateActivity(formActivity.id, title, type)
        : createActivity(moduleId, title, type);

      submit.then(() => {
        setIsFormOpen(false);
        refreshActivities();
      });
    },
    [formActivity, moduleId, refreshActivities]
  );

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
        onRequestDelete={handleRequestDelete}
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
    </div>
  );
}

export const Route = createFileRoute("/programs/$programId/modules/$moduleId")({
  component: ModuleActivitiesPage,
});
