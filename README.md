# Apple WLOC 定位修改 (Quantumult X / Surge)

修改 Apple 网络定位 (Wi-Fi/基站) 返回坐标, 实现 iOS 虚拟定位。**苹果地图选点 + 快捷指令, 全程设备内完成, 无需任何服务器。**

## 安装

### Quantumult X

QX 首页风车 → 重写 → 引用 → + → 粘贴:

```
https://raw.githubusercontent.com/bgtendtofree/wloc/refs/heads/main/modules/wloc.qxrewrite
```

### Surge

模块 → 安装新模块 → 粘贴:

```
https://raw.githubusercontent.com/bgtendtofree/wloc/refs/heads/main/modules/wloc.sgmodule
```

或 Safari 打开 `surge:///install-module?url=https://raw.githubusercontent.com/bgtendtofree/wloc/refs/heads/main/modules/wloc.sgmodule`

安装后在模块列表确认「Apple WLOC 定位修改」已勾选; 跑一次快捷指令设位置, 日志搜 `PATCH ok` 即通。

### 证书 (两平台都要)

HTTPS 重写必须 MITM 解密, 证书手动装:

1. QX: 设置 → MitM → **生成证书** → **配置证书** ｜ Surge: 更多 → 证书 → **生成新的 CA 证书** → **安装证书**
2. 系统设置 → 已下载描述文件 → 输入锁屏密码安装
3. 系统设置 → 通用 → 关于本机 → **证书信任设置** → 勾选对应 CA
4. 回客户端 → 打开 MITM 开关

QX 的 `hostname` 行自动并入 MITM 主机名; Surge 模块 `[MITM] hostname = %APPEND% …` 同效。拦截域名: 国区 `gs-loc(-cn).apple.com` 与国际区 `gsp-ssl.ls.apple.com`。

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

清除已存坐标 → 脚本自动进入透传模式 → 真实定位恢复。也可直接停用重写/模块。

**切换后刷新 (实测有效):** 关开一次定位服务即可; 无效则杀掉 App 重开; 仍无效再重启设备。

## 工作原理

```
快捷指令 → gs-loc.apple.com/wloc-settings/save (被拦截)
        → wloc-settings 脚本写持久化存储 (GCJ-02→WGS84 设备端换算)
        → 下次 WLOC 定位 → wloc 脚本拦 /clls/wloc 响应 → patch protobuf 坐标
```

两平台差异仅拦截点:

- **Surge**: settings 在 `http-request` 阶段合成响应, **请求不出设备**; wloc 用 `binary-body-mode` 拿原始字节, gzip 由脚本 `$utils.ungzip` 解压
- **QX**: 请求阶段脚本无法伪造响应, settings 在响应阶段覆盖 Apple 的 404; gzip 由 QX 内核自动解压, 脚本直接拿 `$response.bodyBytes`

## 边界 (实测)

**WLOC 只改网络定位输入, 控制不了 Core Location 最终输出:**

- 室内 (GPS 弱): 假位置稳定, 实测不飘 ✓
- 窗边 (有 GPS 信号): 假位置短暂出现后约 1 秒被真实位置盖掉 ✗ — GPS 优先于网络定位, 软件层无解
- 国际区 `gsp-ssl.ls.apple.com` 覆盖已加入, 未经实测 — 非国区 Apple ID 首次使用时看日志 `PATCH ok` 确认

## 诊断日志

- QX: 风车 → 日志 → **长按日志栏目** → 二级菜单「日志文件」→ 日志级别设 Debug, 搜 `[wloc]`
- Surge: 更多 → 日志 → 开启详细日志; `debug=true` 时脚本 `console.log` 还显示在请求备注 (notes) 里

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
| lon/lat | 目标坐标 (WGS84), lon ∈ [-180,180], lat ∈ [-90,90]; 超范围返回 `success:false` | 必填 |
| acc | 精度(米), ≥0 | 25 |
| cs | `gcj` = 输入为 GCJ-02, 设备端转 WGS84 再存 | 不转换 |
| action | `clear` 清除 / `query` 查询 | save |

模块级自定义参数 (可选): QX 编辑重写行在脚本 URL 尾加 `#accuracy=30&logLevel=debug`; Surge 改 `[Script]` 行 `argument=` 即可。已储存坐标优先。

## 代码结构 (核心模块化 + 组装)

```
core/       平台无关纯逻辑 (protobuf 编解码、WLOC patch、GCJ、参数校验、日志)
platform/   每平台 ~40 行胶水 (QX: $prefs/bodyBytes/#参数 | Surge: $persistentStore/ungzip/argument)
entry/      每功能薄入口 (双平台共用, 差异全在 Platform 对象)
build.mjs   ~60 行纯拼接脚本, 无依赖无转译
dist/       构建产物 = 发布物, 已提交 (raw URL 指向这里)
```

- 加平台 (Loon/Stash): 一个 `platform/xxx.js` + manifest 两行, 核心零改动
- 手改 `dist/` 会被下次 build 覆盖; CI 有 `node build.mjs --check` 防漂移

## 本地自检

```
node build.mjs           # 重新组装 dist
node test/demo.mjs       # vm 内双平台假全局全量自检 (wifi/cell/gzip/透传/负坐标/参数/gcj)
```

## 致谢

- FFF686868 / proxypin-wloc-spoofer — WLOC protobuf patch 原始思路与逻辑 (MIT)
- Yu9191 / wloc — 移植 Surge 系与持久化坐标思路
