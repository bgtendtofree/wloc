// core/protobuf.js — 最小 protobuf 编解码 (varint + 常用 wire type)
// 平台无关纯函数, 字节一律用 number[] 表示。

function readVarint(data, offset) {
  let result = 0;
  let factor = 1;
  let shift = 0;
  while (offset < data.length) {
    const b = 255 & data[offset++];
    if (shift < 56) result += (127 & b) * factor;
    if (!(128 & b)) return [result, offset];
    factor *= 128;
    shift += 7;
    if (shift >= 70) throw new Error("varint too long at " + offset);
  }
  throw new Error("truncated varint");
}

// 负值按 64 位补码编码 (BigInt), 与 protobuf int64 一致
function writeVarint(value) {
  let v = BigInt.asUintN(64, BigInt(Math.floor(value)));
  const out = [];
  do {
    const b = Number(v & 127n);
    v >>= 7n;
    out.push(b | (v ? 128 : 0));
  } while (v);
  return out;
}

function concat(parts) {
  const out = [];
  for (const p of parts) for (const b of p) out.push(255 & b);
  return out;
}

function parseFields(data) {
  const fields = [];
  let offset = 0;
  while (offset < data.length) {
    const start = offset;
    const [tag, next] = readVarint(data, offset);
    offset = next;
    const fieldNo = Math.floor(tag / 8);
    const wireType = tag & 7;
    if (fieldNo === 0) throw new Error("invalid protobuf field 0 at " + start);
    let value;
    if (wireType === 0) {
      const [v, n] = readVarint(data, offset);
      value = v;
      offset = n;
    } else if (wireType === 1) {
      value = data.slice(offset, offset + 8);
      offset += 8;
    } else if (wireType === 2) {
      const [len, n] = readVarint(data, offset);
      offset = n;
      value = data.slice(offset, offset + len);
      offset += len;
    } else if (wireType === 5) {
      value = data.slice(offset, offset + 4);
      offset += 4;
    } else {
      throw new Error("unsupported wire type " + wireType);
    }
    fields.push({ fieldNo, wireType, value, raw: data.slice(start, offset) });
  }
  return fields;
}

function encodeField(fieldNo, wireType, value) {
  const head = writeVarint(fieldNo * 8 + wireType);
  if (wireType === 0) return concat([head, writeVarint(value)]);
  if (wireType === 1 || wireType === 5) return concat([head, value]);
  if (wireType === 2) return concat([head, writeVarint(value.length), value]);
  throw new Error("cannot encode wire type " + wireType);
}
