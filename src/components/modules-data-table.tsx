import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface Module {
  createdAt: Date;
  id: string;
  name: string;
  programId: string;
  updatedAt: Date;
}

interface ModulesDataTableProps {
  modules: Module[];
  onEdit: (module: Module) => void;
  onNavigateToActivities: (module: Module) => void;
  onRequestDelete: (module: Module) => void;
}

interface ModuleRowProps {
  module: Module;
  onEdit: (module: Module) => void;
  onNavigateToActivities: (module: Module) => void;
  onRequestDelete: (module: Module) => void;
}

function ModuleRow({
  module,
  onEdit,
  onNavigateToActivities,
  onRequestDelete,
}: ModuleRowProps) {
  const { t } = useTranslation();

  const handleEditClick = useCallback(() => {
    onEdit(module);
  }, [onEdit, module]);

  const handleDeleteClick = useCallback(() => {
    onRequestDelete(module);
  }, [onRequestDelete, module]);

  const handleNavigateToActivitiesClick = useCallback(() => {
    onNavigateToActivities(module);
  }, [onNavigateToActivities, module]);

  return (
    <tr>
      <td>{module.name}</td>
      <td>
        <Button
          aria-label={t("editModuleAction")}
          onClick={handleEditClick}
          size="icon"
          variant="ghost"
        >
          <Pencil />
        </Button>
        <Button
          aria-label={t("deleteModuleAction")}
          onClick={handleDeleteClick}
          size="icon"
          variant="ghost"
        >
          <Trash2 />
        </Button>
        <Button
          aria-label={t("viewActivitiesAction")}
          onClick={handleNavigateToActivitiesClick}
          size="icon"
          variant="ghost"
        >
          <ListChecks />
        </Button>
      </td>
    </tr>
  );
}

export default function ModulesDataTable({
  modules,
  onEdit,
  onNavigateToActivities,
  onRequestDelete,
}: ModulesDataTableProps) {
  const { t } = useTranslation();

  if (modules.length === 0) {
    return <p>{t("modulesTableEmptyMessage")}</p>;
  }

  return (
    <table>
      <tbody>
        {modules.map((module) => (
          <ModuleRow
            key={module.id}
            module={module}
            onEdit={onEdit}
            onNavigateToActivities={onNavigateToActivities}
            onRequestDelete={onRequestDelete}
          />
        ))}
      </tbody>
    </table>
  );
}
