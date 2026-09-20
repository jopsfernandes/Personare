import { describe, expect, it } from "vitest";
import { buildHeatmapWeeks } from "@/utils/activity-heatmap";

/**
 * RED phase (Issue #99, Spec Driven TDD): src/utils/activity-heatmap.ts does
 * not exist yet. Every test below is expected to fail until the Developer
 * implements buildHeatmapWeeks, per
 * docs/specs/issue-99-programs-cards-heatmap.md AC-3.
 */

describe("buildHeatmapWeeks (Issue #99)", () => {
  it("returns `weeks` columns of 7 rows each", () => {
    const weeks = buildHeatmapWeeks([], {
      today: new Date("2026-03-15T12:00:00"),
      weeks: 13,
    });

    expect(weeks).toHaveLength(13);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it("defaults to 53 weeks (365 days) when none is given", () => {
    const weeks = buildHeatmapWeeks([], {
      today: new Date("2026-03-15T12:00:00"),
    });

    expect(weeks).toHaveLength(53);
  });

  it("places today's cell as the last non-null cell of the grid", () => {
    // 2026-03-15 is a Sunday.
    const weeks = buildHeatmapWeeks([], {
      today: new Date("2026-03-15T12:00:00"),
      weeks: 2,
    });

    const lastWeek = weeks.at(-1);
    expect(lastWeek?.[0]?.date).toBe("2026-03-15");
    expect(lastWeek?.slice(1)).toEqual([null, null, null, null, null, null]);
  });

  it("maps a count to its exact date cell, leaving other days at level 0", () => {
    const weeks = buildHeatmapWeeks([{ count: 3, date: "2026-03-10" }], {
      today: new Date("2026-03-15T12:00:00"),
      weeks: 2,
    });

    const allCells = weeks.flat().filter((cell) => cell !== null);
    const matching = allCells.find((cell) => cell?.date === "2026-03-10");
    expect(matching).toEqual({ count: 3, date: "2026-03-10", level: 4 });

    const zeroCells = allCells.filter((cell) => cell?.date !== "2026-03-10");
    for (const cell of zeroCells) {
      expect(cell?.count).toBe(0);
      expect(cell?.level).toBe(0);
    }
  });

  it("buckets levels 1-4 proportionally to the highest count within the visible window", () => {
    const weeks = buildHeatmapWeeks(
      [
        { count: 1, date: "2026-03-09" },
        { count: 2, date: "2026-03-10" },
        { count: 3, date: "2026-03-11" },
        { count: 4, date: "2026-03-12" },
      ],
      { today: new Date("2026-03-15T12:00:00"), weeks: 2 }
    );

    const byDate = new Map(
      weeks
        .flat()
        .filter((cell) => cell !== null)
        .map((cell) => [cell?.date, cell])
    );

    expect(byDate.get("2026-03-09")?.level).toBe(1);
    expect(byDate.get("2026-03-10")?.level).toBe(2);
    expect(byDate.get("2026-03-11")?.level).toBe(3);
    expect(byDate.get("2026-03-12")?.level).toBe(4);
  });

  it("ignores counts that fall outside the visible window", () => {
    const weeks = buildHeatmapWeeks([{ count: 99, date: "2020-01-01" }], {
      today: new Date("2026-03-15T12:00:00"),
      weeks: 2,
    });

    for (const cell of weeks.flat()) {
      expect(cell?.count ?? 0).toBe(0);
    }
  });
});
