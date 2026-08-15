// entry/wloc.js — wloc 入口 (QX/Surge 通用, 平台差异全在 Platform)
// 流程: 取响应体 → 转字节 → loadSettings → handleWloc → $done

if (typeof $response === "undefined") {
  Log.warn("[wloc] 非响应模式，跳过");
  Platform.done({});
} else {
  const settings = loadSettings(Platform.storeGet, Platform.storeSet, Platform.argument());
  settings.seq = nextSeq(Platform.storeGet, Platform.storeSet);
  Log.logLevel = settings.logLevel;
  const bytes = toByteArray(Platform.responseBodyBytes());
  const out = handleWloc(bytes, settings, {
    seq: settings.seq,
    method: Platform.requestMethod(),
    url: Platform.requestUrl(),
  });
  Platform.done(out ? Platform.wlocDone(out) : {});
}
