// platform/qx.js — Quantumult X 胶水
// 只定义 Platform 对象, 不执行任何顶层逻辑。核心经注入的存储/参数函数使用本层。
// QX API: $prefs.valueForKey/setValueForKey, $response.bodyBytes(内核已解压 gzip),
//         脚本 URL # 参数经 $environment.sourcePath, 输出 $done({bodyBytes})。

const Platform = {
  name: "QX",

  // 存储: 只收字符串
  storeGet(key) { return $prefs.valueForKey(key); },
  storeSet(key, value) { return $prefs.setValueForKey(value, key); },

  // 模块参数: 脚本 URL 的 # 之后 (# 内容不发送到服务器)
  argument() {
    try {
      const sp = globalThis.$environment?.sourcePath || "";
      const i = sp.indexOf("#");
      return i >= 0 ? sp.slice(i + 1) : "";
    } catch {
      return "";
    }
  },

  requestUrl() { return typeof $request !== "undefined" ? $request.url || "" : ""; },
  requestMethod() { return typeof $request !== "undefined" ? $request.method || "" : ""; },

  // 响应体: QX 内核已自动解压 gzip, 直接给 ArrayBuffer
  responseBodyBytes() { return $response.bodyBytes; },

  // wloc 输出: 官方示例要求用 buffer.slice 裁掉可能的偏移
  wlocDone(out) {
    const b = Uint8Array.from(out);
    return { bodyBytes: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  },

  // settings 输出: status 为完整状态行
  jsonDone(result) {
    return {
      status: "HTTP/1.1 200 OK",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  },

  done(r) { $done(r); },
};
