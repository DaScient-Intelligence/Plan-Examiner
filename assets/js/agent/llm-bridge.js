/**
 * Plan-Examiner LLM Bridge
 * BYO-key integration for OpenAI, Anthropic, Azure OpenAI, and Ollama.
 *
 * Privacy & security posture:
 *  - API keys are stored only in browser storage (localStorage by default,
 *    or sessionStorage if the user picks "Session only"). Never sent to any
 *    Plan-Examiner server.
 *  - Every outbound request goes through `_fetch()` so we have a single
 *    chokepoint for `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`,
 *    timeouts, retries, and error normalization.
 *  - Each provider receives ONLY the auth header it requires. Authorization
 *    is never sent to Anthropic / Azure / Ollama; x-api-key is never sent
 *    to OpenAI; api-key is Azure-only.
 *  - Vision (multimodal) is opt-in; image bytes are never logged — only
 *    counts, dimensions, mime types, and sha256 of each rasterized page.
 *
 * Config shape (stored as JSON under storage key 'pe_llm_config'):
 * {
 *   v:        1,                                 // schema version
 *   provider: 'openai' | 'anthropic' | 'azure' | 'ollama',
 *   model:    string,
 *   apiKey:   string,
 *   baseUrl:  string,                            // required for azure / ollama
 *   useVision:    boolean,                       // user toggle
 *   maxVisionPages: number,                      // 1..50
 *   sessionOnly:  boolean,                       // store in sessionStorage instead
 *   ollamaAllowRemote: boolean                   // allow non-loopback Ollama
 * }
 */

var PE = window.PE || {};

