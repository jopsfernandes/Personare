// biome-ignore-all lint/style/useFilenamingConvention: TanStack Router file-based routing requires the "$paramName" filename convention for dynamic route segments.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  createModule,
  listModules,
  softDeleteModule,
  updateModule,
} from "@/actions/modules";
import DeleteModuleDialog from "@/components/delete-module-dialog";
import ModuleFormDialog from "@/components/module-form-dialog";
import ModulesDataTable, { type Module } from "@/components/modules-data-table";
import { Button } from "@/components/ui/button";

function ProgramModulesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { programId } = Route.useParams();
  const [modules, setModules] = useState<Module[]>([]);
  const [, startTransition] = useTransition();
  const [formModule, setFormModule] = useState<Module | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [modulePendingDelete, setModulePendingDelete] = useState<Module | null>(
    null
  );

  const refreshModules = useCallback(() => {
    startTransition(() => {
      listModules(programId).then(setModules);
    });
  }, [programId]);

  useEffect(() => {
    refreshModules();
  }, [refreshModules]);

  const handleCreateClick = useCallback(() => {
    setFormModule(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((module: Module) => {
    setFormModule(module);
    setIsFormOpen(true);
  }, []);

  const handleRequestDelete = useCallback((module: Module) => {
    setModulePendingDelete(module);
  }, []);

  const handleNavigateToActivities = useCallback(
    (module: Module) => {
      navigate({
        params: { moduleId: module.id, programId },
        to: "/programs/$programId/modules/$moduleId",
      });
    },
    [navigate, programId]
  );

  const handleFormOpenChange = useCallback((open: boolean) => {
    setIsFormOpen(open);
  }, []);

  const handleFormSubmit = useCallback(
    (name: string) => {
      const submit = formModule
        ? updateModule(formModule.id, name)
        : createModule(programId, name);

      submit.then(() => {
        setIsFormOpen(false);
        refreshModules();
      });
    },
    [formModule, programId, refreshModules]
  );

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setModulePendingDelete(null);
    }
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!modulePendingDelete) {
      return;
    }

    softDeleteModule(modulePendingDelete.id).then(() => {
      setModulePendingDelete(null);
      refreshModules();
    });
  }, [modulePendingDelete, refreshModules]);

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">{t("modulesPageTitle")}</h1>
        <Button onClick={handleCreateClick}>{t("createModuleAction")}</Button>
      </div>
      <ModulesDataTable
        modules={modules}
        onEdit={handleEdit}
        onNavigateToActivities={handleNavigateToActivities}
        onRequestDelete={handleRequestDelete}
      />
      <ModuleFormDialog
        module={formModule}
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
      />
      <DeleteModuleDialog
        module={modulePendingDelete}
        onConfirm={handleConfirmDelete}
        onOpenChange={handleDeleteDialogOpenChange}
        open={modulePendingDelete !== null}
      />
    </div>
  );
}

export const Route = createFileRoute("/programs/$programId")({
  component: ProgramModulesPage,
});
