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
    if (cursor >= buffer.length) {
      throw new Error("Protobuf inválido: varint truncado");
    }

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

function assertBytesAvailable(
  buffer: Uint8Array,
  offset: number,
  length: number,
  fieldKind: string
): void {
  if (offset + length > buffer.length) {
    throw new Error(`Protobuf inválido: campo ${fieldKind} truncado`);
  }
}

interface DecodedField {
  nextOffset: number;
  // null for wire types this parser doesn't expose (fixed64/fixed32) --
  // the field still advances the offset but is skipped by the caller.
  value: Uint8Array | number | null;
}

function decodeFieldValue(
  buffer: Uint8Array,
  offset: number,
  wireType: number
): DecodedField {
  if (wireType === WIRE_TYPE_VARINT) {
    const decoded = decodeVarint(buffer, offset);
    return { nextOffset: decoded.nextOffset, value: decoded.value };
  }

  if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
    const length = decodeVarint(buffer, offset);
    assertBytesAvailable(
      buffer,
      length.nextOffset,
      length.value,
      "length-delimited"
    );
    const start = length.nextOffset;
    return {
      nextOffset: start + length.value,
      value: buffer.subarray(start, start + length.value),
    };
  }

  if (wireType === WIRE_TYPE_FIXED64) {
    assertBytesAvailable(buffer, offset, 8, "fixed64");
    return { nextOffset: offset + 8, value: null };
  }

  if (wireType === WIRE_TYPE_FIXED32) {
    assertBytesAvailable(buffer, offset, 4, "fixed32");
    return { nextOffset: offset + 4, value: null };
  }

  throw new Error(`Tipo de wire protobuf não suportado: ${wireType}`);
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
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 0x7;

    const decoded = decodeFieldValue(buffer, tag.nextOffset, wireType);
    offset = decoded.nextOffset;

    if (decoded.value === null) {
      continue;
    }

    const existing = fields.get(fieldNumber);
    if (existing) {
      existing.push(decoded.value);
    } else {
      fields.set(fieldNumber, [decoded.value]);
    }
  }

  return fields;
}
