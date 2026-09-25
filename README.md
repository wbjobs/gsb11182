# 偏好设置模块

纯前端实现的用户偏好设置（无构建步骤、无依赖），只做设置项与持久化，不含业务功能。

## 设置项

| 设置 | 取值 | 默认 |
| --- | --- | --- |
| 主题 | `light` / `dark` / `system`（跟随系统） | `system` |
| 字体大小 | `small` / `medium` / `large` | `medium` |
| 语言 | `zh` / `en` | `zh` |
| 侧边栏折叠 | `true` / `false` | `false` |

## 技术方案

- **IndexedDB**：主持久化存储（`js/storage.js`）
- **降级链**：IndexedDB → localStorage → 内存（隐私模式自动降级到内存，页面不崩，并显示提示条）
- **BroadcastChannel**：多标签页即时同步；不可用时降级为 localStorage `storage` 事件
- **matchMedia**：主题为 `system` 时监听 `prefers-color-scheme` 变化，系统切换主题即时生效
- 多标签页同时修改采用 **last-write-wins**（消息带时间戳，过期消息丢弃，来源 ID 防止回声）

## 运行

任意静态服务器即可，例如：

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 验收对照

- 刷新后设置保持 → 刷新页面，设置不变
- 关闭浏览器再打开保持 → 设置存于 IndexedDB，重启浏览器仍在
- 多标签页同步 → 开两个标签页，改一边另一边立即更新
- 跟随系统 → 主题选“跟随系统”，切换系统深/浅色，页面即时变化
- 存储被清空 → DevTools 清除 IndexedDB/localStorage 后刷新，恢复默认并重新写入
- 隐私模式 → 无痕窗口打开，显示降级提示，功能正常不报错
- 首次访问 → 直接打开即显示默认设置，控制台无报错
