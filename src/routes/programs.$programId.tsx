// biome-ignore-all lint/style/useFilenamingConvention: TanStack Router file-based routing requires the "$paramName" filename convention for dynamic route segments.
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function ProgramModulesPage() {
  const { t } = useTranslation();
  const { programId } = Route.useParams();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <h1 className="font-bold text-4xl">
        {t("modulesPlaceholder", { programId })}
      </h1>
    </div>
  );
}

export const Route = createFileRoute("/programs/$programId")({
  component: ProgramModulesPage,
});
