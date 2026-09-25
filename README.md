# 偏好设置（持久化 + 跨标签页同步）

纯前端实现，无构建依赖。设置项：主题（亮/暗/跟随系统）、字体大小、语言、侧边栏折叠。

## 运行

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
```

（ES Module 需要 http 协议，直接双击 index.html 无法运行。）

## 技术方案

- **IndexedDB**：主持久化存储（`js/storage.js`）
- **localStorage 镜像**：首屏防主题闪烁（`index.html` 内联脚本同步读取）+ 无 BroadcastChannel 时通过 `storage` 事件兜底同步 + IDB 不可用时的持久化兜底
- **BroadcastChannel**：跨标签页即时同步（`js/settings.js`），多标签页同时修改采用 last-write-wins
- **matchMedia**：`prefers-color-scheme` 监听，主题为“跟随系统”时系统切换即时生效
- **内存降级**：隐私模式下 IDB/localStorage 均不可用时降级为内存存储，页面不崩，UI 显示当前存储模式

## 验收对照

| 验收标准 | 实现 |
| --- | --- |
| 刷新后设置保持 | IndexedDB / localStorage 持久化 |
| 关闭浏览器再打开保持 | 同上 |
| 多标签页修改立即同步 | BroadcastChannel（storage 事件兜底） |
| 跟随系统时系统主题变化即时生效 | `matchMedia('(prefers-color-scheme: dark)')` change 监听 |
| 存储被清空后恢复默认 | `storage` 事件 `key === null` 时重置为默认值 |
| 隐私模式降级到内存且不崩 | 存储层三级降级 IDB → localStorage → memory，全程 try/catch |
| 首次访问无设置不报错 | `load()` 返回 `null` 时使用内置默认值 |

## 手动验证

1. 修改任意设置 → 刷新页面，设置保持。
2. 关闭浏览器重开，设置保持。
3. 开两个标签页，在 A 修改，B 立即更新。
4. 主题选“跟随系统”，切换系统深浅色，页面即时跟随。
5. DevTools → Application → Clear site data（页面打开时），设置恢复默认。
6. 隐私/无痕窗口打开，页面正常，存储模式显示“内存”。
7. 全新浏览器首次打开，默认：跟随系统 / 16px / 中文 / 侧边栏展开，控制台无报错。
