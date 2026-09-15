import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (Issue #93, Spec Driven TDD): src/components/radial-chart-text
 * does not exist yet, per
 * docs/specs/issue-93-quiz-multistep-radial-results.md AC-2.
 *
 * Recharts' ResponsiveContainer measures its container via
 * getBoundingClientRect() before its first render; jsdom always reports 0x0
 * (no real layout engine) and the ResizeObserver polyfill in
 * src/tests/unit/setup.ts never fires, so without this override the chart
 * (and its centered text) never mounts at all.
 */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    bottom: 300,
    height: 300,
    left: 0,
    right: 300,
    toJSON: () => undefined,
    top: 0,
    width: 300,
    x: 0,
    y: 0,
  });
});

const { RadialChartText } = await import("@/components/radial-chart-text");

describe("RadialChartText (Issue #93)", () => {
  it("renders the center label and sublabel", () => {
    render(
      <RadialChartText centerLabel="80%" centerSublabel="8 de 10" value={80} />
    );

    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("8 de 10")).toBeInTheDocument();
  });

  it("omits the sublabel text when none is given", () => {
    render(<RadialChartText centerLabel="0%" value={0} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
