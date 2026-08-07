// Self-check: wloc-settings.js cs=gcj on-device GCJ-02 -> WGS84 conversion.
// Usage: node test/settings-demo.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
fs.rmSync(path.join(dir, "box.dat"), { force: true });

const assert = (cond, msg) => {
	if (!cond) {
		console.error("FAIL:", msg);
		process.exit(1);
	}
};
const run = (url) => {
	spawnSync(process.execPath, ["fixture-settings.mjs", url], {
		cwd: dir,
		encoding: "utf8",
	});
	return JSON.parse(
		JSON.parse(fs.readFileSync(path.join(dir, "box.dat"), "utf8"))
			.wloc_settings,
	);
};

// in-China GCJ point -> must shift (typical offset 0.001~0.01 deg)
const cn = run(
	"https://gs-loc.apple.com/wloc-settings/save?lon=116.3975&lat=39.9087&cs=gcj",
);
const shift = Math.hypot(cn.longitude - 116.3975, cn.latitude - 39.9087);
assert(
	shift > 1e-4 && shift < 2e-2,
	`in-China gcj not converted properly, shift=${shift}`,
);

// same point WITHOUT cs -> must pass through unchanged (worker already converts; no double conversion)
const raw = run(
	"https://gs-loc.apple.com/wloc-settings/save?lon=116.3975&lat=39.9087",
);
assert(
	raw.longitude === 116.3975 && raw.latitude === 39.9087,
	`no-cs point was modified: ${JSON.stringify(raw)}`,
);

// out-of-China point with cs=gcj -> must pass through unchanged
const fr = run(
	"https://gs-loc.apple.com/wloc-settings/save?lon=2.3522&lat=48.8566&cs=gcj",
);
assert(
	fr.longitude === 2.3522 && fr.latitude === 48.8566,
	`out-of-China point was modified: ${JSON.stringify(fr)}`,
);

// out-of-range lon -> rejected, store unchanged
const before = run(
	"https://gs-loc.apple.com/wloc-settings/save?lon=116.3975&lat=39.9087",
);
const after = run(
	"https://gs-loc.apple.com/wloc-settings/save?lon=999&lat=39.9087",
);
assert(
	after.longitude === before.longitude && after.latitude === before.latitude,
	`out-of-range lon not rejected: ${JSON.stringify(after)}`,
);

// negative accuracy -> rejected, store unchanged
const after2 = run(
	"https://gs-loc.apple.com/wloc-settings/save?lon=116.3975&lat=39.9087&acc=-5",
);
assert(
	after2.longitude === before.longitude && after2.latitude === before.latitude,
	`negative acc not rejected: ${JSON.stringify(after2)}`,
);

// lon=0 lat=0 (falsy-zero) -> must be saved, not dropped
const zero = run(
	"https://gs-loc.apple.com/wloc-settings/save?lon=0&lat=0",
);
assert(
	zero.longitude === 0 && zero.latitude === 0,
	`zero coord dropped: ${JSON.stringify(zero)}`,
);

console.log(
	`OK: cs=gcj in-China shift=${shift.toFixed(5)}deg, no-cs untouched, out-of-China untouched, range/acc validation rejects, zero coord accepted`,
);
