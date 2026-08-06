/* src/wloc-settings.js — Apple WLOC 定位修改 (Shadowrocket)
 * 拦截 gs-loc(-cn).apple.com/wloc-settings/save 请求, 读写 $persistentStore 中的目标坐标。
 * 全程设备内完成; cs=gcj 时输入按 GCJ-02 处理, 设备端转 WGS84 再储存。
 * 源码即发布物, 无构建步骤。
 */

// ==================== 运行环境 ====================
const ENV = typeof process !== "undefined" && process?.versions?.node ? "Node" : "Proxy";

// ==================== 日志 ====================
const Log = {
  level: 3,
  set logLevel(v) {
    const map = { off: 0, error: 1, warn: 2, warning: 2, info: 3, debug: 4, all: 5 };
    this.level = typeof v === "number" ? v : (map[String(v).toLowerCase()] ?? 2);
  },
  print(...args) {
    if (this.level === 0) return;
    const lines = args.flatMap((a) => {
      if (typeof a === "object") return [JSON.stringify(a)];
      return String(a).split(/\r?\n/);
    });
    console.log(["", ...lines].join("\n"));
  },
  info(...a) { if (this.level >= 3) this.print(...a.map((x) => ` ${x}`)); },
  error(...a) { if (this.level >= 1) this.print(...a.map((x) => ` ${x?.stack ?? x}`)); },
  debug(...a) { if (this.level >= 4) this.print(...a.map((x) => ` ${x}`)); },
};

// ==================== 持久化存储 ====================
const Store = {
  get(key, fallback = null) {
    let v = ENV === "Node" ? readBox()[key] : $persistentStore.read(key);
    try { v = JSON.parse(v); } catch {}
    return v ?? fallback;
  },
  set(key, value) {
    const s = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (ENV === "Node") {
      const box = readBox();
      box[key] = s;
      writeBox(box);
      return true;
    }
    return $persistentStore.write(s, key);
  },
};

function readBox() {
  try {
    return JSON.parse(require("fs").readFileSync("box.dat", "utf8"));
  } catch {
    return {};
  }
}
function writeBox(box) {
  require("fs").writeFileSync("box.dat", JSON.stringify(box));
}

// ==================== 结束 ====================
function done(result = {}) {
  Log.info(" 执行结束!");
  if (ENV === "Node") process.exit(1);
  if (typeof $done === "function") $done(result);
}

// ==================== GCJ-02 → WGS84 (设备端换算) ====================
// 中国大陆苹果地图/高德坐标为 GCJ-02 偏移坐标; 迭代反算收敛到亚米级。
const GCJ_A = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

const gcjOutOfChina = (lon, lat) => lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271;

function gcjDeltaLat(x, y) {
  let r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  r += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  r += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return r;
}

function gcjDeltaLon(x, y) {
  let r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  r += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  r += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return r;
}

// WGS84 -> GCJ-02 (正向偏移)
function wgs84ToGcj02(lat, lon) {
  if (gcjOutOfChina(lon, lat)) return { lat, lon };
  let dLat = gcjDeltaLat(lon - 105.0, lat - 35.0);
  let dLon = gcjDeltaLon(lon - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  dLon = (dLon * 180.0) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lon: lon + dLon };
}

// GCJ-02 -> WGS84 (不动点迭代反算, <0.1m)
function gcj02ToWgs84(lat, lon) {
  if (gcjOutOfChina(lon, lat)) return { lat, lon };
  let wgsLat = lat;
  let wgsLon = lon;
  for (let i = 0; i < 6; i++) {
    const g = wgs84ToGcj02(wgsLat, wgsLon);
    const errLat = g.lat - lat;
    const errLon = g.lon - lon;
    if (Math.abs(errLat) < 1e-9 && Math.abs(errLon) < 1e-9) break;
    wgsLat -= errLat;
    wgsLon -= errLon;
  }
  return { lat: wgsLat, lon: wgsLon };
}

// ==================== 请求处理 ====================
const KEY = "wloc_settings";

function parseQuery(url) {
  const out = new Map();
  const qs = url.split("?")[1] || "";
  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const i = pair.indexOf("=");
    const k = i === -1 ? pair : pair.slice(0, i);
    const v = i === -1 ? "" : pair.slice(i + 1);
    const dk = safeDecode(k);
    if (!out.has(dk)) out.set(dk, safeDecode(v));
  }
  return out;
}
function safeDecode(s) {
  try {
    return decodeURIComponent(String(s).replace(/\+/g, " "));
  } catch {
    return String(s);
  }
}

const url = $request.url || "";
const query = parseQuery(url);
const action = query.get("action") || "save";
Log.debug(`[wloc-settings] url=${url}, action=${action}`);

let result;
if (action === "query") {
  // 查询已存坐标
  try {
    const saved = Store.get(KEY);
    if (saved && typeof saved === "object" && saved.longitude && saved.latitude) {
      result = {
        success: true,
        longitude: saved.longitude,
        latitude: saved.latitude,
        accuracy: saved.accuracy || 25,
        updatedAt: saved.updatedAt || null,
      };
      Log.debug(`[wloc-settings] 查询: ${saved.longitude}, ${saved.latitude}`);
    } else {
      result = { success: false, error: "无已保存的坐标" };
    }
  } catch (e) {
    result = { success: false, error: e.message || "读取失败" };
  }
} else if (action === "clear") {
  // 清除坐标 → wloc.js 进入透传模式 → 恢复真实定位
  try {
    Store.set(KEY, null);
    result = { success: true };
    Log.info("[wloc-settings] 已清除坐标数据");
  } catch (e) {
    result = { success: false, error: e.message || "清除失败" };
    Log.error(`[wloc-settings] 清除失败: ${e.message}`);
  }
} else {
  // 保存坐标 (cs=gcj 时先设备端转 WGS84)
  let lon = parseFloat(query.get("lon") || query.get("longitude") || "0");
  let lat = parseFloat(query.get("lat") || query.get("latitude") || "0");
  const acc = parseInt(query.get("acc") || query.get("accuracy") || "25", 10);
  if ((query.get("cs") || "").toLowerCase() === "gcj") {
    const w = gcj02ToWgs84(lat, lon);
    lon = w.lon;
    lat = w.lat;
  }
  if (lon && lat) {
    const record = {
      longitude: lon,
      latitude: lat,
      accuracy: acc,
      updatedAt: new Date(Date.now() + 288e5).toISOString().replace("Z", "+08:00"), // 北京时间
    };
    try {
      if (Store.set(KEY, record)) {
        result = { success: true, longitude: lon, latitude: lat, accuracy: acc };
        Log.info(`[wloc-settings] 已保存: ${lon}, ${lat}`);
      } else {
        result = { success: false, error: "Store.set 返回 false" };
        Log.error("[wloc-settings] set 返回 false");
      }
    } catch (e) {
      result = { success: false, error: e.message || "写入失败" };
      Log.error(`[wloc-settings] ${e.message}`);
    }
  } else {
    result = { success: false, error: "缺少 lon/lat 参数" };
  }
}

done({
  response: {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
    body: JSON.stringify(result),
  },
});
