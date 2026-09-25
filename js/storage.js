/**
 * 持久化存储引擎，降级链：IndexedDB -> localStorage -> 内存
 * 统一暴露异步 get/set/clear 接口，并告知当前是否为持久化模式。
 */
(function (global) {
  'use strict';

  var DB_NAME = 'app-settings-db';
  var DB_VERSION = 1;
  var STORE_NAME = 'settings';
  var LS_PREFIX = 'app-settings:';

  function createMemoryEngine() {
    var map = {};
    return {
      mode: 'memory',
      persistent: false,
      get: function (key) {
        return Promise.resolve(Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined);
      },
      set: function (key, value) {
        map[key] = value;
        return Promise.resolve();
      },
      clear: function () {
        map = {};
        return Promise.resolve();
      }
    };
  }

  function createLocalStorageEngine() {
    // 探测 localStorage 是否真的可写（隐私模式下可能抛异常）
    var testKey = LS_PREFIX + '__probe__';
    try {
      global.localStorage.setItem(testKey, '1');
      global.localStorage.removeItem(testKey);
    } catch (err) {
      return null;
    }
    return {
      mode: 'localStorage',
      persistent: true,
      get: function (key) {
        return new Promise(function (resolve) {
          try {
            var raw = global.localStorage.getItem(LS_PREFIX + key);
            resolve(raw === null ? undefined : JSON.parse(raw));
          } catch (err) {
            resolve(undefined);
          }
        });
      },
      set: function (key, value) {
        return new Promise(function (resolve) {
          try {
            global.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
          } catch (err) { /* 配额或隐私模式写入失败，静默忽略 */ }
          resolve();
        });
      },
      clear: function () {
        return new Promise(function (resolve) {
          try {
            var toRemove = [];
            for (var i = 0; i < global.localStorage.length; i++) {
              var k = global.localStorage.key(i);
              if (k && k.indexOf(LS_PREFIX) === 0) toRemove.push(k);
            }
            toRemove.forEach(function (k) { global.localStorage.removeItem(k); });
          } catch (err) { /* ignore */ }
          resolve();
        });
      }
    };
  }

  function createIndexedDBEngine() {
    if (!('indexedDB' in global) || !global.indexedDB) return null;

    var dbPromise = new Promise(function (resolve, reject) {
      var request;
      try {
        request = global.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        reject(err);
        return;
      }
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = function (event) {
        resolve(event.target.result);
      };
      request.onerror = function () {
        reject(request.error || new Error('IndexedDB open failed'));
      };
      request.onblocked = function () {
        reject(new Error('IndexedDB open blocked'));
      };
    });

    function withStore(mode, fn) {
      return dbPromise.then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE_NAME, mode);
          var store = tx.objectStore(STORE_NAME);
          var request = fn(store);
          tx.oncomplete = function () { resolve(request ? request.result : undefined); };
          tx.onerror = function () { reject(tx.error || new Error('IndexedDB transaction failed')); };
          tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };
        });
      });
    }

    return {
      mode: 'indexedDB',
      persistent: true,
      ready: dbPromise,
      get: function (key) {
        return withStore('readonly', function (store) { return store.get(key); });
      },
      set: function (key, value) {
        return withStore('readwrite', function (store) { store.put(value, key); return null; });
      },
      clear: function () {
        return withStore('readwrite', function (store) { store.clear(); return null; });
      }
    };
  }

  /**
   * 按降级链创建存储引擎，始终 resolve，绝不 reject。
   * 返回 { engine, mode, persistent }
   */
  function createStorageEngine() {
    var idb = createIndexedDBEngine();
    if (idb) {
      return idb.ready.then(function () {
        return { engine: idb, mode: idb.mode, persistent: true };
      }).catch(function () {
        return fallback();
      });
    }
    return Promise.resolve(fallback());

    function fallback() {
      var ls = createLocalStorageEngine();
      if (ls) return { engine: ls, mode: ls.mode, persistent: true };
      var mem = createMemoryEngine();
      return { engine: mem, mode: mem.mode, persistent: false };
    }
  }

  global.SettingsStorage = { createStorageEngine: createStorageEngine };
})(window);
