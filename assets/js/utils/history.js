/**
 * Plan-Examiner Review History
 * Persists the last 10 reviews in IndexedDB so users can compare revisions.
 *
 * Usage:
 *   PE.History.save(review)       → Promise<id>
 *   PE.History.list()             → Promise<Array>
 *   PE.History.get(id)            → Promise<Object|null>
 *   PE.History.delete(id)         → Promise<void>
 *   PE.History.clear()            → Promise<void>
 */

var PE = window.PE || {};

PE.History = (function () {
  'use strict';

  var DB_NAME    = 'plan-examiner';
  var STORE_NAME = 'reviews';
  var DB_VERSION = 1;
  var MAX_ENTRIES = 10;

  var _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror   = function (e) { reject(e.target.error); };
    });
  }

  function save(review) {
    return open().then(function (db) {
      var entry = Object.assign({}, review, { timestamp: Date.now() });
      return new Promise(function (resolve, reject) {
        var tx   = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var req  = store.add(entry);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror   = function (e) { reject(e.target.error); };
        // Trim to MAX_ENTRIES after adding
        tx.oncomplete = function () { _trim(); };
      });
    });
  }

  function list() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx    = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var index = store.index('timestamp');
        var req   = index.openCursor(null, 'prev');
        var items = [];
        req.onsuccess = function (e) {
          var cursor = e.target.result;
          if (cursor) { items.push(cursor.value); cursor.continue(); }
          else resolve(items);
        };
        req.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  function get(id) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  function del(id) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE_NAME, 'readwrite');
        var req = tx.objectStore(STORE_NAME).delete(id);
        req.onsuccess = function () { resolve(); };
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  function clear() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE_NAME, 'readwrite');
        var req = tx.objectStore(STORE_NAME).clear();
        req.onsuccess = function () { resolve(); };
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  function _trim() {
    list().then(function (items) {
      if (items.length > MAX_ENTRIES) {
        var toDelete = items.slice(MAX_ENTRIES);
        toDelete.forEach(function (item) { del(item.id); });
      }
    }).catch(function () {});
  }

  return { save: save, list: list, get: get, delete: del, clear: clear };

}());

window.PE = PE;
