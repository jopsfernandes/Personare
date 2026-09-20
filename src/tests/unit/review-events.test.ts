import { describe, expect, it, vi } from "vitest";
import {
  notifyReviewCompleted,
  onReviewCompleted,
} from "@/utils/review-events";

describe("review-events (streak refresh bug)", () => {
  it("calls every subscribed listener when a review completes", () => {
    const first = vi.fn();
    const second = vi.fn();
    onReviewCompleted(first);
    onReviewCompleted(second);

    notifyReviewCompleted();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops calling a listener once it unsubscribes", () => {
    const listener = vi.fn();
    const unsubscribe = onReviewCompleted(listener);

    unsubscribe();
    notifyReviewCompleted();

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not throw when there are no listeners", () => {
    expect(() => notifyReviewCompleted()).not.toThrow();
  });

  it("only unsubscribes the specific listener, not others added after it", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = onReviewCompleted(first);

    unsubscribeFirst();
    onReviewCompleted(second);
    notifyReviewCompleted();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
