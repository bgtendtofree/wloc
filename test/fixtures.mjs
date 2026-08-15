// test/fixtures.mjs — 假 WLOC 响应构造 (QX/Surge 双平台共用)
// 帧结构: 8 字节头 + 2 字节大端长度 + protobuf payload。

export const vi = (e) => {
  const t = [];
  let a = Math.floor(e);
  while (a >= 128) {
    t.push((a % 128) | 128);
    a = Math.floor(a / 128);
  }
  t.push(a);
  return t;
};
export const tag = (f, w) => vi(f * 8 + w);
export const fld = (f, v) => [...tag(f, 0), ...vi(v)];
export const len2 = (f, b) => [...tag(f, 2), ...vi(b.length), ...b];
export const str = (s) => [...s].map((c) => c.charCodeAt(0));
export const frame = (payload) => [
  0, 0, 0, 0, 0, 0, 0, 0,
  (payload.length >> 8) & 255,
  payload.length & 255,
  ...payload,
];

export const loc = [...fld(1, 3990000000), ...fld(2, 11639000000), ...fld(3, 65)];
export const locBad = [
  ...fld(1, 3990000001),
  ...fld(2, 11639000001),
  ...fld(3, 72057594037927940),
];

// mode: wifi(默认) | cell | empty | west | passthrough/args (同 wifi)
export function wlocBody(mode = "wifi") {
  switch (mode) {
    case "cell":
      // outer field 22 (cell) -> cell msg field 5 -> location
      return frame([...len2(22, [...len2(5, loc)])]);
    case "empty":
      return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    case "west":
      // 西半球目标: 负坐标写回 (触发 writeVarint 64 位补码编码)
      return frame([
        ...len2(2, [
          ...len2(1, str("aa:bb:cc:dd:ee:ff")),
          ...len2(2, [...fld(1, 3731000000), ...fld(2, 11639000000), ...fld(3, 65)]),
        ]),
      ]);
    default: // wifi | args | passthrough
      return frame([
        ...len2(2, [
          ...len2(1, str("aa:bb:cc:dd:ee:ff")),
          ...len2(2, loc),
          ...len2(2, locBad),
        ]),
      ]);
  }
}

export const WLOC_URL = "https://gs-loc.apple.com/clls/wloc";
export const SAVE_URL = "https://gs-loc.apple.com/wloc-settings/save";

// 独立实现的正整数 varint 编码 (负值取 64 位补码), 用于验证 writeVarint 输出字节
export const varintBytes = (v) => {
  let x = BigInt(v);
  if (x < 0n) x = BigInt.asUintN(64, x);
  const out = [];
  do {
    let b = Number(x & 0x7fn);
    x >>= 7n;
    out.push(b | (x ? 0x80 : 0));
  } while (x);
  return out;
};
