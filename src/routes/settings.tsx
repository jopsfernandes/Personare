import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSettings, setAutoStart } from "@/actions/settings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function SettingsPage() {
  const { t } = useTranslation();
  const autoStartId = useId();
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);

  useEffect(() => {
    getSettings().then((settings) => {
      setAutoStartEnabled(settings.autoStartEnabled);
    });
  }, []);

  const handleAutoStartChange = useCallback((checked: boolean) => {
    setAutoStartEnabled(checked);
    setAutoStart(checked);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <h1 className="font-bold text-2xl">{t("settingsPageTitle")}</h1>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={autoStartEnabled}
            id={autoStartId}
            onCheckedChange={handleAutoStartChange}
          />
          <Label htmlFor={autoStartId}>{t("autoStartToggleLabel")}</Label>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("autoStartDescription")}
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
