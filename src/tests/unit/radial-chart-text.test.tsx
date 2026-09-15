import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/**
 * RED phase (Issue #93, Spec Driven TDD): src/components/radial-chart-text
 * does not exist yet, per
 * docs/specs/issue-93-quiz-multistep-radial-results.md AC-2.
 */

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
