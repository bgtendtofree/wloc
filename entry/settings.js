// entry/settings.js — wloc-settings 入口 (QX/Surge 通用, 平台差异全在 Platform)
// QX 在响应阶段执行 (覆盖 Apple 404); Surge 在请求阶段执行 (直接合成响应, 不出设备)。
// 两种场景都从 $request.url 取参数, 输出由 Platform.jsonDone 定型。

const url = Platform.requestUrl();
const query = parseQuery(url.split("?")[1] || "");
const result = processSettings(query, Platform.storeGet, Platform.storeSet);
Platform.done(Platform.jsonDone(result));
