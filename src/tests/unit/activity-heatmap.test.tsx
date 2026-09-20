import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import "@/localization/i18n";

/**
 * RED phase (Issue #99, Spec Driven TDD): src/components/activity-heatmap.tsx
 * does not exist yet. Every test below is expected to fail until the
 * Developer implements it, per
 * docs/specs/issue-99-programs-cards-heatmap.md AC-4.
 */

describe("ActivityHeatmap (Issue #99)", () => {
  it("renders an accessible img role summarizing the total count in the window", () => {
    render(
      <ActivityHeatmap
        color="#ef4444"
        counts={[
          { count: 2, date: "2026-03-10" },
          { count: 3, date: "2026-03-11" },
        ]}
      />
    );

    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toContain("5");
  });

  it("renders without crashing when there is no activity at all", () => {
    render(<ActivityHeatmap color="#ef4444" counts={[]} />);

    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toContain("0");
  });
});
