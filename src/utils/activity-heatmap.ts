import { addDays, format, startOfWeek, subDays } from "date-fns";

export interface ActivityHeatmapDay {
  count: number;
  date: string;
}

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export type HeatmapCell = {
  count: number;
  date: string;
  level: HeatmapLevel;
} | null;

const DEFAULT_WEEKS = 13;
const DAYS_PER_WEEK = 7;
const MAX_LEVEL = 4;

export function buildHeatmapWeeks(
  counts: ActivityHeatmapDay[],
  options: { today?: Date; weeks?: number } = {}
): HeatmapCell[][] {
  const today = options.today ?? new Date();
  const weeks = options.weeks ?? DEFAULT_WEEKS;
  const lastWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  const gridStart = subDays(lastWeekStart, (weeks - 1) * DAYS_PER_WEEK);

  const countByDate = new Map(
    counts.map((day) => [day.date, day.count] as const)
  );

  let maxCount = 0;
  for (let i = 0; i < weeks * DAYS_PER_WEEK; i += 1) {
    const date = addDays(gridStart, i);
    if (date > today) {
      break;
    }
    const count = countByDate.get(format(date, "yyyy-MM-dd")) ?? 0;
    maxCount = Math.max(maxCount, count);
  }

  const grid: HeatmapCell[][] = [];

  for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
    const week: HeatmapCell[] = [];

    for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex += 1) {
      const date = addDays(gridStart, weekIndex * DAYS_PER_WEEK + dayIndex);

      if (date > today) {
        week.push(null);
        continue;
      }

      const dateKey = format(date, "yyyy-MM-dd");
      const count = countByDate.get(dateKey) ?? 0;
      const level: HeatmapLevel =
        count === 0
          ? 0
          : (Math.min(
              MAX_LEVEL,
              Math.ceil((count / maxCount) * MAX_LEVEL)
            ) as HeatmapLevel);

      week.push({ count, date: dateKey, level });
    }

    grid.push(week);
  }

  return grid;
}
