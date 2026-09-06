import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function CalendarPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <h1 className="font-bold text-4xl">{t("navCalendar")}</h1>
    </div>
  );
}

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});
