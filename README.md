# Apple WLOC 定位修改 (Shadowrocket)

修改 Apple 网络定位 (Wi-Fi/基站) 返回坐标, 实现 iOS 虚拟定位。**苹果地图选点 + 快捷指令, 全程设备内完成, 无需任何服务器。**

## 安装

小火箭 → 配置 → 模块 → + → 粘贴:

```
https://raw.githubusercontent.com/bgtendtofree/wloc/refs/heads/main/modules/wloc.module
```

启用模块, 开启 MITM 并信任证书 (拦截国区 `gs-loc(-cn).apple.com` 与国际区 `gsp-ssl.ls.apple.com`)。

## 快捷指令: 设位置

新建快捷指令, ⓘ 设置里开「在共享表单中显示」, 类型勾「URL」和「文本」。动作按顺序:

| # | 动作 | 配置 |
|---|------|------|
| 1 | 文本 | 内容选变量「快捷指令输入」 |
| 2 | 匹配文本 | 正则 `coordinate=(-?\d+\.\d+),(-?\d+\.\d+)`, 在动作 1 的文本中匹配 |
| 3 | 从匹配文本中获取组 | 索引 `1`, 输入为动作 2 的「匹配」输出 |
| 4 | 设定变量 | 名 `Latitude`, 值为动作 3 输出 |
| 5 | 从匹配文本中获取组 | 索引 `2`, 输入为动作 2 的「匹配」输出 |
| 6 | 设定变量 | 名 `Longitude`, 值为动作 5 输出 |
| 7 | 获取 URL 内容 | `https://gs-loc.apple.com/wloc-settings/save?lon=[Longitude]&lat=[Latitude]&acc=25&cs=gcj`, GET |
| 8 | 显示通知 | `已切换定位 [Latitude],[Longitude]` |
| 9 | (可选) 打开 URL | `prefs:root=Privacy&path=LOCATION` — 跳到定位设置, 手动关开刷新 |

注意:

- 正则第 1 组是**纬度**, 第 2 组是**经度** (苹果 `coordinate=纬度,经度`), URL 里 `lon=` 接第 2 组
- `cs=gcj` 必须带: 中国大陆苹果地图坐标是 GCJ-02, 脚本在设备端转 WGS84, 链接不出设备
- Mac 苹果地图选点: 复制链接 → AirDrop 到 iPhone → 跑同一快捷指令

用法: 苹果地图长按选点 → 分享 → 本快捷指令 → 通知弹出即生效。

## 快捷指令: 恢复定位

新建快捷指令, 一个动作:

```
获取 URL 内容: https://gs-loc.apple.com/wloc-settings/save?action=clear
```

清除已存坐标 → 脚本自动进入透传模式 → 真实定位恢复。也可直接停用模块。

**切换后刷新 (实测有效):** 关开一次定位服务即可; 无效则杀掉 App 重开; 仍无效再重启设备。

## 工作原理

```
快捷指令 → gs-loc.apple.com/wloc-settings/save (被模块拦截)
        → wloc-settings.js 写入 $persistentStore
        → 下次 WLOC 定位 → wloc.js 拦截 /clls/wloc 响应 → patch protobuf 坐标
```

两条规则:
- `wloc.js` — 拦截 `/clls/wloc` 响应 (国区 gs-loc(-cn).apple.com + 国际区 gsp-ssl.ls.apple.com), 解析 protobuf 替换经纬度/精度
- `wloc-settings.js` — 拦截 `/wloc-settings/save`, 写持久化存储 (含设备端 GCJ-02→WGS84)

## 边界 (实测)

**WLOC 只改网络定位输入, 控制不了 Core Location 最终输出:**

- 室内 (GPS 弱): 假位置稳定, 实测不飘 ✓
- 窗边 (有 GPS 信号): 假位置短暂出现后约 1 秒被真实位置盖掉 ✗ — GPS 优先于网络定位, 软件层无解

## 诊断日志

每次 WLOC 响应输出带序号日志 (小火箭日志搜 `[wloc]`):

```
[wloc] #37 2026-08-06T08:19:08Z method=POST url=https://gs-loc-cn.apple.com/clls/wloc
[wloc] #37 PATCH ok 目标: 102.7,25.05 accuracy 123→25 locations=400 wifi=400 cell=0 skipped=0 bytes=22237
```

| 现象 | 日志表现 | 结论 |
|------|----------|------|
| 位置回跳 | 回跳时点有新 `#N PATCH ok` | WLOC 层正常, 是 GPS/CL 融合覆盖 |
| 位置回跳 | 回跳时点没有新 `#N` | 走了其它通道 (GPS/缓存), 非 WLOC 问题 |
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
node test/node-demo.mjs      # wloc.js patch + 诊断日志 (wifi/cell/gzip/透传)
node test/settings-demo.mjs  # GCJ 换算 + 透传
```

## 代码形态

`src/` 两个脚本就是**可读源码**, 源码即发布物, 无构建步骤 — 直接改直接 push, 小火箭重载即生效。
唯一非人话部分: `src/wloc.js` 中部 vendor 的 pako inflate (~21KB, MIT, 见 NOTICE), 勿手改。

## 致谢

- FFF686868 / proxypin-wloc-spoofer — WLOC protobuf patch 原始思路与逻辑 (MIT)
- Yu9191 / wloc — 移植 Surge 系与持久化坐标思路
- NSNanoCat / util — 跨平台脚本框架
