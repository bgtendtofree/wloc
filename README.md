<p align="center">
  <img src="wloc.jpg" width="144" />
</p>

# Apple WLOC 定位修改 (Shadowrocket)

修改 Apple 网络定位 (Wi-Fi/基站) 返回坐标, 实现 iOS 虚拟定位。**苹果地图选点 + 快捷指令, 全程设备内完成, 无需任何服务器。**

## 安装

小火箭 → 配置 → 模块 → + → 粘贴:

```
https://raw.githubusercontent.com/bgtendtofree/wloc/refs/heads/main/modules/wloc.module
```

启用模块, 开启 MITM 并信任证书 (`gs-loc.apple.com`)。

## 使用

**设置定位:** 苹果地图选点 → 共享 → 快捷指令 → 生效。快捷指令自制 (30 秒):

1. 「接收共享表单输入」(类型: URL)
2. 「匹配文本」用正则 `coordinate=(-?\d+\.\d+),(-?\d+\.\d+)` 取共享的 URL → 第 1 组=纬度, 第 2 组=经度
3. 「获取 URL 内容」请求:
   `https://gs-loc.apple.com/wloc-settings/save?lon=<经度>&lat=<纬度>&cs=gcj`
   (中国大陆苹果地图坐标是 GCJ-02, `cs=gcj` 由脚本在设备端转 WGS84, 链接不出设备)
4. 返回含 `"success":true` 即完成

Mac 苹果地图选点也行: 复制链接 → AirDrop 到 iPhone → 跑同一快捷指令。

**恢复真实定位:** 请求 `https://gs-loc.apple.com/wloc-settings/save?action=clear` (可做成另一个快捷指令), 或停用模块。iOS 26+ 切换后需重启设备清 locationd 缓存。

## 工作原理

```
快捷指令 → gs-loc.apple.com/wloc-settings/save (被模块拦截)
        → wloc-settings.js 写入 $persistentStore
        → 下次 WLOC 定位 → wloc.js 拦截 /clls/wloc 响应 → patch protobuf 坐标
```

两条规则:
- `wloc.js` — 拦截 `/clls/wloc` 响应, 解析 protobuf 替换经纬度/精度
- `wloc-settings.js` — 拦截 `/wloc-settings/save`, 写持久化存储 (含设备端 GCJ-02→WGS84)

## 边界 (重要)

**WLOC 只改网络定位输入, 控制不了 Core Location 最终输出:**

- 室内深处 (GPS 弱): 稳定 ✓
- 窗边/室外/移动中: 真 GPS 信号优先, 会被盖回真实位置 ✗ — 软件无解
- 需要室外稳定: 只有物理尾插 (伪造外置 GPS 配件, NMEA 注入), 不在本项目范围
- accuracy 建议 25~50 米, 勿设 1m (网络定位装 1m 反而不真)

## 诊断日志

每次 WLOC 响应输出带序号日志 (小火箭日志搜 `[wloc]`):

```
[wloc] #37 2026-08-06T08:19:08Z method=POST url=https://gs-loc-cn.apple.com/clls/wloc
[wloc] #37 PATCH ok 目标: 102.7,25.05 accuracy 123→25 locations=400 wifi=400 cell=0 skipped=0 bytes=22237
```

| 现象 | 日志表现 | 结论 |
|------|----------|------|
| 位置回跳 | 回跳时点有新 `#N PATCH ok` | WLOC 层正常, 是 GPS/CL 融合覆盖, 软件无解 |
| 位置回跳 | 回跳时点没有新 `#N` | 走了其它通道 (QUIC/GPS/缓存), 非 WLOC 问题 |
| 任何时刻 | `#N PATCH fail` | 响应格式变化, 提 issue 附该行 |

## 接口参数 (`/wloc-settings/save`)

| 参数 | 说明 | 默认 |
|------|------|------|
| lon/lat | 目标坐标 (WGS84) | 必填 |
| acc | 精度(米) | 25 |
| cs | `gcj` = 输入为 GCJ-02, 设备端转 WGS84 再存 | 不转换 |
| action | `clear` 清除 / `query` 查询 | save |

模块参数 longitude/latitude/accuracy/logLevel 为兜底默认; 已储存坐标优先。持久化为空 + 参数为默认值时自动透传 (不修改定位)。

## 本地自检

```
node test/node-demo.mjs      # wloc.js patch + 诊断日志
node test/settings-demo.mjs  # GCJ 换算 + 透传
```

## 致谢

- [Yu9191/wloc](https://github.com/Yu9191/wloc) — 上游项目 (本仓为其深度精简 fork, 仅保留 Shadowrocket)
- [proxypin-wloc-spoofer](https://github.com/FFF686868/proxypin-wloc-spoofer) — 原始思路
- [NSNanoCat/Util](https://github.com/NSNanoCat/util) — 跨平台脚本框架