PE.LLM = (function () {
  'use strict';

  var STORAGE_KEY     = 'pe_llm_config';
  var CONSENT_KEY     = 'pe.visionConsent';
  var SCHEMA_VERSION  = 1;

  // Per-request timeout (ms). Generous because vision uploads can be slow.
  var DEFAULT_TIMEOUT_MS         = 60000;
  var DEFAULT_VISION_TIMEOUT_MS  = 120000;
  // Bounded retry on transient failures.
  var MAX_RETRIES                = 2;

  // Per-page raster budgets used by extractors. Centralized here so the
  // UI and the rasterizer agree on caps.
  var DEFAULT_MAX_VISION_PAGES   = 6;
  var HARD_MAX_VISION_PAGES      = 50;
  var TOTAL_VISION_BYTE_BUDGET   = 18 * 1024 * 1024; // ~18 MB across a run

  var DEFAULTS = {
    openai:    { model: 'gpt-4o-mini',                baseUrl: 'https://api.openai.com/v1' },
    anthropic: { model: 'claude-3-5-sonnet-20241022', baseUrl: 'https://api.anthropic.com' },
    azure:     { model: 'gpt-4o',                     baseUrl: '' },
    ollama:    { model: 'llama3',                     baseUrl: 'http://localhost:11434' }
  };

  // Vision-capable model patterns per provider. Keep small and explicit.
  // Any model NOT matching → text-only (we surface a warning in the UI).
  var VISION_MODELS = {
    openai:    [/^gpt-4o(?:-.*)?$/i, /^gpt-4\.1(?:-.*)?$/i, /^gpt-4-turbo$/i, /^gpt-4-vision/i, /vision/i, /^o1(?:-.*)?$/i, /^o3(?:-.*)?$/i, /^o4(?:-.*)?$/i, /^chatgpt-4o/i],
    anthropic: [/^claude-3/i, /^claude-3-5/i, /^claude-3-7/i, /^claude-sonnet/i, /^claude-opus/i, /^claude-haiku/i],
    azure:     [/gpt-4o/i, /gpt-4\.1/i, /gpt-4-turbo/i, /vision/i],
    ollama:    [/llava/i, /vision/i, /^llama3\.2-vision/i, /bakllava/i, /^moondream/i, /^minicpm/i]
  };

  // ── Storage (localStorage by default, sessionStorage if sessionOnly) ──

  function _store(sessionOnly) {
    try {
      return sessionOnly && typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : localStorage;
    } catch (e) { return null; }
  }

  function getConfig() {
    // Read from whichever store currently has a value (session takes
    // precedence so a session key shadows a stale localStorage key).
    var raw = null;
    try { raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null); } catch (e) {}
    if (!raw) {
      try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }
    if (!raw) return null;
    try {
      var cfg = JSON.parse(raw);
      if (!cfg || typeof cfg !== 'object') return null;
      if (!cfg.v) cfg.v = 1; // back-compat for pre-versioned configs
      return cfg;
    } catch (e) { return null; }
  }

  function setConfig(cfg) {
    // Intentional client-side storage: BYO-key requires the user's API key
    // to be available for outbound calls to their chosen provider. Keys
    // are never sent to Plan-Examiner servers — see SECURITY.md.
    cfg = Object.assign({}, cfg, { v: SCHEMA_VERSION });
    var s = _store(!!cfg.sessionOnly);
    if (!s) return;
    // If user toggled session-only, scrub any stale localStorage copy.
    try {
      if (cfg.sessionOnly && typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
      else if (!cfg.sessionOnly && typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    // eslint-disable-next-line no-restricted-globals
    s.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function clearConfig() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function isConfigured() {
    var cfg = getConfig();
    return !!(cfg && cfg.provider && (cfg.apiKey || cfg.provider === 'ollama'));
  }

  // ── Capability detection ─────────────────────────────────────────────

  /**
   * Returns one of: 'vision' | 'text' | 'unknown'.
   * 'unknown' = configured but model name doesn't match the table; the UI
   * can still let the user attempt vision at their own risk.
   */
  function visionCapability(cfg) {
    cfg = cfg || getConfig();
    if (!cfg || !cfg.provider) return 'text';
    var model = String(cfg.model || (DEFAULTS[cfg.provider] && DEFAULTS[cfg.provider].model) || '');
    var pats = VISION_MODELS[cfg.provider] || [];
    for (var i = 0; i < pats.length; i++) {
      if (pats[i].test(model)) return 'vision';
    }
    // Custom Azure deployments can be named anything → unknown.
    if (cfg.provider === 'azure') return 'unknown';
    return 'text';
  }

  function isVisionCapable(cfg) {
    return visionCapability(cfg) === 'vision';
  }

  // ── Consent (vision sends page images to the provider) ───────────────

  function hasVisionConsent() {
    try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch (e) { return false; }
  }

  function setVisionConsent(on) {
    try {
      if (on) localStorage.setItem(CONSENT_KEY, '1');
      else    localStorage.removeItem(CONSENT_KEY);
    } catch (e) {}
  }

  // ── Base URL validation ──────────────────────────────────────────────

  /**
   * Validate a user-supplied base URL for the chosen provider.
   * Returns { ok: true, url: <normalized> } or { ok: false, reason: <msg> }.
   *
   * - Cloud providers (openai/anthropic/azure) MUST be https.
   * - Ollama allows http for loopback (localhost / 127.0.0.1 / ::1) and
   *   nothing else unless the user opts into `ollamaAllowRemote`.
   * - Disallow query strings or fragments — the per-call code appends
   *   paths and query params and we don't want them merged.
   * - Disallow paths containing '..' (path traversal protection).
   */
  function validateBaseUrl(provider, urlStr, opts) {
    opts = opts || {};
    if (!urlStr) {
      var def = (DEFAULTS[provider] || {}).baseUrl || '';
      if (!def) return { ok: false, reason: 'Base URL required for ' + provider + '.' };
      return validateBaseUrl(provider, def, opts);
    }
    var u;
    try { u = new URL(urlStr); }
    catch (e) { return { ok: false, reason: 'Not a valid URL.' }; }

    if (u.search || u.hash) return { ok: false, reason: 'Base URL must not contain query string or fragment.' };
    if (/(?:^|\/)\.\.(?:\/|$)/.test(urlStr)) return { ok: false, reason: 'Base URL must not contain "..".' };

    var host = u.hostname.toLowerCase();
    var isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';

    if (provider === 'ollama') {
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, reason: 'Ollama URL must be http(s).' };
      if (!isLoopback && !opts.ollamaAllowRemote) {
        return { ok: false, reason: 'Ollama is intended to run locally. Use http://localhost:11434, or enable "Allow remote Ollama" if you really mean a remote host.' };
      }
    } else {
      // OpenAI / Anthropic / Azure — require HTTPS.
      if (u.protocol !== 'https:') return { ok: false, reason: 'Cloud providers require https://.' };
    }

    // Strip trailing slash for consistent path concatenation.
    var normalized = u.origin + u.pathname.replace(/\/+$/, '');
    return { ok: true, url: normalized };
  }

  // ── Key sanity-check (warning, not enforcement) ──────────────────────

  function keyShapeWarning(provider, key) {
    if (!key) return null;
    if (provider === 'openai'    && !/^sk-/.test(key)) return 'OpenAI keys usually start with "sk-".';
    if (provider === 'anthropic' && !/^sk-ant-/.test(key)) return 'Anthropic keys usually start with "sk-ant-".';
    return null;
  }

  // ── Logging shim ─────────────────────────────────────────────────────

  function _L() { return (window.PE && window.PE.Log) ? window.PE.Log : null; }

  // ── Centralized fetch with timeout, retry, no-referrer, no-store ────

  function _sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function _normalizeError(provider, status, bodyText, networkErr) {
    var retryable = false;
    var code;
    if (networkErr) { code = 'network'; retryable = true; }
    else if (status === 401 || status === 403) { code = 'auth'; retryable = false; }
    else if (status === 429) { code = 'rate_limited'; retryable = true; }
    else if (status >= 500)  { code = 'server'; retryable = true; }
    else if (status >= 400)  { code = 'client'; retryable = false; }
    else                     { code = 'unknown'; retryable = false; }

    var snippet = '';
    if (bodyText) {
      try {
        var parsed = JSON.parse(bodyText);
        snippet = (parsed && parsed.error && (parsed.error.message || parsed.error)) ||
                  (parsed && parsed.message) || bodyText;
      } catch (e) { snippet = bodyText; }
      snippet = String(snippet).slice(0, 240);
    }
    var msg = code === 'auth'         ? 'Invalid or unauthorized API key — open AI Settings.' :
              code === 'rate_limited' ? 'Rate limited by ' + provider + '. Try again shortly.' :
              code === 'server'       ? provider + ' returned a server error (' + status + ').' :
              code === 'network'      ? 'Network error reaching ' + provider + (networkErr && networkErr.message ? ': ' + networkErr.message : '') :
              code === 'client'       ? provider + ' rejected the request (' + status + ')' + (snippet ? ': ' + snippet : '') :
                                        provider + ' returned status ' + status;
    var err = new Error(msg);
    err.status = status || 0;
    err.code = code;
    err.retryable = retryable;
    err.bodySnippet = snippet;
    return err;
  }

  /**
   * One outbound request. Honors the caller's AbortController by chaining
   * it together with our internal timeout signal.
   */
  async function _fetchOnce(url, opts, timeoutMs, externalSignal) {
    var ctl = new AbortController();
    var t  = setTimeout(function () { ctl.abort(); }, timeoutMs);
    var onAbort = function () { ctl.abort(); };
    if (externalSignal) {
      if (externalSignal.aborted) ctl.abort();
      else externalSignal.addEventListener('abort', onAbort);
    }
    try {
      return await fetch(url, Object.assign({}, opts, {
        signal:         ctl.signal,
        referrerPolicy: 'no-referrer',
        cache:          'no-store',
        credentials:    'omit',
        mode:           'cors'
      }));
    } finally {
      clearTimeout(t);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
    }
  }

  /**
   * Fetch with bounded retry+jitter on transient errors.
   */
  async function _fetch(provider, url, opts, externalSignal, timeoutMs) {
    timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;
    var lastErr;
    for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        var resp = await _fetchOnce(url, opts, timeoutMs, externalSignal);
        if (resp.ok) return resp;
        var bodyText = '';
        try { bodyText = await resp.text(); } catch (e) {}
        var err = _normalizeError(provider, resp.status, bodyText, null);
        if (!err.retryable || attempt === MAX_RETRIES) throw err;
        lastErr = err;
      } catch (e) {
        if (e && e.name === 'AbortError') {
          if (externalSignal && externalSignal.aborted) throw e; // user cancel
          // our timeout
          lastErr = _normalizeError(provider, 0, '', new Error('timeout after ' + timeoutMs + 'ms'));
          if (attempt === MAX_RETRIES) throw lastErr;
        } else if (e && typeof e.code === 'string') {
          if (!e.retryable || attempt === MAX_RETRIES) throw e;
          lastErr = e;
        } else {
          lastErr = _normalizeError(provider, 0, '', e);
          if (attempt === MAX_RETRIES) throw lastErr;
        }
      }
      // Jittered backoff: 400ms, 1200ms (+ up to 250ms jitter)
      var backoff = (attempt === 0 ? 400 : 1200) + Math.floor(Math.random() * 250);
      var L = _L(); if (L) L.warn('llm', 'retrying ' + provider + ' after ' + backoff + 'ms (attempt ' + (attempt + 2) + '/' + (MAX_RETRIES + 1) + ')', { code: lastErr && lastErr.code, status: lastErr && lastErr.status });
      await _sleep(backoff);
    }
    throw lastErr || new Error('Unknown LLM error');
  }

  // ── Provider adapters (text + vision share the same path) ───────────

  function _normalizeMessages(messages) {
    // Accept either plain string content or already-multimodal arrays.
    return messages.map(function (m) {
      return { role: m.role, content: m.content };
    });
  }

  function _hasImages(messages) {
    for (var i = 0; i < messages.length; i++) {
      var c = messages[i].content;
      if (Array.isArray(c)) {
        for (var j = 0; j < c.length; j++) {
          if (c[j] && (c[j].type === 'image_url' || c[j].type === 'image')) return true;
        }
      }
    }
    return false;
  }

  // Convert our provider-neutral multimodal content into provider shapes.
  // Provider-neutral image entry: { type:'image', dataUrl:'data:image/jpeg;base64,...' }
  // OR the OpenAI-style { type:'image_url', image_url:{ url } }.

  function _toOpenAIContent(c) {
    if (typeof c === 'string') return c;
    return c.map(function (part) {
      if (part.type === 'image' && part.dataUrl) return { type: 'image_url', image_url: { url: part.dataUrl } };
      if (part.type === 'image_url') return part;
      if (part.type === 'text') return part;
      return { type: 'text', text: String(part.text || '') };
    });
  }

  function _toAnthropicContent(c) {
    if (typeof c === 'string') return [{ type: 'text', text: c }];
    return c.map(function (part) {
      if (part.type === 'text') return { type: 'text', text: part.text };
      var dataUrl = part.dataUrl || (part.image_url && part.image_url.url);
      if (dataUrl && /^data:[^;]+;base64,/.test(dataUrl)) {
        var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
        return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
      }
      return { type: 'text', text: '[unsupported image]' };
    });
  }

  function _ollamaImagesFromMessages(messages) {
    // Ollama wants `images: [base64, ...]` separate from content text.
    var imgs = [];
    var flat = messages.map(function (m) {
      if (typeof m.content === 'string') return m;
      var text = '';
      m.content.forEach(function (p) {
        if (p.type === 'text') text += (text ? '\n' : '') + p.text;
        var dataUrl = p.dataUrl || (p.image_url && p.image_url.url);
        var mm = dataUrl && /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
        if (mm) imgs.push(mm[1]);
      });
      return { role: m.role, content: text, images: imgs.length ? imgs : undefined };
    });
    return flat;
  }

  async function callOpenAI(cfg, messages, signal, opts) {
    var url = cfg.baseUrl + '/chat/completions';
    var body = {
      model: cfg.model || DEFAULTS.openai.model,
      messages: messages.map(function (m) { return { role: m.role, content: _toOpenAIContent(m.content) }; }),
      temperature: opts && opts.temperature != null ? opts.temperature : 0.3,
      max_tokens:  opts && opts.maxTokens   != null ? opts.maxTokens   : 1500
    };
    if (opts && opts.json) body.response_format = { type: 'json_object' };
    var resp = await _fetch('openai', url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey
      },
      body: JSON.stringify(body)
    }, signal, opts && opts.timeoutMs);
    var data = await resp.json();
    return data.choices[0].message.content;
  }

  async function callAnthropic(cfg, messages, signal, opts) {
    var systemMsg = messages.find(function (m) { return m.role === 'system'; });
    var userMsgs  = messages.filter(function (m) { return m.role !== 'system'; });
    var url = cfg.baseUrl + '/v1/messages';
    var body = {
      model:      cfg.model || DEFAULTS.anthropic.model,
      max_tokens: opts && opts.maxTokens != null ? opts.maxTokens : 1500,
      temperature: opts && opts.temperature != null ? opts.temperature : 0.3,
      system:     systemMsg ? (typeof systemMsg.content === 'string' ? systemMsg.content : null) : undefined,
      messages:   userMsgs.map(function (m) { return { role: m.role, content: _toAnthropicContent(m.content) }; })
    };
    var resp = await _fetch('anthropic', url, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    }, signal, opts && opts.timeoutMs);
    var data = await resp.json();
    return data.content[0].text;
  }

  async function callAzure(cfg, messages, signal, opts) {
    var url = cfg.baseUrl + '/openai/deployments/' + encodeURIComponent(cfg.model || '') + '/chat/completions?api-version=2024-02-01';
    var body = {
      messages: messages.map(function (m) { return { role: m.role, content: _toOpenAIContent(m.content) }; }),
      temperature: opts && opts.temperature != null ? opts.temperature : 0.3,
      max_tokens:  opts && opts.maxTokens   != null ? opts.maxTokens   : 1500
    };
    if (opts && opts.json) body.response_format = { type: 'json_object' };
    var resp = await _fetch('azure', url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key':      cfg.apiKey
      },
      body: JSON.stringify(body)
    }, signal, opts && opts.timeoutMs);
    var data = await resp.json();
    return data.choices[0].message.content;
  }

  async function callOllama(cfg, messages, signal, opts) {
    var url = (cfg.baseUrl || DEFAULTS.ollama.baseUrl) + '/api/chat';
    // Ollama has its own image-passing convention.
    var msgs = _ollamaImagesFromMessages(messages);
    var body = {
      model:    cfg.model || DEFAULTS.ollama.model,
      messages: msgs,
      stream:   false,
      format:   opts && opts.json ? 'json' : undefined,
      options:  { temperature: opts && opts.temperature != null ? opts.temperature : 0.3 }
    };
    var resp = await _fetch('ollama', url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    }, signal, opts && opts.timeoutMs);
    var data = await resp.json();
    return data.message.content;
  }

  // ── Core send ────────────────────────────────────────────────────────

  /**
   * Send a chat request. `messages[i].content` may be either a string or
   * a multimodal array of `{type:'text',text}` / `{type:'image',dataUrl}`
   * entries. Vision parts are rejected up front when the provider/model
   * isn't vision-capable so the user sees a clear error instead of a 400.
   *
   * @param {Array}            messages
   * @param {AbortSignal=}     signal
   * @param {Object=}          opts    { temperature, maxTokens, json, timeoutMs }
   */
  async function send(messages, signal, opts) {
    var cfg = getConfig();
    if (!cfg || !cfg.provider) throw new Error('LLM not configured. Open AI Settings to add your API key.');

    // Validate base URL on every send (defense against tampered storage).
    var v = validateBaseUrl(cfg.provider, cfg.baseUrl, { ollamaAllowRemote: !!cfg.ollamaAllowRemote });
    if (!v.ok) throw new Error('Invalid base URL: ' + v.reason);
    cfg = Object.assign({}, cfg, { baseUrl: v.url });

    // Capability gate for image content.
    var multimodal = _hasImages(messages);
    if (multimodal && visionCapability(cfg) === 'text') {
      throw new Error('Configured model "' + cfg.model + '" is not vision-capable. Switch to a vision model in AI Settings.');
    }

    var L = _L();
    var promptChars = messages.reduce(function (a, m) {
      var c = m.content;
      if (typeof c === 'string') return a + c.length;
      if (Array.isArray(c)) return a + c.reduce(function (s, p) { return s + (p && p.text ? String(p.text).length : 0); }, 0);
      return a;
    }, 0);
    var imageCount = 0;
    if (multimodal) {
      messages.forEach(function (m) {
        if (Array.isArray(m.content)) m.content.forEach(function (p) { if (p && (p.type === 'image' || p.type === 'image_url')) imageCount++; });
      });
    }
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (L) L.info('llm', 'request → ' + cfg.provider + ' (' + (cfg.model || '(default)') + ')', {
      provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl,
      promptChars: promptChars, messages: messages.length, images: imageCount,
      multimodal: multimodal
      // Note: cfg.apiKey is intentionally NEVER included here.
    });
    var out;
    try {
      var perCallOpts = Object.assign({}, opts || {});
      if (multimodal && !perCallOpts.timeoutMs) perCallOpts.timeoutMs = DEFAULT_VISION_TIMEOUT_MS;
      switch (cfg.provider) {
        case 'openai':    out = await callOpenAI(cfg, messages, signal, perCallOpts); break;
        case 'anthropic': out = await callAnthropic(cfg, messages, signal, perCallOpts); break;
        case 'azure':     out = await callAzure(cfg, messages, signal, perCallOpts); break;
        case 'ollama':    out = await callOllama(cfg, messages, signal, perCallOpts); break;
        default:          throw new Error('Unknown provider: ' + cfg.provider);
      }
    } catch (e) {
      var t1a = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (L) L.error('llm', 'response error from ' + cfg.provider + ' after ' + Math.round(t1a - t0) + 'ms: ' + (e && e.message),
        { provider: cfg.provider, model: cfg.model, durationMs: Math.round(t1a - t0), code: e && e.code, status: e && e.status });
      throw e;
    }
    var t2 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (L) L.info('llm', 'response ← ' + cfg.provider + ' in ' + Math.round(t2 - t0) + 'ms (' + (out ? out.length : 0) + ' chars)', {
      provider: cfg.provider, model: cfg.model, promptChars: promptChars,
      images: imageCount, responseChars: out ? out.length : 0, durationMs: Math.round(t2 - t0)
    });
    return out;
  }

  // Convenience: vision-only send. Accepts plain text + array of dataUrls.
  async function sendVision(systemText, userText, dataUrls, signal, opts) {
    var content = [{ type: 'text', text: userText || '' }];
    (dataUrls || []).forEach(function (u) {
      content.push({ type: 'image', dataUrl: u });
    });
    var messages = [];
    if (systemText) messages.push({ role: 'system', content: systemText });
    messages.push({ role: 'user', content: content });
    return send(messages, signal, opts);
  }

  // ── "Test connection" — minimal 1-token ping ────────────────────────

  async function ping(signal) {
    var cfg = getConfig();
    if (!cfg) throw new Error('Not configured.');
    var t0 = Date.now();
    var out = await send(
      [{ role: 'user', content: 'ping (reply with "pong")' }],
      signal,
      { maxTokens: 4, temperature: 0, timeoutMs: 15000 }
    );
    return { ok: true, ms: Date.now() - t0, sample: String(out || '').slice(0, 32) };
  }

  // ── Outbound endpoint preview (for the privacy banner) ───────────────

  function describeEndpoints(cfg) {
    cfg = cfg || getConfig() || {};
    var base = cfg.baseUrl || (DEFAULTS[cfg.provider] && DEFAULTS[cfg.provider].baseUrl) || '(unset)';
    switch (cfg.provider) {
      case 'openai':    return [base + '/chat/completions'];
      case 'anthropic': return [base + '/v1/messages'];
      case 'azure':     return [base + '/openai/deployments/<your-deployment>/chat/completions?api-version=2024-02-01'];
      case 'ollama':    return [base + '/api/chat'];
      default:          return [];
    }
  }

  // ── High-level convenience methods ──────────────────────────────────

  var SYSTEM_PROMPT = [
    'You are Plan-Examiner, an expert AI building code compliance reviewer.',
    'You have deep knowledge of IBC 2021, ADA 2010, NFPA 101, IRC, and local jurisdiction codes.',
    'You provide concise, technically accurate, actionable compliance guidance.',
    'When citing codes always include section numbers. Keep answers focused and professional.',
    'Do not include disclaimers about seeking legal advice unless specifically asked.'
  ].join(' ');

  /** Generate a narrative summary for a set of findings. */
  async function summarize(projectInfo, findings, signal) {
    var flagged = findings.filter(function (f) { return f.status === 'FLAGGED'; }).length;
    var review  = findings.filter(function (f) { return f.status === 'REVIEW'; }).length;
    var passed  = findings.filter(function (f) { return f.status === 'PASS'; }).length;
    var score   = PE.RuleEngine ? PE.RuleEngine.score(findings) : 0;

    var findingsList = findings
      .filter(function (f) { return f.status !== 'PASS'; })
      .map(function (f) { return '• [' + f.status + '] ' + f.label + ': ' + f.note; })
      .join('\n');

    var messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: [
        'Provide a concise (3-4 paragraph) narrative compliance summary for this plan review:',
        '',
        'Project: ' + projectInfo.buildingType + ' | ' + projectInfo.buildingCode + ' | ' + projectInfo.city + ', ' + projectInfo.state,
        'Score: ' + score + '/100  |  Flagged: ' + flagged + '  |  Needs Review: ' + review + '  |  Passed: ' + passed,
        '',
        'Key issues:',
        findingsList || 'No major issues found.',
        '',
        'Focus on the most critical findings, likely root causes, and overall submission readiness.'
      ].join('\n') }
    ];
    return send(messages, signal);
  }

  /** Draft a correction letter based on flagged/review items. */
  async function draftCorrectionLetter(projectInfo, findings, signal) {
    var issues = findings.filter(function (f) { return f.status === 'FLAGGED' || f.status === 'REVIEW'; });
    var messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: [
        'Draft a formal plan correction letter for the following project. Use standard building department format.',
        'Include: project header, correction items numbered with code citations, and a closing paragraph requesting resubmission.',
        '',
        'Project: ' + (projectInfo.buildingType || 'N/A') + ' development',
        'Jurisdiction: ' + (projectInfo.city || 'N/A') + ', ' + (projectInfo.state || 'N/A') + ', ' + (projectInfo.country || 'N/A'),
        'Applicable Code: ' + (projectInfo.buildingCode || 'IBC 2021'),
        'File Name: ' + (projectInfo.fileName || 'N/A'),
        '',
        'Corrections Required:',
        issues.map(function (f, i) {
          return (i + 1) + '. ' + f.label + ' [' + f.code_section + ']\n   Issue: ' + f.note + '\n   Remediation: ' + f.remediation;
        }).join('\n\n') || 'No corrections required.'
      ].join('\n') }
    ];
    return send(messages, signal);
  }

  /** Answer a follow-up question scoped to the current plan analysis. */
  async function chat(question, context, history, signal) {
    var contextSummary = [
      'Project: ' + (context.projectInfo.buildingType || '') + ' | ' + (context.projectInfo.buildingCode || '') + ' | ' + (context.projectInfo.city || '') + ', ' + (context.projectInfo.state || ''),
      'File: ' + (context.projectInfo.fileName || 'N/A'),
      'Occupant load: ' + (context.facts.occupantLoad || 'unknown'),
      'Gross area: ' + (context.facts.grossArea || 'unknown') + ' sq ft',
      'Stories: ' + (context.facts.stories || 'unknown'),
      'Sprinklers: ' + (context.facts.hasSprinklers === true ? 'Yes' : context.facts.hasSprinklers === false ? 'No' : 'Not verified'),
      '',
      'Findings:',
      context.findings.map(function (f) {
        return '[' + f.status + '] ' + f.id + ': ' + f.label + (f.note ? ' — ' + f.note : '');
      }).join('\n')
    ].join('\n');

    var messages = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\nCurrent plan context:\n' + contextSummary }
    ].concat(history || []).concat([
      { role: 'user', content: question }
    ]);

    return send(messages, signal);
  }

  // ── Vision fact extraction (structured JSON) ────────────────────────

  // Allowed numeric facts with sane clamps (defensive — model may hallucinate).
  var VISION_NUMERIC_FACTS = {
    grossArea:                { min: 1,    max: 10000000 },
    occupantLoad:             { min: 1,    max: 1000000  },
    stories:                  { min: 1,    max: 200, integer: true },
    buildingHeightFt:         { min: 1,    max: 3000  },
    corridorWidthInches:      { min: 6,    max: 600   },
    doorWidthInches:          { min: 6,    max: 240   },
    stairTreadDepthIn:        { min: 4,    max: 30    },
    stairRiserHeightIn:       { min: 3,    max: 14    },
    stairWidthInches:         { min: 12,   max: 240   },
    adaTurningRadiusIn:       { min: 12,   max: 240   },
    fireSeparationDistanceFt: { min: 0,    max: 1000  },
    travelDistanceFt:         { min: 1,    max: 5000  },
    totalParkingSpaces:       { min: 0,    max: 100000, integer: true },
    accessibleParkingSpaces:  { min: 0,    max: 10000,  integer: true },
    rampSlope:                { min: 0,    max: 1     }
  };
  var VISION_STRING_FACTS = ['occupancyGroup'];
  var VISION_BOOL_FACTS   = ['hasSprinklers', 'hasFireAlarm', 'hasExitSigns', 'hasEmergencyLighting', 'hasHandrails'];

  var VISION_SYSTEM = [
    'You are Plan-Examiner Vision: an expert at reading architectural drawings, title blocks, and code summary sheets.',
    'Your job is to extract structured numerical facts and feature flags from rasterized plan pages.',
    'Return STRICT JSON only — no prose, no Markdown, no code fences.',
    'For every field include a confidence in [0,1] and a brief evidence string (e.g. "Code Summary sheet G-001, OCCUPANT LOAD 320").',
    'If a field is not visible on the page, OMIT it entirely. Never guess.',
    'Use the units defined in the schema. Do not invent fields.'
  ].join(' ');

  function _buildVisionUserPrompt(pageInfo) {
    var fields = Object.keys(VISION_NUMERIC_FACTS).map(function (k) {
      var c = VISION_NUMERIC_FACTS[k];
      return '  "' + k + '": { "value": <number>, "confidence": <0..1>, "evidence": "<short>" }   // ' + (c.integer ? 'integer ' : '') + 'in [' + c.min + ',' + c.max + ']';
    }).join('\n');
    return [
      'Extract the following compliance facts from the provided plan page image(s)' +
        (pageInfo ? ' (' + pageInfo + ')' : '') + '.',
      '',
      'Return JSON of shape:',
      '{',
      fields + ',',
      '  "occupancyGroup": { "value": "<IBC use group e.g. A-2, B, M>", "confidence": <0..1>, "evidence": "<short>" },',
      VISION_BOOL_FACTS.map(function (k) {
        return '  "' + k + '": { "value": <true|false>, "confidence": <0..1>, "evidence": "<short>" }';
      }).join(',\n'),
      '}',
      '',
      'Omit any field you cannot read with confidence ≥ 0.4. Output JSON only.'
    ].join('\n');
  }

  /**
   * Tolerantly parse a model JSON reply. Handles code-fenced JSON, trailing
   * prose, and non-JSON garbage by returning {} instead of throwing.
   */
  function parseVisionJson(text) {
    if (!text || typeof text !== 'string') return {};
    var s = text.trim();
    // Strip Markdown code fences.
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    // Find the first {...} balanced block.
    var first = s.indexOf('{');
    var last  = s.lastIndexOf('}');
    if (first === -1 || last <= first) return {};
    var candidate = s.slice(first, last + 1);
    try { return JSON.parse(candidate); }
    catch (e) {
      // Try once more after stripping trailing commas (a common LLM tic).
      try { return JSON.parse(candidate.replace(/,(\s*[}\]])/g, '$1')); }
      catch (e2) { return {}; }
    }
  }

  /**
   * Validate / clamp a parsed vision JSON object against the allowed schema.
   * Returns a flat map: { factName: { value, confidence, evidence } }.
   * Drops unknown keys, NaNs, out-of-range values, and entries below the
   * caller's `minConfidence` (default 0.4).
   */
  function normalizeVisionFacts(raw, opts) {
    opts = opts || {};
    var minConf = typeof opts.minConfidence === 'number' ? opts.minConfidence : 0.4;
    var out = {};
    if (!raw || typeof raw !== 'object') return out;

    function _entry(name, v) {
      if (v == null) return;
      // Accept either { value, confidence, evidence } or a bare scalar.
      var value      = (typeof v === 'object' && 'value' in v) ? v.value : v;
      var confidence = (typeof v === 'object' && typeof v.confidence === 'number') ? v.confidence : 1;
      var evidence   = (typeof v === 'object' && typeof v.evidence   === 'string') ? v.evidence.slice(0, 240) : '';
      if (typeof confidence !== 'number' || isNaN(confidence)) confidence = 0;
      if (confidence < 0) confidence = 0;
      if (confidence > 1) confidence = 1;
      if (confidence < minConf) return;

      if (Object.prototype.hasOwnProperty.call(VISION_NUMERIC_FACTS, name)) {
        var n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
        if (!isFinite(n)) return;
        var c = VISION_NUMERIC_FACTS[name];
        if (c.integer) n = Math.round(n);
        if (n < c.min || n > c.max) return;
        out[name] = { value: n, confidence: confidence, evidence: evidence };
        return;
      }
      if (VISION_STRING_FACTS.indexOf(name) !== -1) {
        if (typeof value !== 'string' || !value) return;
        out[name] = { value: value.trim().slice(0, 64), confidence: confidence, evidence: evidence };
        return;
      }
      if (VISION_BOOL_FACTS.indexOf(name) !== -1) {
        if (typeof value !== 'boolean') {
          if (value === 'true' || value === 1)  value = true;
          else if (value === 'false' || value === 0) value = false;
          else return;
        }
        out[name] = { value: value, confidence: confidence, evidence: evidence };
        return;
      }
      // Unknown key → drop silently.
    }

    Object.keys(raw).forEach(function (k) { _entry(k, raw[k]); });
    return out;
  }

  /**
   * Run vision extraction across one batch of page images. The caller is
   * responsible for chunking pages and respecting the byte budget.
   *
   * @param {Array<string>} dataUrls   - data:image/jpeg;base64,... entries
   * @param {Object}        opts       - { pageInfo, signal, minConfidence }
   * @returns {Object} normalized facts map (per `normalizeVisionFacts`)
   */
  async function extractFactsFromImages(dataUrls, opts) {
    opts = opts || {};
    if (!dataUrls || !dataUrls.length) return {};
    var raw = await sendVision(VISION_SYSTEM, _buildVisionUserPrompt(opts.pageInfo), dataUrls, opts.signal, {
      json: true, temperature: 0, maxTokens: 1200,
      timeoutMs: opts.timeoutMs || DEFAULT_VISION_TIMEOUT_MS
    });
    var parsed = parseVisionJson(raw);
    return normalizeVisionFacts(parsed, { minConfidence: opts.minConfidence });
  }

  return {
    SCHEMA_VERSION:        SCHEMA_VERSION,
    DEFAULTS:              DEFAULTS,
    VISION_MODELS:         VISION_MODELS,
    DEFAULT_MAX_VISION_PAGES: DEFAULT_MAX_VISION_PAGES,
    HARD_MAX_VISION_PAGES:    HARD_MAX_VISION_PAGES,
    TOTAL_VISION_BYTE_BUDGET: TOTAL_VISION_BYTE_BUDGET,
    VISION_NUMERIC_FACTS:  VISION_NUMERIC_FACTS,
    VISION_STRING_FACTS:   VISION_STRING_FACTS,
    VISION_BOOL_FACTS:     VISION_BOOL_FACTS,

    getConfig:             getConfig,
    setConfig:             setConfig,
    clearConfig:           clearConfig,
    isConfigured:          isConfigured,
    visionCapability:      visionCapability,
    isVisionCapable:       isVisionCapable,
    hasVisionConsent:      hasVisionConsent,
    setVisionConsent:      setVisionConsent,

    validateBaseUrl:       validateBaseUrl,
    keyShapeWarning:       keyShapeWarning,
    describeEndpoints:     describeEndpoints,

    send:                  send,
    sendVision:            sendVision,
    ping:                  ping,
    summarize:             summarize,
    draftCorrectionLetter: draftCorrectionLetter,
    chat:                  chat,

    parseVisionJson:       parseVisionJson,
    normalizeVisionFacts:  normalizeVisionFacts,
    extractFactsFromImages:extractFactsFromImages,

    // Exposed for tests only.
    _normalizeError:       _normalizeError
  };

}());

window.PE = PE;
