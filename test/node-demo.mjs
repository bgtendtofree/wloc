// Self-check: run src/wloc.js against fake WLOC responses, assert patch + diagnostics.
// Usage: node test/node-demo.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
fs.rmSync(path.join(dir, "box.dat"), { force: true });

const run = (mode) =>
	spawnSync(process.execPath, ["fixture-run.mjs", mode], {
		cwd: dir,
		encoding: "utf8",
	});
const assert = (cond, msg) => {
	if (!cond) {
		console.error("FAIL:", msg);
		process.exit(1);
	}
};

// wifi path (ArrayBuffer bodyBytes) + diagnostics + accuracy guard (locBad field3 must be skipped)
const r1 = run("wifi");
assert(
	/\[wloc\] #1 .*method=POST url=https:\/\/gs-loc\.apple\.com\/clls\/wloc/.test(
		r1.stdout,
	),
	`request line missing #1\n${r1.stdout}${r1.stderr}`,
);
assert(/#1 PATCH ok/.test(r1.stdout), `PATCH ok missing\n${r1.stdout}`);
assert(
	/accuracy 65→25/.test(r1.stdout),
	`orig→patched accuracy missing\n${r1.stdout}`,
);
assert(/locations=2 wifi=1/.test(r1.stdout), `stats missing\n${r1.stdout}`);
assert(!/aa:bb/.test(r1.stdout), "BSSID leaked into logs");

// seq persists across invocations
const r2 = run("wifi");
assert(/\[wloc\] #2 /.test(r2.stdout), `seq did not increment\n${r2.stdout}`);

// cell path (outer field 22 -> cell msg field 5)
const r3 = run("cell");
assert(
	/PATCH ok/.test(r3.stdout) && /locations=1 wifi=0 cell=1/.test(r3.stdout),
	`cell patch failed\n${r3.stdout}`,
);

// 重写行脚本 URL # 参数 (accuracy=30): 已存坐标无 accuracy → 取 # 参数
const r4 = run("args");
assert(
	/accuracy 65→30/.test(r4.stdout),
	`# argument accuracy not applied\n${r4.stdout}${r4.stderr}`,
);

// empty/short body -> silent passthrough, no PATCH fail error
const r5 = run("empty");
assert(
	/空响应/.test(r5.stdout) && !/PATCH fail/.test(r5.stdout),
	`empty body mishandled\n${r5.stdout}`,
);

// no saved coords -> passthrough mode
const r6 = run("passthrough");
assert(
	/透传模式/.test(r6.stdout) && !/PATCH ok/.test(r6.stdout),
	`passthrough failed\n${r6.stdout}`,
);

// 负坐标 (西半球): writeVarint 64 位补码编码, 独立 BigInt 实现验证字节
const r7 = run("west");
assert(
	/PATCH ok 目标: -122.01,37.33/.test(r7.stdout),
	`west target missing\n${r7.stdout}`,
);
const hexM = r7.stdout.match(/WEST_HEX ([0-9a-f]+)/);
assert(hexM, `west body not captured\n${r7.stdout}`);
const payload = Buffer.from(hexM[1], "hex").subarray(10); // 8 字节帧头 + 2 字节长度
const varint = (v) => {
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
assert(
	payload.indexOf(Buffer.from(varint(3733000000))) !== -1,
	"west lat bytes wrong",
);
assert(
	payload.indexOf(Buffer.from(varint(-12201000000))) !== -1,
	"west lon bytes wrong",
);

console.log(
	"OK: wifi(ArrayBuffer)/args(#参数)/cell/empty/passthrough/west all pass, seq increments, accuracy guard works, negative coords encode correctly, no BSSID in logs",
);
