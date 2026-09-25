/**
 * 设置管理器：
 * - 首次访问无设置 -> 使用默认值，不报错
 * - 主题支持 light/dark/system，system 时监听 matchMedia 即时响应系统主题变化
 * - 每次修改持久化到存储引擎，并通过 BroadcastChannel 同步到其他标签页
 * - 存储被清空后（重新加载时读不到值）自动恢复默认并重新持久化
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    theme: 'system',          // 'light' | 'dark' | 'system'
    fontSize: 'medium',       // 'small' | 'medium' | 'large'
    language: 'zh',           // 'zh' | 'en'
    sidebarCollapsed: false   // boolean
  };

  var VALIDATORS = {
    theme: function (v) { return v === 'light' || v === 'dark' || v === 'system'; },
    fontSize: function (v) { return v === 'small' || v === 'medium' || v === 'large'; },
    language: function (v) { return v === 'zh' || v === 'en'; },
    sidebarCollapsed: function (v) { return typeof v === 'boolean'; }
  };

  var FONT_SIZE_PX = { small: '14px', medium: '16px', large: '18px' };
  var CHANNEL_NAME = 'app-settings-sync';
  var LS_SYNC_KEY = 'app-settings:__sync__';

  function createSettingsManager() {
    var tabId = 'tab-' + Math.random().toString(36).slice(2) + '-' + Date.now();
    var state = Object.assign({}, DEFAULTS);
    var storage = null;       // { engine, mode, persistent }
    var channel = null;
    var listeners = [];       // 状态变化回调（UI 层订阅）
    var lastTimestamps = {};  // 每个 key 最后一次变更时间戳，用于多标签页 last-write-wins

    var darkMedia = global.matchMedia ? global.matchMedia('(prefers-color-scheme: dark)') : null;

    function notify() {
      var snapshot = getState();
      listeners.forEach(function (fn) {
        try { fn(snapshot); } catch (err) { /* 单个订阅者异常不影响其他 */ }
      });
    }

    function getState() {
      return Object.assign({}, state, {
        effectiveTheme: resolveTheme(),
        storageMode: storage ? storage.mode : 'unknown',
        persistent: storage ? storage.persistent : false
      });
    }

    function resolveTheme() {
      if (state.theme === 'system') {
        return darkMedia && darkMedia.matches ? 'dark' : 'light';
      }
      return state.theme;
    }

    function applyToDom() {
      var root = document.documentElement;
      root.setAttribute('data-theme', resolveTheme());
      root.style.fontSize = FONT_SIZE_PX[state.fontSize] || FONT_SIZE_PX.medium;
      root.setAttribute('lang', state.language === 'zh' ? 'zh-CN' : 'en');
      document.body.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
    }

    function persist(key) {
      if (!storage) return Promise.resolve();
      return storage.engine.set(key, state[key]).catch(function () { /* 写入失败不崩溃 */ });
    }

    function broadcast(key) {
      var message = {
        type: 'setting-changed',
        key: key,
        value: state[key],
        ts: Date.now(),
        source: tabId
      };
      lastTimestamps[key] = message.ts;
      if (channel) {
        try { channel.postMessage(message); } catch (err) { /* ignore */ }
      } else {
        // BroadcastChannel 不可用时的降级：借助 localStorage 的 storage 事件同步
        try {
          global.localStorage.setItem(LS_SYNC_KEY, JSON.stringify(message));
        } catch (err) { /* 隐私模式下无法同步，忽略 */ }
      }
    }

    function applyRemote(message) {
      if (!message || message.type !== 'setting-changed' || message.source === tabId) return;
      var key = message.key;
      if (!VALIDATORS[key] || !VALIDATORS[key](message.value)) return;
      // last-write-wins：过期的消息直接丢弃
      if (lastTimestamps[key] && message.ts < lastTimestamps[key]) return;
      lastTimestamps[key] = message.ts;
      state[key] = message.value;
      applyToDom();
      notify();
    }

    function set(key, value) {
      if (!VALIDATORS[key]) return;
      if (!VALIDATORS[key](value)) return;
      if (state[key] === value) return;
      state[key] = value;
      applyToDom();
      notify();
      persist(key);
      broadcast(key);
    }

    function reset() {
      Object.keys(DEFAULTS).forEach(function (key) {
        state[key] = DEFAULTS[key];
        persist(key);
        broadcast(key);
      });
      applyToDom();
      notify();
    }

    function load() {
      var keys = Object.keys(DEFAULTS);
      return Promise.all(keys.map(function (key) {
        return storage.engine.get(key).catch(function () { return undefined; });
      })).then(function (values) {
        values.forEach(function (value, i) {
          var key = keys[i];
          // 无设置 / 存储被清空 / 值非法 -> 回退默认值并重新持久化
          if (value === undefined || !VALIDATORS[key](value)) {
            state[key] = DEFAULTS[key];
            persist(key);
          } else {
            state[key] = value;
          }
        });
      });
    }

    function setupSync() {
      if ('BroadcastChannel' in global) {
        try {
          channel = new BroadcastChannel(CHANNEL_NAME);
          channel.onmessage = function (event) { applyRemote(event.data); };
          return;
        } catch (err) {
          channel = null;
        }
      }
      // 降级：storage 事件（仅在其它标签页触发）
      global.addEventListener('storage', function (event) {
        if (event.key !== LS_SYNC_KEY || !event.newValue) return;
        try {
          applyRemote(JSON.parse(event.newValue));
        } catch (err) { /* 非法消息忽略 */ }
      });
    }

    function setupSystemThemeListener() {
      if (!darkMedia) return;
      var handler = function () {
        if (state.theme === 'system') {
          applyToDom();
          notify();
        }
      };
      if (darkMedia.addEventListener) {
        darkMedia.addEventListener('change', handler);
      } else if (darkMedia.addListener) {
        darkMedia.addListener(handler); // 旧版 Safari
      }
    }

    function init() {
      return global.SettingsStorage.createStorageEngine().then(function (s) {
        storage = s;
        return load();
      }).then(function () {
        setupSync();
        setupSystemThemeListener();
        applyToDom();
        notify();
        return getState();
      }).catch(function () {
        // 极端情况下（如存储引擎整体异常）也保证页面可用
        if (!storage) {
          storage = { engine: null, mode: 'memory', persistent: false };
        }
        applyToDom();
        notify();
        return getState();
      });
    }

    return {
      init: init,
      set: set,
      reset: reset,
      getState: getState,
      subscribe: function (fn) { listeners.push(fn); },
      DEFAULTS: DEFAULTS
    };
  }

  global.SettingsManager = { create: createSettingsManager };
})(window);
