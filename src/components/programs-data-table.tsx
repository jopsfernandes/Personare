import { BookOpen, Pencil, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface Program {
  createdAt: Date;
  id: string;
  name: string;
  updatedAt: Date;
}

interface ProgramsDataTableProps {
  onEdit: (program: Program) => void;
  onNavigateToModules: (program: Program) => void;
  onRequestDelete: (program: Program) => void;
  programs: Program[];
}

interface ProgramRowProps {
  onEdit: (program: Program) => void;
  onNavigateToModules: (program: Program) => void;
  onRequestDelete: (program: Program) => void;
  program: Program;
}

function ProgramRow({
  onEdit,
  onNavigateToModules,
  onRequestDelete,
  program,
}: ProgramRowProps) {
  const { t } = useTranslation();

  const handleEditClick = useCallback(() => {
    onEdit(program);
  }, [onEdit, program]);

  const handleDeleteClick = useCallback(() => {
    onRequestDelete(program);
  }, [onRequestDelete, program]);

  const handleNavigateToModulesClick = useCallback(() => {
    onNavigateToModules(program);
  }, [onNavigateToModules, program]);

  return (
    <tr>
      <td>{program.name}</td>
      <td>
        <Button
          aria-label={t("editProgramAction")}
          onClick={handleEditClick}
          size="icon"
          variant="ghost"
        >
          <Pencil />
        </Button>
        <Button
          aria-label={t("deleteProgramAction")}
          onClick={handleDeleteClick}
          size="icon"
          variant="ghost"
        >
          <Trash2 />
        </Button>
        <Button
          aria-label={t("viewModulesAction")}
          onClick={handleNavigateToModulesClick}
          size="icon"
          variant="ghost"
        >
          <BookOpen />
        </Button>
      </td>
    </tr>
  );
}

export default function ProgramsDataTable({
  onEdit,
  onNavigateToModules,
  onRequestDelete,
  programs,
}: ProgramsDataTableProps) {
  const { t } = useTranslation();

  if (programs.length === 0) {
    return <p>{t("programsTableEmptyMessage")}</p>;
  }

  return (
    <table>
      <tbody>
        {programs.map((program) => (
          <ProgramRow
            key={program.id}
            onEdit={onEdit}
            onNavigateToModules={onNavigateToModules}
            onRequestDelete={onRequestDelete}
            program={program}
          />
        ))}
      </tbody>
    </table>
  );
}
