// Fixture: simulate one Quantumult X script-response-body invocation of src/wloc.js under Node.
// Modes (argv[2]): wifi (default, ArrayBuffer body) | args | cell | empty | passthrough | west
// Frame: 8-byte header + 2-byte len + protobuf payload.
import fs from "node:fs";

globalThis.URLSearchParams = undefined; // QX JavaScriptCore 沙箱不提供

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
	case "empty":
		body = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		break;
	case "west":
		// 西半球目标: 负坐标写回 (触发 writeVarint 64 位补码编码)
		body = frame([
			...len2(2, [
				...len2(1, str("aa:bb:cc:dd:ee:ff")),
				...len2(2, [...fld(1, 3731000000), ...fld(2, 11639000000), ...fld(3, 65)]),
			]),
		]);
		break;
	default: // wifi | args | passthrough
		body = frame([
			...len2(2, [
				...len2(1, str("aa:bb:cc:dd:ee:ff")),
				...len2(2, loc),
				...len2(2, locBad),
			]),
		]);
}

// saved target settings (Node backend = box.dat); merge to preserve wloc_seq
let box = {};
try {
	box = JSON.parse(fs.readFileSync("box.dat", "utf8"));
} catch {}
const target =
	mode === "west"
		? { longitude: -122.01, latitude: 37.33 }
		: { longitude: 116.39, latitude: 39.9 };
if (mode === "passthrough") box.wloc_settings = undefined;
else if (mode === "args") box.wloc_settings = JSON.stringify(target); // 无 accuracy → 走 # 参数
else box.wloc_settings = JSON.stringify({ ...target, accuracy: 25 });
fs.writeFileSync("box.dat", JSON.stringify(box));

globalThis.$request = {
	url: "https://gs-loc.apple.com/clls/wloc",
	method: "POST",
};
// QX: $response.bodyBytes 为 ArrayBuffer (内核已解压 gzip)
const bytes = Uint8Array.from(body);
const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
globalThis.$response = {
	url: "https://gs-loc.apple.com/clls/wloc",
	statusCode: 200,
	headers: { "Content-Type": "application/x-protobuf" },
	bodyBytes: ab,
};
globalThis.$environment = {
	sourcePath:
		mode === "args"
			? "https://raw.githubusercontent.com/bgtendtofree/wloc/refs/heads/main/src/wloc.js#accuracy=30&logLevel=debug"
			: "https://raw.githubusercontent.com/bgtendtofree/wloc/refs/heads/main/src/wloc.js",
};

// west 模式: 捕获 patched 响应体并打印 hex (模块 done() 在 Node 下会先 process.exit, 需绕过)
if (mode === "west") {
	process.exit = () => {};
	globalThis.$done = (r) => {
		console.log("WEST_HEX " + Buffer.from(r?.bodyBytes ?? new Uint8Array(0)).toString("hex"));
	};
}

await import("../src/wloc.js");
