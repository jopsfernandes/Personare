import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildHeatmapWeeks, type HeatmapLevel } from "@/utils/activity-heatmap";
import { cn } from "@/utils/tailwind";

export interface ActivityHeatmapProps {
  counts: { count: number; date: string }[];
  weeks?: number;
}

const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: "bg-muted",
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
};

export function ActivityHeatmap({ counts, weeks }: ActivityHeatmapProps) {
  const { t } = useTranslation();
  const heatmapWeeks = useMemo(
    () => buildHeatmapWeeks(counts, { weeks }),
    [counts, weeks]
  );
  const total = useMemo(
    () => counts.reduce((sum, day) => sum + day.count, 0),
    [counts]
  );

  return (
    <div
      aria-label={t("programActivityHeatmapSummary", { count: total })}
      className="flex gap-[3px]"
      role="img"
    >
      {heatmapWeeks.map((week, weekIndex) => (
        <div
          aria-hidden="true"
          className="flex flex-col gap-[3px]"
          // biome-ignore lint/suspicious/noArrayIndexKey: weeks/days are a fixed-size grid, never reordered.
          key={weekIndex}
        >
          {week.map((day, dayIndex) => (
            <div
              className={cn(
                "size-2.5 rounded-xs",
                day ? LEVEL_CLASS[day.level] : "bg-transparent"
              )}
              key={day?.date ?? dayIndex}
              title={day ? `${day.date}: ${day.count}` : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
