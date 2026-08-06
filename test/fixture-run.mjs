// Fixture: simulate one Shadowrocket http-response invocation of src/wloc.js under Node.
// Modes (argv[2]): wifi (default) | cell | gzip | empty | passthrough
// Frame: 8-byte header + 2-byte len + protobuf payload.
import fs from "node:fs";
import zlib from "node:zlib";

const mode = process.argv[2] || "wifi";

const vi = (e) => {
	const t = [];
	let a = Math.floor(e);
	while (a >= 128) {
		t.push((a % 128) | 128);
		a = Math.floor(a / 128);
	}
	t.push(a);
	return t;
};
const tag = (f, w) => vi(f * 8 + w);
const fld = (f, v) => [...tag(f, 0), ...vi(v)];
const len2 = (f, b) => [...tag(f, 2), ...vi(b.length), ...b];
const str = (s) => [...s].map((c) => c.charCodeAt(0));
const frame = (payload) => [
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	(payload.length >> 8) & 255,
	payload.length & 255,
	...payload,
];

const loc = [...fld(1, 3990000000), ...fld(2, 11639000000), ...fld(3, 65)];
const locBad = [
	...fld(1, 3990000001),
	...fld(2, 11639000001),
	...fld(3, 72057594037927940),
];

let body;
switch (mode) {
	case "cell":
		// outer field 22 (cell) -> cell msg field 5 -> location
		body = frame([...len2(22, [...len2(5, loc)])]);
		break;
	case "gzip":
		body = zlib.gzipSync(
			Buffer.from(
				frame([
					...len2(2, [...len2(1, str("aa:bb:cc:dd:ee:ff")), ...len2(2, loc)]),
				]),
			),
		);
		break;
	case "empty":
		body = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		break;
	default: // wifi | passthrough
		body = frame([
			...len2(2, [
				...len2(1, str("aa:bb:cc:dd:ee:ff")),
				...len2(2, loc),
				...len2(2, locBad),
			]),
		]);
}

// saved target settings (Storage Node backend = box.dat); merge to preserve wloc_seq
let box = {};
try {
	box = JSON.parse(fs.readFileSync("box.dat", "utf8"));
} catch {}
if (mode === "passthrough") box.wloc_settings = undefined;
else
	box.wloc_settings = JSON.stringify({
		longitude: 116.39,
		latitude: 39.9,
		accuracy: 25,
	});
fs.writeFileSync("box.dat", JSON.stringify(box));

globalThis.$request = {
	url: "https://gs-loc.apple.com/clls/wloc",
	method: "POST",
};
globalThis.$response = {
	url: "https://gs-loc.apple.com/clls/wloc",
	status: 200,
	headers: { "Content-Type": "application/x-protobuf" },
	bodyBytes: new Uint8Array(body).buffer,
};

await import("../src/wloc.js");
