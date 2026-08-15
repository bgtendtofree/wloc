// platform/surge.js — Surge 胶水
// 只定义 Platform 对象, 不执行任何顶层逻辑。
// Surge API: $persistentStore.read/write, $argument, $utils.ungzip,
//            binary-body-mode 下 $response.body 为原始 Uint8Array (可能仍 gzip),
//            输出 $done({body, headers}) 或 $done({response:{status,headers,body}})。

const Platform = {
  name: "Surge",
  _unzipped: false, // 本次请求是否脚本侧解过 gzip

  // 存储: 只收字符串
  storeGet(key) { return $persistentStore.read(key); },
  storeSet(key, value) { return $persistentStore.write(value, key); },

  // 模块参数: [Script] 行的 argument= 参数
  argument() { return typeof $argument === "string" ? $argument : ""; },

  requestUrl() { return typeof $request !== "undefined" ? $request.url || "" : ""; },
  requestMethod() { return typeof $request !== "undefined" ? $request.method || "" : ""; },

  // 响应体: binary-body-mode 给原始字节; 若仍是 gzip 则脚本侧解压 (Surge 不自动解)
  responseBodyBytes() {
    let b = $response.body;
    if (b && b.length >= 2 && b[0] === 31 && b[1] === 139) {
      try {
        b = $utils.ungzip(b);
        this._unzipped = true;
      } catch {
        // 解压失败保持原样, patch 阶段会报 PATCH fail
      }
    }
    return b;
  },

  // wloc 输出: TypedArray body (iOS 5.4.1+/Mac 5.0.1+);
  // 若脚本侧解过 gzip 必须去 Content-Encoding, Content-Length 由内核自动重算
  wlocDone(out) {
    const r = { body: Uint8Array.from(out) };
    if (this._unzipped) {
      const h = { ...($response?.headers || {}) };
      delete h["Content-Encoding"];
      delete h["content-encoding"];
      delete h["Transfer-Encoding"];
      delete h["transfer-encoding"];
      r.headers = h;
    }
    return r;
  },

  // settings 输出: http-request 阶段直接返回合成响应, 请求不出设备
  jsonDone(result) {
    return {
      response: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      },
    };
  },

  done(r) { $done(r); },
};
