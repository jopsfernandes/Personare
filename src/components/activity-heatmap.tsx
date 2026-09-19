import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildHeatmapWeeks, type HeatmapLevel } from "@/utils/activity-heatmap";
import { cn } from "@/utils/tailwind";

export interface ActivityHeatmapProps {
  color: string;
  counts: { count: number; date: string }[];
  weeks?: number;
}

const LEVEL_OPACITY: Record<HeatmapLevel, number> = {
  0: 0,
  1: 0.25,
  2: 0.45,
  3: 0.7,
  4: 1,
};

export function ActivityHeatmap({
  color,
  counts,
  weeks,
}: ActivityHeatmapProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const heatmapWeeks = useMemo(
    () => buildHeatmapWeeks(counts, { weeks }),
    [counts, weeks]
  );
  const total = useMemo(
    () => counts.reduce((sum, day) => sum + day.count, 0),
    [counts]
  );

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateScrollability = () => {
      const scrollable = node.scrollWidth > node.clientWidth;
      setIsScrollable(scrollable);

      if (scrollable) {
        node.scrollLeft = node.scrollWidth;
      }
    };

    updateScrollability();

    const observer = new ResizeObserver(updateScrollability);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-label={t("programActivityHeatmapSummary", { count: total })}
      className={cn(
        "no-scrollbar flex gap-[3px] overflow-x-auto",
        isScrollable &&
          "[mask-image:linear-gradient(to_right,transparent,black_24px)]"
      )}
      ref={scrollRef}
      role="img"
    >
      {heatmapWeeks.map((week, weekIndex) => (
        <div
          aria-hidden="true"
          className="flex shrink-0 flex-col gap-[3px]"
          // biome-ignore lint/suspicious/noArrayIndexKey: weeks/days are a fixed-size grid, never reordered.
          key={weekIndex}
        >
          {week.map((day, dayIndex) => (
            <div
              className={cn(
                "size-2.5 rounded-xs",
                day ? undefined : "bg-transparent"
              )}
              key={day?.date ?? dayIndex}
              style={
                day
                  ? {
                      backgroundColor: day.level === 0 ? "var(--muted)" : color,
                      opacity: day.level === 0 ? 1 : LEVEL_OPACITY[day.level],
                    }
                  : undefined
              }
              title={day ? `${day.date}: ${day.count}` : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
