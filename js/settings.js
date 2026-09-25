// 设置状态管理：默认值、校验、持久化、跨标签页同步、系统主题监听
import { storage, LS_KEY } from './storage.js';

export const DEFAULTS = Object.freeze({
  theme: 'system',          // 'light' | 'dark' | 'system'
  fontSize: 16,             // 根字体大小 px
  language: 'zh-CN',        // 'zh-CN' | 'en'
  sidebarCollapsed: false,
});

const THEMES = ['light', 'dark', 'system'];
const LANGUAGES = ['zh-CN', 'en'];
const FONT_MIN = 12;
const FONT_MAX = 20;

const SYNC_CHANNEL = 'prefs-sync-v1';
const tabId = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random());

function sanitize(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const state = { ...DEFAULTS };
  if (THEMES.includes(input.theme)) state.theme = input.theme;
  if (LANGUAGES.includes(input.language)) state.language = input.language;
  const size = Number(input.fontSize);
  if (Number.isFinite(size)) {
    state.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(size)));
  }
  if (typeof input.sidebarCollapsed === 'boolean') {
    state.sidebarCollapsed = input.sidebarCollapsed;
  }
  return state;
}

class SettingsStore {
  constructor() {
    this.state = { ...DEFAULTS };
    this.listeners = new Set();
    this.channel = null;
    this.media = typeof matchMedia === 'function'
      ? matchMedia('(prefers-color-scheme: dark)')
      : null;
  }

  async init() {
    await storage.init();
    // 首次访问无设置时 load() 返回 null，直接使用默认值，不报错
    const saved = await storage.load();
    if (saved) this.state = sanitize(saved);
    this.setupSync();
    this.watchSystemTheme();
    this.apply();
    this.emit('init');
    return this.state;
  }

  get() {
    return this.state;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  set(patch) {
    this.state = sanitize({ ...this.state, ...patch });
    storage.save(this.state);
    this.broadcast();
    this.emit('local');
  }

  reset() {
    this.set({ ...DEFAULTS });
  }

  effectiveTheme() {
    if (this.state.theme === 'system') {
      return this.media && this.media.matches ? 'dark' : 'light';
    }
    return this.state.theme;
  }

  apply() {
    const root = document.documentElement;
    root.dataset.theme = this.effectiveTheme();
    root.style.fontSize = this.state.fontSize + 'px';
    root.lang = this.state.language;
    if (document.body) {
      document.body.classList.toggle('sidebar-collapsed', this.state.sidebarCollapsed);
    }
  }

  emit(reason) {
    this.apply();
    this.listeners.forEach((fn) => fn(this.state, reason));
  }

  watchSystemTheme() {
    if (!this.media) return;
    const onChange = () => {
      if (this.state.theme === 'system') this.emit('system-theme');
    };
    if (this.media.addEventListener) this.media.addEventListener('change', onChange);
    else if (this.media.addListener) this.media.addListener(onChange);
  }

  setupSync() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(SYNC_CHANNEL);
      this.channel.onmessage = (event) => this.onRemote(event.data);
    }
    // storage 事件：无 BroadcastChannel 时作为同步兜底；同时处理“存储被清空”
    window.addEventListener('storage', (event) => {
      if (event.key === null || (event.key === LS_KEY && event.newValue === null)) {
        // 存储被清空 -> 恢复默认并重新持久化
        this.state = { ...DEFAULTS };
        storage.save(this.state);
        this.emit('cleared');
        return;
      }
      if (event.key === LS_KEY && !this.channel && event.newValue) {
        try {
          this.onRemote({ type: 'update', settings: JSON.parse(event.newValue) });
        } catch {
          // 忽略无法解析的消息
        }
      }
    });
  }

  broadcast() {
    if (!this.channel) return;
    try {
      this.channel.postMessage({
        type: 'update',
        source: tabId,
        settings: this.state,
        ts: Date.now(),
      });
    } catch {
      // 发送失败不影响本地状态
    }
  }

  onRemote(msg) {
    if (!msg || msg.type !== 'update' || msg.source === tabId) return;
    // 多标签页同时修改：后到的消息覆盖（last-write-wins）
    this.state = sanitize(msg.settings);
    storage.save(this.state);
    this.emit('remote');
  }
}

export const settingsStore = new SettingsStore();
