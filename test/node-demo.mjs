// Self-check: run dist/wloc.js twice against a fake WLOC response, assert diagnostics.
// Usage: node test/node-demo.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const dir = path.dirname(fileURLToPath(import.meta.url));
fs.rmSync(path.join(dir, "box.dat"), { force: true });

const run = () => spawnSync(process.execPath, ["fixture-run.mjs"], { cwd: dir, encoding: "utf8" });

const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1); } };

const r1 = run();
assert(/\[wloc\] #1 .*method=POST url=https:\/\/gs-loc\.apple\.com\/clls\/wloc/.test(r1.stdout), `request line missing #1\n${r1.stdout}${r1.stderr}`);
assert(/#1 PATCH ok/.test(r1.stdout), `PATCH ok missing\n${r1.stdout}`);
assert(/accuracy 65→25/.test(r1.stdout), `orig→patched accuracy missing\n${r1.stdout}`);
assert(/locations=2 wifi=1/.test(r1.stdout), `stats missing\n${r1.stdout}`);
assert(!/aa:bb/.test(r1.stdout), "BSSID leaked into logs");

const r2 = run();
assert(/\[wloc\] #2 /.test(r2.stdout), `seq did not increment\n${r2.stdout}`);

console.log("OK: seq increments, PATCH ok logged, accuracy 65→25 logged, no BSSID in logs");
