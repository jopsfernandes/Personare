import { Pencil, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export interface Program {
  createdAt: Date;
  id: string;
  name: string;
  updatedAt: Date;
}

interface ProgramsCardGridProps {
  activityCountsByProgramId: Map<string, { count: number; date: string }[]>;
  onEdit: (program: Program) => void;
  onNavigateToModules: (program: Program) => void;
  onRequestDelete: (program: Program) => void;
  programs: Program[];
}

interface ProgramCardProps {
  activityCounts: { count: number; date: string }[];
  onEdit: (program: Program) => void;
  onNavigateToModules: (program: Program) => void;
  onRequestDelete: (program: Program) => void;
  program: Program;
}

function ProgramCard({
  activityCounts,
  onEdit,
  onNavigateToModules,
  onRequestDelete,
  program,
}: ProgramCardProps) {
  const { t } = useTranslation();

  const handleClick = useCallback(() => {
    onNavigateToModules(program);
  }, [onNavigateToModules, program]);

  const handleEditClick = useCallback(() => {
    onEdit(program);
  }, [onEdit, program]);

  const handleDeleteClick = useCallback(() => {
    onRequestDelete(program);
  }, [onRequestDelete, program]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-accent/50"
          onClick={handleClick}
          type="button"
        >
          <span className="font-medium text-sm">{program.name}</span>
          <ActivityHeatmap counts={activityCounts} />
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleEditClick}>
          <Pencil />
          {t("editProgramAction")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDeleteClick} variant="destructive">
          <Trash2 />
          {t("deleteProgramAction")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default function ProgramsCardGrid({
  activityCountsByProgramId,
  onEdit,
  onNavigateToModules,
  onRequestDelete,
  programs,
}: ProgramsCardGridProps) {
  const { t } = useTranslation();

  if (programs.length === 0) {
    return <p>{t("programsTableEmptyMessage")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {programs.map((program) => (
        <ProgramCard
          activityCounts={activityCountsByProgramId.get(program.id) ?? []}
          key={program.id}
          onEdit={onEdit}
          onNavigateToModules={onNavigateToModules}
          onRequestDelete={onRequestDelete}
          program={program}
        />
      ))}
    </div>
  );
}
