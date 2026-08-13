// Fixture: one wloc-settings.js invocation under Node. URL from argv[2].
import fs from "node:fs";
globalThis.URLSearchParams = undefined; // QX JavaScriptCore 沙箱不提供
let box = {};
try {
	box = JSON.parse(fs.readFileSync("box.dat", "utf8"));
} catch {}
fs.writeFileSync("box.dat", JSON.stringify(box));
// QX script-response-body 脚本同样从 $request.url 拿完整请求 URL
globalThis.$request = { url: process.argv[2] };
await import("../src/wloc-settings.js");
