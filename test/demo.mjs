// test/demo.mjs — 自检: build 拼接产物在 vm 中按平台假全局执行, 断言 patch 行为与输出格式。
// 覆盖: wifi/cell/gzip(Surge)/empty/passthrough/west/#参数 + settings 全参数分支。
// 用法: node test/demo.mjs
import vm from "node:vm";
import zlib from "node:zlib";
import { build } from "../build.mjs";
import { wlocBody, WLOC_URL, SAVE_URL, varintBytes } from "./fixtures.mjs";

const files = build();
const assert = (cond, msg) => {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
};

const baseGlobals = () => ({
  Object, Array, String, Number, Boolean, JSON, Math, Date, RegExp, Error,
  BigInt, Uint8Array, ArrayBuffer, decodeURIComponent, encodeURIComponent,
  parseInt, parseFloat, isFinite, isNaN, Symbol,
});

const makeLog = () => {
  const lines = [];
  return { console: { log: (...a) => lines.push(a.map((x) => String(x)).join(" ")) }, lines };
};

// --- 平台假存储 (只收字符串) ---
const qxPrefs = (seed = {}) => {
  const data = { ...seed };
  return {
    data,
    valueForKey(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setValueForKey(v, k) { data[k] = String(v); return true; },
  };
};
const surgeStore = (seed = {}) => {
  const data = { ...seed };
  return {
    data,
    read(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    write(v, k) { data[k] = String(v); return true; },
  };
};

const toArrayBuffer = (bytes) => {
  const b = Uint8Array.from(bytes);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

const runInVm = (code, extra) => {
  let donePayload;
  const { console, lines } = makeLog();
  const sandbox = { ...baseGlobals(), console, $done: (r) => { donePayload = r; }, ...extra };
  vm.runInNewContext(code, sandbox, { timeout: 5000 });
  return { donePayload, logs: lines.join("\n") };
};

const seedWloc = (mode) => {
  const target = mode === "west" ? { longitude: -122.01, latitude: 37.33 } : { longitude: 116.39, latitude: 39.9 };
  if (mode === "passthrough") return {};
  if (mode === "args") return { wloc_settings: JSON.stringify(target) }; // 无 accuracy → 走模块参数
  return { wloc_settings: JSON.stringify({ ...target, accuracy: 25 }) };
};

// ==================== QX: wloc ====================
{
  const prefs = qxPrefs(seedWloc("wifi"));
  const run = (mode) => {
    // 按 mode 重播坐标种子, 保留 wloc_seq (跨请求序号)
    const seed = seedWloc(mode);
    if (seed.wloc_settings) prefs.data.wloc_settings = seed.wloc_settings;
    else delete prefs.data.wloc_settings;
    return runInVm(files["dist/qx/wloc.js"], {
      $request: { url: WLOC_URL, method: "POST" },
      $response: {
        url: WLOC_URL,
        statusCode: 200,
        headers: { "Content-Type": "application/x-protobuf" },
        bodyBytes: toArrayBuffer(wlocBody(mode)),
      },
      $environment: {
        sourcePath:
          mode === "args"
            ? "https://raw.githubusercontent.com/bgtendtofree/wloc/refs/heads/main/dist/qx/wloc.js#accuracy=30&logLevel=debug"
            : "https://raw.githubusercontent.com/bgtendtofree/wloc/refs/heads/main/dist/qx/wloc.js",
      },
      $prefs: prefs,
    });
  };

  const r1 = run("wifi");
  assert(
    /\[wloc\] #1 .*method=POST url=https:\/\/gs-loc\.apple\.com\/clls\/wloc/.test(r1.logs),
    `QX wifi: request line missing #1\n${r1.logs}`,
  );
  assert(/#1 PATCH ok/.test(r1.logs), `QX wifi: PATCH ok missing\n${r1.logs}`);
  assert(/accuracy 65→25/.test(r1.logs), `QX wifi: accuracy missing\n${r1.logs}`);
  assert(/locations=2 wifi=1/.test(r1.logs), `QX wifi: stats missing\n${r1.logs}`);
  assert(!/aa:bb/.test(r1.logs), "QX wifi: BSSID leaked into logs");
  assert(r1.donePayload?.bodyBytes instanceof ArrayBuffer, "QX wifi: bodyBytes 输出应为 ArrayBuffer");

  const r2 = run("wifi");
  assert(/\[wloc\] #2 /.test(r2.logs), `QX: seq did not increment\n${r2.logs}`);

  const r3 = run("cell");
  assert(/PATCH ok/.test(r3.logs) && /locations=1 wifi=0 cell=1/.test(r3.logs), `QX cell: patch failed\n${r3.logs}`);

  const r4 = run("args");
  assert(/accuracy 65→30/.test(r4.logs), `QX args: # 参数 accuracy 未生效\n${r4.logs}`);

  const r5 = run("empty");
  assert(/空响应/.test(r5.logs) && !/PATCH fail/.test(r5.logs), `QX empty: mishandled\n${r5.logs}`);

  const r6 = run("passthrough");
  assert(/透传模式/.test(r6.logs) && !/PATCH ok/.test(r6.logs), `QX passthrough: failed\n${r6.logs}`);
  assert(!r6.donePayload.bodyBytes, "QX passthrough: 透传不应有 bodyBytes");

  const r7 = run("west");
  assert(/PATCH ok 目标: -122.01,37.33/.test(r7.logs), `QX west: target missing\n${r7.logs}`);
  const payload = Buffer.from(new Uint8Array(r7.donePayload.bodyBytes)).subarray(10);
  assert(payload.indexOf(Buffer.from(varintBytes(3733000000))) !== -1, "QX west: lat bytes wrong");
  assert(payload.indexOf(Buffer.from(varintBytes(-12201000000))) !== -1, "QX west: lon bytes wrong");
}

// ==================== Surge: wloc ====================
{
  const store = surgeStore(seedWloc("wifi"));
  const run = (mode) => {
    const seed = seedWloc(mode);
    if (seed.wloc_settings) store.data.wloc_settings = seed.wloc_settings;
    else delete store.data.wloc_settings;
    let body;
    let headers = { "Content-Type": "application/x-protobuf" };
    if (mode === "gzip") {
      body = new Uint8Array(zlib.gzipSync(Buffer.from(wlocBody("wifi"))));
      headers["Content-Encoding"] = "gzip";
    } else {
      body = Uint8Array.from(wlocBody(mode));
    }
    return runInVm(files["dist/surge/wloc.js"], {
      $request: { url: WLOC_URL, method: "POST" },
      $response: { url: WLOC_URL, status: 200, headers, body },
      $persistentStore: store,
      $argument: "accuracy=25&logLevel=info",
      $utils: { ungzip: (b) => new Uint8Array(zlib.gunzipSync(Buffer.from(b))) },
    });
  };

  const r1 = run("wifi");
  assert(/#1 PATCH ok/.test(r1.logs) && /locations=2 wifi=1/.test(r1.logs), `Surge wifi: patch failed\n${r1.logs}`);
  assert(r1.donePayload?.body instanceof Uint8Array, "Surge wifi: body 输出应为 Uint8Array");
  assert(!r1.donePayload.headers, "Surge wifi: 未解压不应带 headers");

  const r2 = run("gzip");
  assert(/PATCH ok/.test(r2.logs), `Surge gzip: patch failed\n${r2.logs}`);
  assert(r2.donePayload.headers && !("Content-Encoding" in r2.donePayload.headers), "Surge gzip: 解压后未去 Content-Encoding");

  const r3 = run("passthrough");
  assert(/透传模式/.test(r3.logs) && !/PATCH ok/.test(r3.logs), `Surge passthrough: failed\n${r3.logs}`);
  assert(!r3.donePayload.body, "Surge passthrough: 透传不应有 body");

  const r4 = run("west");
  assert(/PATCH ok 目标: -122.01,37.33/.test(r4.logs), `Surge west: target missing\n${r4.logs}`);
  const payload = Buffer.from(r4.donePayload.body).subarray(10);
  assert(payload.indexOf(Buffer.from(varintBytes(3733000000))) !== -1, "Surge west: lat bytes wrong");
  assert(payload.indexOf(Buffer.from(varintBytes(-12201000000))) !== -1, "Surge west: lon bytes wrong");
}

// ==================== settings: 双平台 ====================
{
  const urls = {
    gcj: `${SAVE_URL}?lon=116.3975&lat=39.9087&cs=gcj`,
    raw: `${SAVE_URL}?lon=116.3975&lat=39.9087`,
    fr: `${SAVE_URL}?lon=2.3522&lat=48.8566&cs=gcj`,
    badLon: `${SAVE_URL}?lon=999&lat=39.9087`,
    badAcc: `${SAVE_URL}?lon=116.3975&lat=39.9087&acc=-5`,
    zero: `${SAVE_URL}?lon=0&lat=0`,
    clear: `${SAVE_URL}?action=clear`,
  };
  const getSaved = (store) => JSON.parse(store.data.wloc_settings);

  // QX: script-response-body 场景 ($response 存在, 覆盖 404)
  const qxP = qxPrefs();
  const runQX = (u) =>
    runInVm(files["dist/qx/wloc-settings.js"], {
      $request: { url: u },
      $response: { statusCode: 404, headers: {}, bodyBytes: new ArrayBuffer(9) },
      $prefs: qxP,
      $environment: { sourcePath: "https://raw.githubusercontent.com/bgtendtofree/wloc/refs/heads/main/dist/qx/wloc-settings.js" },
    });

  const q1 = runQX(urls.gcj);
  assert(q1.donePayload.status === "HTTP/1.1 200 OK" && JSON.parse(q1.donePayload.body).success, `QX settings gcj: 输出格式错\n${q1.logs}`);
  const cn = getSaved(qxP);
  const shift = Math.hypot(cn.longitude - 116.3975, cn.latitude - 39.9087);
  assert(shift > 1e-4 && shift < 2e-2, `QX settings: gcj 未正确换算, shift=${shift}`);

  const q2 = runQX(urls.raw);
  const raw = getSaved(qxP);
  assert(raw.longitude === 116.3975 && raw.latitude === 39.9087, `QX settings: 无 cs 点被改 ${JSON.stringify(raw)}`);

  const q3 = runQX(urls.fr);
  const fr = getSaved(qxP);
  assert(fr.longitude === 2.3522 && fr.latitude === 48.8566, `QX settings: 境外点被改 ${JSON.stringify(fr)}`);

  runQX(urls.badLon);
  const afterBad = getSaved(qxP);
  assert(afterBad.longitude === 2.3522, `QX settings: 越界 lon 未拒绝 ${JSON.stringify(afterBad)}`);

  runQX(urls.badAcc);
  assert(getSaved(qxP).longitude === 2.3522, "QX settings: 负 acc 未拒绝");

  runQX(urls.zero);
  const zero = getSaved(qxP);
  assert(zero.longitude === 0 && zero.latitude === 0, `QX settings: 零坐标被丢 ${JSON.stringify(zero)}`);

  const q4 = runQX(urls.clear);
  assert(JSON.parse(q4.donePayload.body).success, `QX settings clear: 失败\n${q4.logs}`);

  // Surge: http-request 阶段合成响应 (请求不出设备)
  const store = surgeStore();
  const runSurge = (u) =>
    runInVm(files["dist/surge/wloc-settings.js"], {
      $request: { url: u },
      $persistentStore: store,
      $argument: "",
    });

  const s1 = runSurge(urls.gcj);
  assert(
    s1.donePayload.response?.status === 200 && JSON.parse(s1.donePayload.response.body).success,
    `Surge settings gcj: 输出格式错\n${s1.logs}`,
  );
  const scn = getSaved(store);
  const sshift = Math.hypot(scn.longitude - 116.3975, scn.latitude - 39.9087);
  assert(sshift > 1e-4 && sshift < 2e-2, `Surge settings: gcj 未正确换算, shift=${sshift}`);

  runSurge(urls.zero);
  const szero = getSaved(store);
  assert(szero.longitude === 0 && szero.latitude === 0, `Surge settings: 零坐标被丢 ${JSON.stringify(szero)}`);

  const s2 = runSurge(urls.clear);
  assert(JSON.parse(s2.donePayload.response.body).success && store.data.wloc_settings === "null", `Surge settings clear: 失败\n${s2.logs}`);
}

console.log(
  "OK: QX(wifi ArrayBuffer/seq/cell/#参数/empty/passthrough/west+负坐标字节) + Surge(wifi/gzip去头/passthrough/west) + settings 双平台(gcj换算/无cs/境外/越界/负acc/零坐标/clear) 全部通过",
);
