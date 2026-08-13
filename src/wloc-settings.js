/* src/wloc-settings.js — Apple WLOC 定位修改 (Quantumult X)
 * 拦截 gs-loc(-cn).apple.com/wloc-settings/save 的响应, 返回合成 JSON。
 * QX 请求阶段脚本无法伪造响应, 故走 script-response-body: 请求正常出网 (Apple 返回 404),
 * 脚本从 $request.url 解析参数写入 $prefs, 再用 $done 覆盖响应为 200 + JSON。
 * 全程坐标不出设备之外的第三方; cs=gcj 时输入按 GCJ-02 处理, 设备端转 WGS84 再储存。
 * 源码即发布物, 无构建步骤。
 */

// ==================== 运行环境 ====================
const ENV = typeof process !== "undefined" && process?.versions?.node ? "Node" : "QX";

// ==================== 日志 ====================
const Log = {
  info(...args) { console.log("", ...args); },
  error(...args) { console.log("", ...args); },
};

// ==================== 持久化存储 ====================
const Store = {
  get(key, fallback = null) {
    let v = ENV === "Node" ? readBox()[key] : $prefs.valueForKey(key);
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
    return $prefs.setValueForKey(s, key);
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

function parseQuery(input) {
  const out = {};
  for (const pair of input.split("&")) {
    if (!pair) continue;
    const i = pair.indexOf("=");
    const rawKey = i < 0 ? pair : pair.slice(0, i);
    const rawValue = i < 0 ? "" : pair.slice(i + 1);
    try {
      const key = decodeURIComponent(rawKey.replace(/\+/g, " "));
      if (!(key in out)) out[key] = decodeURIComponent(rawValue.replace(/\+/g, " "));
    } catch {}
  }
  return out;
}

const url = $request.url || "";
const query = parseQuery(url.split("?")[1] || "");
const action = query.action || "save";

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
  const lonRaw = query.lon || query.longitude;
  const latRaw = query.lat || query.latitude;
  let lon = parseFloat(lonRaw);
  let lat = parseFloat(latRaw);
  const acc = parseInt(query.acc || query.accuracy || "25", 10);
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    result = { success: false, error: "lon 超出范围 (-180..180)" };
  } else if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    result = { success: false, error: "lat 超出范围 (-90..90)" };
  } else if (!Number.isFinite(acc) || acc < 0) {
    result = { success: false, error: "acc 非法 (需 ≥0)" };
  } else {
    if ((query.cs || "").toLowerCase() === "gcj") {
      const w = gcj02ToWgs84(lat, lon);
      lon = w.lon;
      lat = w.lat;
    }
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
  }
}

// QX script-response-body: status 为完整状态行, 覆盖 Apple 的 404
done({
  status: "HTTP/1.1 200 OK",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(result),
});
