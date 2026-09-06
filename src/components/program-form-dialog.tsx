import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Program } from "@/components/programs-data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProgramFormDialogProps {
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  open: boolean;
  program: Program | null;
}

export default function ProgramFormDialog({
  onOpenChange,
  onSubmit,
  open,
  program,
}: ProgramFormDialogProps) {
  const { t } = useTranslation();
  const nameInputId = useId();
  const [name, setName] = useState(program?.name ?? "");

  useEffect(() => {
    if (open) {
      setName(program?.name ?? "");
    }
  }, [open, program]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit(name);
    },
    [name, onSubmit]
  );

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setName(event.target.value);
    },
    []
  );

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {program ? t("editProgramTitle") : t("createProgramTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 py-4">
            <Label htmlFor={nameInputId}>{t("programNameLabel")}</Label>
            <Input
              id={nameInputId}
              onChange={handleNameChange}
              required
              value={name}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCancelClick} type="button" variant="outline">
              {t("cancelAction")}
            </Button>
            <Button type="submit">{t("saveAction")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
