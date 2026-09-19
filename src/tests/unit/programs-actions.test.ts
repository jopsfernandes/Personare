import { describe, expect, it } from "vitest";
import {
  groupActivityCountsByProgram,
  type ProgramActivityCount,
} from "@/actions/programs";

/**
 * RED phase (Issue #99, Spec Driven TDD): src/actions/programs.ts does not
 * export groupActivityCountsByProgram yet. Every test below is expected to
 * fail until the Developer implements it, per
 * docs/specs/issue-99-programs-cards-heatmap.md AC-2.
 *
 * `groupActivityCountsByProgram` is a pure mapping function -- no I/O, no
 * ipc.client call -- from the flat rows returned by
 * ipc.client.review.listActivityCounts() to a Map keyed by programId, so
 * each card only needs its own slice.
 */

const ROWS: ProgramActivityCount[] = [
  { count: 2, date: "2026-03-10", programId: "p1" },
  { count: 1, date: "2026-03-11", programId: "p1" },
  { count: 4, date: "2026-03-10", programId: "p2" },
];

describe("groupActivityCountsByProgram (Issue #99)", () => {
  it("groups rows into one array per programId", () => {
    const grouped = groupActivityCountsByProgram(ROWS);

    expect(grouped.get("p1")).toEqual([
      { count: 2, date: "2026-03-10" },
      { count: 1, date: "2026-03-11" },
    ]);
    expect(grouped.get("p2")).toEqual([{ count: 4, date: "2026-03-10" }]);
  });

  it("returns an empty Map for an empty input", () => {
    expect(groupActivityCountsByProgram([])).toEqual(new Map());
  });

  it("returns undefined for a programId with no rows", () => {
    const grouped = groupActivityCountsByProgram(ROWS);

    expect(grouped.get("does-not-exist")).toBeUndefined();
  });
});
