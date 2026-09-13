import { describe, expect, it } from "vitest";

/**
 * RED phase (Issue #29, Spec Driven TDD): src/utils/protobuf-lite.ts does
 * not exist yet. Every test below is expected to fail until the Developer
 * implements decodeVarint/decodeFields per
 * docs/specs/issue-29-anki-apkg-parser.md AC-3.
 */

describe("protobuf-lite (Issue #29)", () => {
  describe("decodeVarint", () => {
    it("decodes a single-byte varint", async () => {
      const { decodeVarint } = await import("@/utils/protobuf-lite");

      expect(decodeVarint(Uint8Array.of(0x03), 0)).toEqual({
        nextOffset: 1,
        value: 3,
      });
    });

    it("decodes a multi-byte varint (300)", async () => {
      const { decodeVarint } = await import("@/utils/protobuf-lite");

      expect(decodeVarint(Uint8Array.of(0xac, 0x02), 0)).toEqual({
        nextOffset: 2,
        value: 300,
      });
    });

    it("starts decoding at the given offset", async () => {
      const { decodeVarint } = await import("@/utils/protobuf-lite");

      expect(decodeVarint(Uint8Array.of(0xff, 0xac, 0x02), 1)).toEqual({
        nextOffset: 3,
        value: 300,
      });
    });
  });

  describe("decodeFields", () => {
    it("decodes a single varint field (wire type 0)", async () => {
      const { decodeFields } = await import("@/utils/protobuf-lite");

      // field 1, wire type 0 (varint), value 3
      const buffer = Uint8Array.of(0x08, 0x03);

      expect(decodeFields(buffer)).toEqual(new Map([[1, [3]]]));
    });

    it("decodes a single length-delimited field (wire type 2)", async () => {
      const { decodeFields } = await import("@/utils/protobuf-lite");

      // field 1, wire type 2 (length-delimited), length 2, bytes "ok"
      const buffer = Uint8Array.of(0x0a, 0x02, 0x6f, 0x6b);

      const result = decodeFields(buffer);
      expect(result.size).toBe(1);
      expect(result.get(1)).toEqual([Uint8Array.of(0x6f, 0x6b)]);
    });

    it("groups repeated occurrences of the same field number in order", async () => {
      const { decodeFields } = await import("@/utils/protobuf-lite");

      // field 1 (length-delimited) "a", then field 1 (length-delimited) "b"
      const buffer = Uint8Array.of(0x0a, 0x01, 0x61, 0x0a, 0x01, 0x62);

      expect(decodeFields(buffer)).toEqual(
        new Map([[1, [Uint8Array.of(0x61), Uint8Array.of(0x62)]]])
      );
    });

    it("skips unknown fixed64/fixed32 fields without corrupting later fields", async () => {
      const { decodeFields } = await import("@/utils/protobuf-lite");

      const buffer = Uint8Array.of(
        // field 5, wire type 1 (fixed64): 8 bytes of padding
        0x29,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        // field 6, wire type 5 (fixed32): 4 bytes of padding
        0x35,
        0,
        0,
        0,
        0,
        // field 1, wire type 0 (varint), value 3 -- must still decode correctly
        0x08,
        0x03
      );

      expect(decodeFields(buffer)).toEqual(new Map([[1, [3]]]));
    });
  });
});
