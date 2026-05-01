/**
 * Plan-Examiner Verbose Log (PE.Log)
 *
 * Lightweight diagnostic logger used by every stage of the document-scanner
 * pipeline. Provides:
 *   - Severity levels: error | warn | info | debug | trace
 *   - Dual sinks: console.* + an in-memory ring buffer (default 1000 entries)
 *   - A global enable toggle controlled by:
 *        URL flag   ?verbose=1    (also sets localStorage)
 *        URL flag   ?verbose=0    (also clears localStorage)
 *        localStorage key  pe.verbose  (value '1' = on)
 *   - A subscribe() API so the UI can re-render a "Verbose log" panel as
 *     entries arrive without polling.
 *
 * The logger is always installed; the `enabled` flag controls whether `info`,
 * `debug`, and `trace` entries are recorded. `error` and `warn` are always
 * recorded so that genuine problems show up even in non-verbose mode.
 *
 * Designed for the BYO-key / fully-client-side environment: nothing is sent
 * anywhere. The ring buffer lives in memory only.
 */

var PE = window.PE || {};

PE.Log = (function () {
  'use strict';

  var LEVELS = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
  var STORAGE_KEY = 'pe.verbose';
  var BUFFER_MAX  = 1000;

  // ── State ────────────────────────────────────────────────────────────
  var _buffer = [];          // ring buffer of log entries
  var _seq    = 0;
  var _subs   = [];          // subscriber callbacks
  var _enabled = false;      // verbose mode (controls debug/info/trace recording)
  var _consoleLevel = LEVELS.warn; // anything below or equal also goes to console
  var _started = (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();

  // ── Toggle resolution ────────────────────────────────────────────────
  function _resolveEnabled() {
    try {
      var url = (typeof window !== 'undefined' && window.location && window.location.search) || '';
      if (url) {
        var m = /[?&]verbose=([^&]+)/.exec(url);
        if (m) {
          var v = decodeURIComponent(m[1]).toLowerCase();
          if (v === '1' || v === 'true' || v === 'on') {
            try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
            return true;
          }
          if (v === '0' || v === 'false' || v === 'off') {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            return false;
          }
        }
      }
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function isEnabled() { return _enabled; }

  function setEnabled(on) {
    _enabled = !!on;
    _consoleLevel = _enabled ? LEVELS.debug : LEVELS.warn;
    try {
      if (_enabled) localStorage.setItem(STORAGE_KEY, '1');
      else          localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    _emit({
      seq: ++_seq,
      ts: Date.now(),
      elapsedMs: _elapsed(),
      level: 'info',
      stage: 'log',
      msg: _enabled ? 'Verbose logging enabled.' : 'Verbose logging disabled.',
      data: null
    });
  }

  // ── Core record ──────────────────────────────────────────────────────
  function _elapsed() {
    var now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
    return Math.round(now - _started);
  }

  function _record(level, stage, msg, data) {
    var lvlNum = LEVELS[level];
    if (lvlNum === undefined) lvlNum = LEVELS.info;
    // Always keep error/warn; drop info/debug/trace when disabled.
    if (!_enabled && lvlNum > LEVELS.warn) return;

    var entry = {
      seq:       ++_seq,
      ts:        Date.now(),
      elapsedMs: _elapsed(),
      level:     level,
      stage:     stage || 'app',
      msg:       String(msg == null ? '' : msg),
      data:      data === undefined ? null : _safeClone(data)
    };

    if (_buffer.length >= BUFFER_MAX) _buffer.shift();
    _buffer.push(entry);

    // Mirror to browser console at appropriate level.
    if (lvlNum <= _consoleLevel) {
      var fn =
        level === 'error' ? (console.error || console.log) :
        level === 'warn'  ? (console.warn  || console.log) :
        level === 'debug' ? (console.debug || console.log) :
        level === 'trace' ? (console.debug || console.log) :
                            (console.info  || console.log);
      try {
        if (entry.data !== null) fn.call(console, '[PE:' + entry.stage + '] ' + entry.msg, entry.data);
        else                     fn.call(console, '[PE:' + entry.stage + '] ' + entry.msg);
      } catch (e) { /* console may be locked-down in some embeds */ }
    }

    _emit(entry);
  }

  function _emit(entry) {
    for (var i = 0; i < _subs.length; i++) {
      try { _subs[i](entry); } catch (e) { /* subscriber must not break logger */ }
    }
  }

  // Defensive deep-ish clone for the buffer so later mutation doesn't
  // change recorded payloads. Keeps it cheap: no functions, no DOM nodes.
  function _safeClone(v) {
    if (v === null || v === undefined) return v;
    var t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') return v;
    if (t === 'function') return '[function]';
    if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
    try {
      return JSON.parse(JSON.stringify(v, function (k, val) {
        if (val instanceof ArrayBuffer) return '[ArrayBuffer ' + val.byteLength + ' bytes]';
        if (typeof Blob !== 'undefined' && val instanceof Blob)   return '[Blob ' + val.size + ' bytes ' + val.type + ']';
        if (typeof File !== 'undefined' && val instanceof File)   return '[File ' + val.name + ' ' + val.size + ' bytes]';
        if (typeof Node !== 'undefined' && val instanceof Node)   return '[DOM Node]';
        if (typeof val === 'function') return '[function]';
        return val;
      }));
    } catch (e) {
      return String(v);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────
  function error(stage, msg, data) { _record('error', stage, msg, data); }
  function warn (stage, msg, data) { _record('warn',  stage, msg, data); }
  function info (stage, msg, data) { _record('info',  stage, msg, data); }
  function debug(stage, msg, data) { _record('debug', stage, msg, data); }
  function trace(stage, msg, data) { _record('trace', stage, msg, data); }

  function group(stage) {
    var t0 = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
    return {
      log:  function (msg, data) { _record('debug', stage, msg, data); },
      info: function (msg, data) { _record('info',  stage, msg, data); },
      warn: function (msg, data) { _record('warn',  stage, msg, data); },
      error:function (msg, data) { _record('error', stage, msg, data); },
      end:  function (msg, data) {
        var t1 = (typeof performance !== 'undefined' && performance.now)
          ? performance.now() : Date.now();
        var d = Object.assign({ durationMs: Math.round(t1 - t0) }, data || {});
        _record('info', stage, msg || (stage + ' complete'), d);
        return d.durationMs;
      }
    };
  }

  function entries() { return _buffer.slice(); }

  function clear() {
    _buffer.length = 0;
    _seq = 0;
    _emit({ seq: 0, ts: Date.now(), elapsedMs: _elapsed(), level: 'info', stage: 'log', msg: 'Log cleared.', data: null });
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    _subs.push(fn);
    return function () {
      var i = _subs.indexOf(fn);
      if (i !== -1) _subs.splice(i, 1);
    };
  }

  /**
   * Format the buffer as a plain-text .log file (one entry per line).
   */
  function formatText() {
    return _buffer.map(function (e) {
      var iso  = new Date(e.ts).toISOString();
      var head = iso + ' +' + e.elapsedMs + 'ms ' + e.level.toUpperCase().padEnd(5) + ' [' + e.stage + '] ' + e.msg;
      if (e.data === null || e.data === undefined) return head;
      var payload;
      try { payload = JSON.stringify(e.data); } catch (x) { payload = String(e.data); }
      return head + '  ' + payload;
    }).join('\n');
  }

  // ── Init ─────────────────────────────────────────────────────────────
  _enabled = _resolveEnabled();
  _consoleLevel = _enabled ? LEVELS.debug : LEVELS.warn;
  // Always record the boot entry so downloaded logs include a header.
  _buffer.push({
    seq:       ++_seq,
    ts:        Date.now(),
    elapsedMs: 0,
    level:     'info',
    stage:     'log',
    msg:       'PE.Log initialized (verbose=' + _enabled + ').',
    data:      { userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) || 'n/a' }
  });

  return {
    LEVELS:     LEVELS,
    isEnabled:  isEnabled,
    setEnabled: setEnabled,
    error:      error,
    warn:       warn,
    info:       info,
    debug:      debug,
    trace:      trace,
    group:      group,
    entries:    entries,
    clear:      clear,
    subscribe:  subscribe,
    formatText: formatText
  };
}());

window.PE = PE;
