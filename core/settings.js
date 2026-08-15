// core/settings.js — /wloc-settings/save 参数处理 (平台无关)
// 输入 query 对象 + 存储读写函数 (经参数注入), 输出结果对象。

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

function processSettings(query, storeGet, storeSet) {
  const action = query.action || "save";
  let result;
  if (action === "query") {
    // 查询已存坐标
    try {
      const saved = storeGetParsed(storeGet, KEY);
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
    // 清除坐标 → wloc 进入透传模式 → 恢复真实定位
    try {
      storeSetString(storeSet, KEY, null);
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
        if (storeSetString(storeSet, KEY, record)) {
          result = { success: true, longitude: lon, latitude: lat, accuracy: acc };
          Log.info(`[wloc-settings] 已保存: ${lon}, ${lat}`);
        } else {
          result = { success: false, error: "storeSet 返回 false" };
          Log.error("[wloc-settings] storeSet 返回 false");
        }
      } catch (e) {
        result = { success: false, error: e.message || "写入失败" };
        Log.error(`[wloc-settings] ${e.message}`);
      }
    }
  }
  return result;
}
