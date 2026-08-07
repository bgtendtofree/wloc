// Fixture: one wloc-settings.js invocation under Node. URL from argv[2].
import fs from "node:fs";
globalThis.URLSearchParams = undefined; // Shadowrocket JavaScriptCore 沙箱不提供
let box = {};
try {
	box = JSON.parse(fs.readFileSync("box.dat", "utf8"));
} catch {}
fs.writeFileSync("box.dat", JSON.stringify(box));
globalThis.$request = { url: process.argv[2] };
await import("../src/wloc-settings.js");
