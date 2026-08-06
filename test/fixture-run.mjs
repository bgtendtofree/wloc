// Fixture: simulate one Surge http-response invocation of dist/wloc.js under Node.
// Builds a minimal WLOC frame: 8-byte header + 2-byte len + protobuf payload.
// Payload: outer field 2 (wifi) -> wifi msg field 1 = MAC, field 2 = location{f1 latE8, f2 lonE8, f3 acc}.
import fs from "node:fs";

const vi = (e) => { const t = []; let a = Math.floor(e); for (; a >= 128;) t.push(a % 128 | 128), a = Math.floor(a / 128); t.push(a); return t; };
const tag = (f, w) => vi(f * 8 + w);
const fld = (f, v) => [...tag(f, 0), ...vi(v)];
const len2 = (f, b) => [...tag(f, 2), ...vi(b.length), ...b];
const str = (s) => [...s].map((c) => c.charCodeAt(0));

// "real" location in the fake Apple response: acc=65
const loc = [...fld(1, 3990000000), ...fld(2, 11639000000), ...fld(3, 65)];
const locBad = [...fld(1, 3990000001), ...fld(2, 11639000001), ...fld(3, 72057594037927940)];
const wifi = [...len2(1, str("aa:bb:cc:dd:ee:ff")), ...len2(2, loc), ...len2(2, locBad)];
const outer = [...len2(2, wifi)];
const body = [0, 0, 0, 0, 0, 0, 0, 0, (outer.length >> 8) & 255, outer.length & 255, ...outer];

// saved target settings (Storage Node backend = box.dat); merge to preserve wloc_seq
let box = {};
try { box = JSON.parse(fs.readFileSync("box.dat", "utf8")); } catch {}
box.wloc_settings = JSON.stringify({ longitude: 116.39, latitude: 39.9, accuracy: 25 });
fs.writeFileSync("box.dat", JSON.stringify(box));

globalThis.$request = { url: "https://gs-loc.apple.com/clls/wloc", method: "POST" };
globalThis.$response = {
  url: "https://gs-loc.apple.com/clls/wloc",
  status: 200,
  headers: { "Content-Type": "application/x-protobuf" },
  bodyBytes: new Uint8Array(body).buffer
};

await import("../dist/wloc.js");
