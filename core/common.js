// core/common.js — 平台无关公共件: 日志 + 参数解析 + 存储辅助
// 各平台沙箱均以单脚本执行, 本文件为拼装片段, 勿加 import/export。

const Log = {
  level: 3, // 0 off, 1 error, 2 warn, 3 info, 4 debug
  groups: [],
  set logLevel(v) {
    const map = { off: 0, error: 1, warn: 2, warning: 2, info: 3, debug: 4, all: 5 };
    this.level = typeof v === "number" ? v : (map[String(v).toLowerCase()] ?? 2);
  },
  print(...args) {
    if (this.level === 0) return;
    let lines = args.flatMap((a) => {
      if (typeof a === "object") return [JSON.stringify(a)];
      if (typeof a === "bigint" || typeof a === "number" || typeof a === "boolean") return [a.toString()];
      return String(a).split(/\r?\n/);
    });
    for (const g of this.groups) {
      lines = lines.map((l) => `  ${l}`);
      lines.unshift(` ${g}:`);
    }
    console.log(["", ...lines].join("\n"));
  },
  info(...a) { if (this.level >= 3) this.print(...a.map((x) => ` ${x}`)); },
  warn(...a) { if (this.level >= 2) this.print(...a.map((x) => ` ${x}`)); },
  error(...a) { if (this.level >= 1) this.print(...a.map((x) => ` ${x}`)); },
  debug(...a) { if (this.level >= 4) this.print(...a.map((x) => ` ${x}`)); },
  group(name) { this.groups.unshift(name); },
  groupEnd() { this.groups.shift(); },
};

// key=value&... → 对象 (宽容解析)
function parseArgs(input) {
  const out = {};
  if (typeof input !== "string") return out;
  for (const pair of input.replace(/^\?/, "").split("&")) {
    if (!pair) continue;
    const i = pair.indexOf("=");
    const rawKey = i < 0 ? pair : pair.slice(0, i);
    const rawValue = i < 0 ? "" : pair.slice(i + 1);
    try {
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, " "));
    } catch {}
  }
  return out;
}

// 存储辅助: 各平台存储只收字符串, 这里统一 JSON 编解码与默认值
function storeGetParsed(storeGet, key, fallback = null) {
  let v = storeGet(key);
  try { v = JSON.parse(v); } catch {}
  return v ?? fallback;
}

function storeSetString(storeSet, key, value) {
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return storeSet(key, s);
}
