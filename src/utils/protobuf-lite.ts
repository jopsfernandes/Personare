// biome-ignore-all lint/suspicious/noBitwiseOperators: bitwise math is inherent to decoding protobuf's varint/tag wire format
const WIRE_TYPE_VARINT = 0;
const WIRE_TYPE_FIXED64 = 1;
const WIRE_TYPE_LENGTH_DELIMITED = 2;
const WIRE_TYPE_FIXED32 = 5;

export interface DecodedVarint {
  nextOffset: number;
  value: number;
}

export function decodeVarint(
  buffer: Uint8Array,
  offset: number
): DecodedVarint {
  let value = 0;
  let shift = 0;
  let cursor = offset;

  for (;;) {
    const byte = buffer[cursor];
    cursor += 1;
    value += (byte & 0x7f) * 2 ** shift;

    if ((byte & 0x80) === 0) {
      break;
    }

    shift += 7;
  }

  return { nextOffset: cursor, value };
}

/**
 * Decodes a flat protobuf message into its raw fields, grouped by field
 * number (repeated fields share a number, appearing in encounter order).
 * Only wire types 0 (varint) and 2 (length-delimited) are exposed as
 * values -- 1 (fixed64) and 5 (fixed32) are skipped, since none of the
 * Anki messages this parser reads use them.
 */
export function decodeFields(
  buffer: Uint8Array
): Map<number, (Uint8Array | number)[]> {
  const fields = new Map<number, (Uint8Array | number)[]>();
  let offset = 0;

  while (offset < buffer.length) {
    const tag = decodeVarint(buffer, offset);
    offset = tag.nextOffset;
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 0x7;

    let value: Uint8Array | number;

    if (wireType === WIRE_TYPE_VARINT) {
      const { nextOffset, value: decodedValue } = decodeVarint(buffer, offset);
      offset = nextOffset;
      value = decodedValue;
    } else if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
      const { nextOffset, value: length } = decodeVarint(buffer, offset);
      offset = nextOffset;
      value = buffer.subarray(offset, offset + length);
      offset += length;
    } else if (wireType === WIRE_TYPE_FIXED64) {
      offset += 8;
      continue;
    } else if (wireType === WIRE_TYPE_FIXED32) {
      offset += 4;
      continue;
    } else {
      throw new Error(`Unsupported protobuf wire type: ${wireType}`);
    }

    const existing = fields.get(fieldNumber);
    if (existing) {
      existing.push(value);
    } else {
      fields.set(fieldNumber, [value]);
    }
  }

  return fields;
}
