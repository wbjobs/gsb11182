// 存储层：IndexedDB 优先，localStorage 兜底，隐私模式降级为内存。
export const LS_KEY = 'prefs.settings.v1';

const DB_NAME = 'prefs-demo';
const DB_STORE = 'kv';
const SETTINGS_KEY = 'settings';

let dbPromise = null;
const memoryStore = new Map();

function openDB() {
  if (typeof indexedDB === 'undefined' || indexedDB === null) {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  // 失败后允许重试
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function idbGet(key) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function idbSet(key, value) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

function lsWorks() {
  try {
    const probe = '__prefs_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function lsGet() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsSet(value) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const storage = {
  // 'indexeddb' | 'localstorage' | 'memory'
  mode: 'memory',

  async init() {
    try {
      await openDB();
      this.mode = 'indexeddb';
      return this.mode;
    } catch {
      // 隐私模式等场景下降级
    }
    this.mode = lsWorks() ? 'localstorage' : 'memory';
    return this.mode;
  },

  // 同步读取 localStorage 镜像，用于首屏防主题闪烁
  loadSyncPreview() {
    return lsGet();
  },

  async load() {
    if (this.mode === 'indexeddb') {
      try {
        const value = await idbGet(SETTINGS_KEY);
        if (value) return value;
      } catch {
        // IDB 读取失败时继续尝试镜像
      }
    }
    if (this.mode !== 'memory') {
      const value = lsGet();
      if (value) return value;
    }
    return memoryStore.has(SETTINGS_KEY) ? memoryStore.get(SETTINGS_KEY) : null;
  },

  async save(value) {
    memoryStore.set(SETTINGS_KEY, value);
    if (this.mode === 'indexeddb') {
      try {
        await idbSet(SETTINGS_KEY, value);
      } catch {
        // 写入失败不阻断，镜像与内存仍可用
      }
    }
    if (this.mode !== 'memory') {
      // 始终维护 localStorage 镜像：首屏防闪烁 + storage 事件兜底同步
      lsSet(value);
    }
  },
};
