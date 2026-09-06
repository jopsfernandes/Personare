import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { selectPdfFile } from "@/actions/dialog";
import type { Activity } from "@/components/activities-data-table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MVP_ACTIVITY_TYPES = ["link", "quiz", "pdf", "flashcard_deck"] as const;

const ACTIVITY_TYPE_TRANSLATION_KEYS: Record<
  (typeof MVP_ACTIVITY_TYPES)[number],
  string
> = {
  flashcard_deck: "activityTypeFlashcardDeck",
  link: "activityTypeLink",
  pdf: "activityTypePdf",
  quiz: "activityTypeQuiz",
};

interface ActivityFormDialogProps {
  activity: Activity | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    title: string,
    type: string,
    url: string | null,
    filePath: string | null
  ) => void;
  open: boolean;
}

export default function ActivityFormDialog({
  activity,
  onOpenChange,
  onSubmit,
  open,
}: ActivityFormDialogProps) {
  const { t } = useTranslation();
  const titleInputId = useId();
  const typeSelectId = useId();
  const urlInputId = useId();
  const [title, setTitle] = useState(activity?.title ?? "");
  const [type, setType] = useState<string>(
    activity?.type ?? MVP_ACTIVITY_TYPES[0]
  );
  const [url, setUrl] = useState(activity?.url ?? "");
  const [filePath, setFilePath] = useState(activity?.filePath ?? null);

  useEffect(() => {
    if (open) {
      setTitle(activity?.title ?? "");
      setType(activity?.type ?? MVP_ACTIVITY_TYPES[0]);
      setUrl(activity?.url ?? "");
      setFilePath(activity?.filePath ?? null);
    }
  }, [open, activity]);

  const isLink = type === "link";
  const isPdf = type === "pdf";

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit(title, type, isLink ? url : null, isPdf ? filePath : null);
    },
    [title, type, url, isLink, filePath, isPdf, onSubmit]
  );

  const handleTitleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(event.target.value);
    },
    []
  );

  const handleUrlChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setUrl(event.target.value);
    },
    []
  );

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSelectPdfFileClick = useCallback(() => {
    selectPdfFile().then((selectedPath) => {
      if (selectedPath) {
        setFilePath(selectedPath);
      }
    });
  }, []);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {activity ? t("editActivityTitle") : t("createActivityTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor={titleInputId}>{t("activityTitleLabel")}</Label>
              <Input
                id={titleInputId}
                onChange={handleTitleChange}
                required
                value={title}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={typeSelectId}>{t("activityTypeLabel")}</Label>
              <Select onValueChange={setType} value={type}>
                <SelectTrigger id={typeSelectId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MVP_ACTIVITY_TYPES.map((activityType) => (
                    <SelectItem key={activityType} value={activityType}>
                      {t(ACTIVITY_TYPE_TRANSLATION_KEYS[activityType])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isLink && (
              <div className="flex flex-col gap-1">
                <Label htmlFor={urlInputId}>{t("activityUrlLabel")}</Label>
                <Input
                  id={urlInputId}
                  onChange={handleUrlChange}
                  type="url"
                  value={url}
                />
              </div>
            )}
            {isPdf && (
              <div className="flex flex-col gap-1">
                <Button
                  onClick={handleSelectPdfFileClick}
                  type="button"
                  variant="outline"
                >
                  {t("selectPdfFileAction")}
                </Button>
                {filePath ? <span>{filePath}</span> : null}
              </div>
            )}
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
