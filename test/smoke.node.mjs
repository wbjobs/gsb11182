// Node 环境逻辑冒烟测试：用 mock 的 IndexedDB / localStorage / matchMedia / DOM
// 运行: node test/smoke.node.mjs [idb|ls|memory]
const scenario = process.argv[2] || 'idb';

const results = [];
const check = (name, cond) => {
  results.push((cond ? 'PASS' : 'FAIL') + ' ' + name);
  if (!cond) process.exitCode = 1;
};

// ---- IndexedDB 内存版 mock ----
function makeFakeIDB() {
  const stores = new Map();
  return {
    open() {
      const req = {};
      const db = {
        createObjectStore: (s) => { if (!stores.has(s)) stores.set(s, new Map()); },
        transaction: (store) => {
          const m = stores.get(store);
          const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
          tx.objectStore = () => ({
            get: (k) => {
              const r = {};
              queueMicrotask(() => { r.result = m.get(k); r.onsuccess && r.onsuccess(); });
              return r;
            },
            put: (v, k) => {
              m.set(k, v);
              queueMicrotask(() => { tx.oncomplete && tx.oncomplete(); });
            },
          });
          return tx;
        },
        close() {},
      };
      queueMicrotask(() => {
        req.result = db;
        if (!stores.has('kv') && req.onupgradeneeded) req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      });
      return req;
    },
    _stores: stores,
  };
}

// ---- localStorage mock ----
const lsData = new Map();
function makeLS(broken) {
  return {
    getItem: (k) => (lsData.has(k) ? lsData.get(k) : null),
    setItem: (k, v) => { if (broken) throw new Error('denied'); lsData.set(k, String(v)); },
    removeItem: (k) => lsData.delete(k),
    clear: () => lsData.clear(),
  };
}

// ---- DOM / 浏览器 API mock ----
const documentElement = { dataset: {}, style: {}, lang: '' };
const bodyClasses = new Set();
const windowListeners = {};
let mediaMatches = false;
let mediaChangeFn = null;

globalThis.document = {
  documentElement,
  body: { classList: { toggle: (c, on) => (on ? bodyClasses.add(c) : bodyClasses.delete(c)) } },
};
globalThis.window = {
  addEventListener: (type, fn) => { (windowListeners[type] ??= []).push(fn); },
};
globalThis.matchMedia = () => ({
  get matches() { return mediaMatches; },
  addEventListener: (type, fn) => { if (type === 'change') mediaChangeFn = fn; },
});
if (scenario !== 'idb') {
  // idb 不可用场景
} else {
  globalThis.indexedDB = makeFakeIDB();
}
globalThis.localStorage = makeLS(scenario === 'memory');

const { settingsStore, DEFAULTS } = await import('../js/settings.js');
const { storage, LS_KEY } = await import('../js/storage.js');

await settingsStore.init();

// 1. 首次访问无设置 -> 默认值，不报错
check('first-visit-defaults', JSON.stringify(settingsStore.get()) === JSON.stringify({ ...DEFAULTS }));

// 2. 存储模式探测
const expectedMode = { idb: 'indexeddb', ls: 'localstorage', memory: 'memory' }[scenario];
check('storage-mode-' + expectedMode, storage.mode === expectedMode);

// 3. 修改设置并应用
settingsStore.set({ theme: 'dark', fontSize: 18, language: 'en', sidebarCollapsed: true });
check('apply-theme', documentElement.dataset.theme === 'dark');
check('apply-font', documentElement.style.fontSize === '18px');
check('apply-lang', documentElement.lang === 'en');
check('apply-sidebar', bodyClasses.has('sidebar-collapsed'));

// 4. 持久化：重新 load 能读回
const reloaded = await storage.load();
check('persist-reload', reloaded && reloaded.theme === 'dark' && reloaded.fontSize === 18
  && reloaded.language === 'en' && reloaded.sidebarCollapsed === true);

// 5. 跨标签页同步：模拟另一个标签页广播
const otherTab = new BroadcastChannel('prefs-sync-v1');
otherTab.postMessage({ type: 'update', source: 'other-tab', settings: { theme: 'light', fontSize: 13, language: 'zh-CN', sidebarCollapsed: false } });
await new Promise((r) => setTimeout(r, 50));
check('cross-tab-receive', settingsStore.get().theme === 'light' && settingsStore.get().fontSize === 13);
check('cross-tab-applied', documentElement.dataset.theme === 'light');

// 6. 本标签页修改会广播
const bc = new BroadcastChannel('prefs-sync-v1');
const got = new Promise((r) => { bc.onmessage = (e) => r(e.data); });
settingsStore.set({ fontSize: 20 });
const msg = await got;
check('cross-tab-broadcast', msg && msg.settings && msg.settings.fontSize === 20);

// 7. 跟随系统：系统主题变化即时生效
settingsStore.set({ theme: 'system' });
mediaMatches = true;
mediaChangeFn && mediaChangeFn();
check('system-theme-dark', documentElement.dataset.theme === 'dark');
mediaMatches = false;
mediaChangeFn && mediaChangeFn();
check('system-theme-light', documentElement.dataset.theme === 'light');

// 8. 存储被清空 -> 恢复默认
(windowListeners['storage'] || []).forEach((fn) => fn({ key: null }));
check('cleared-restores-defaults', JSON.stringify(settingsStore.get()) === JSON.stringify({ ...DEFAULTS }));

// 9. 非法数据被清洗
settingsStore.set({ theme: 'neon', fontSize: 999, language: 'fr' });
check('sanitize', settingsStore.get().theme === 'system' && settingsStore.get().fontSize === 20
  && settingsStore.get().language === 'zh-CN');

otherTab.close(); bc.close();
console.log(`[scenario=${scenario}]`);
console.log(results.join('\n'));
