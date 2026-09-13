import { describe, expect, it } from "vitest";

/**
 * RED phase (Issue #29, Spec Driven TDD): src/utils/zstd.ts does not exist
 * yet. Every test below is expected to fail until the Developer implements
 * zstdCompress/zstdDecompress per docs/specs/issue-29-anki-apkg-parser.md
 * AC-1.
 */

describe("zstd (Issue #29)", () => {
  it("round-trips a buffer through zstdCompress/zstdDecompress", async () => {
    const { zstdCompress, zstdDecompress } = await import("@/utils/zstd");

    const original = Buffer.from(
      "the quick brown fox jumps over the lazy dog".repeat(10),
      "utf-8"
    );

    const compressed = await zstdCompress(original);
    const decompressed = await zstdDecompress(compressed);

    expect(decompressed.equals(original)).toBe(true);
  });

  it("produces output smaller than the input for repetitive data", async () => {
    const { zstdCompress } = await import("@/utils/zstd");

    const original = Buffer.from("a".repeat(10_000), "utf-8");
    const compressed = await zstdCompress(original);

    expect(compressed.length).toBeLessThan(original.length);
  });
});
