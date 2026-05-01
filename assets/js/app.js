/**
 * Plan-Examiner Main App
 * UI controller that wires together pipeline, LLM, history, and export modules.
 */

var PE = window.PE || {};

PE.App = (function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────
  var _currentResult = null;
  var _currentFile   = null;
  var _chatHistory   = [];
  var _chatContext   = null;
  var _chatAbort     = null;

  // ── DOM refs (populated in init) ────────────────────────────────────
  var $;

  // ── Init ─────────────────────────────────────────────────────────────
  function init() {
    $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    $.all = function (sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); };

    _initEncKey();
    _initNav();
    _initAccordion();
    _initFileDrop();
    _initUploadForm();
    _initSubscribeForm();
    _initPricingCalc();
    _initModal();
    _initPartnerGate();
    _initAISettings();
    _initChat();
    _initKeyboardShortcuts();
    _initCommandPalette();
    _initHistoryTab();
    _initVerboseLogPanel();
    _registerSW();
  }

  // ── Encryption key ────────────────────────────────────────────────────
  function _initEncKey() {
    var arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    var key = Array.from(arr, function (b) { return ('00' + b.toString(16)).slice(-2); }).join('');
    var keyInput = document.getElementById('encryptionKey');
    var keyDisp  = document.getElementById('displayEncKey');
    if (keyInput) keyInput.value = key;
    if (keyDisp)  keyDisp.textContent = key;
  }

  // ── Partner / free-trial gating ──────────────────────────────────────
  // Visitors get one free comprehensive analysis. After that, continued
  // use is reserved for subscribed partners (see plan-examiner@dascient.com).
  var FREE_ANALYSIS_LIMIT  = 1;
  var ANALYSIS_COUNT_KEY   = 'pe.analysisCount';
  var PARTNER_KEY_FLAG     = 'pe.partnerKey';

  function _getAnalysisCount() {
    try { return parseInt(localStorage.getItem(ANALYSIS_COUNT_KEY), 10) || 0; }
    catch (e) { return 0; }
  }
  function _incAnalysisCount() {
    try { localStorage.setItem(ANALYSIS_COUNT_KEY, String(_getAnalysisCount() + 1)); }
    catch (e) { /* storage unavailable */ }
  }
  function _isPartner() {
    try { return !!localStorage.getItem(PARTNER_KEY_FLAG); }
    catch (e) { return false; }
  }
  function _setPartner(key) {
    try { localStorage.setItem(PARTNER_KEY_FLAG, key); } catch (e) {}
  }
  function _hasReachedFreeLimit() {
    return !_isPartner() && _getAnalysisCount() >= FREE_ANALYSIS_LIMIT;
  }

  // SHA-256 hex digest of a normalized email (trimmed, lowercased) used to
  // check the public partner allowlist without ever transmitting the
  // plaintext address. Returns null if SubtleCrypto is unavailable.
  async function _hashEmail(email) {
    if (!email) return null;
    var normalized = String(email).trim().toLowerCase();
    if (!normalized) return null;
    if (!(window.crypto && window.crypto.subtle && window.TextEncoder)) return null;
    var data = new TextEncoder().encode(normalized);
    var buf  = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf), function (b) {
      return ('00' + b.toString(16)).slice(-2);
    }).join('');
  }

  // Fetch the public partner allowlist. Hashed entries only — no
  // plaintext emails are stored or transmitted. Only successful fetches
  // are memoized (with a short TTL) so a donor whose hash hasn't landed
  // yet — or who is briefly offline — will re-fetch on the next attempt
  // instead of being stuck with a stale empty list until full reload.
  var _partnersCache = null;
  var _partnersCacheLoadedAt = 0;
  var _partnersCachePromise = null;
  var PARTNERS_CACHE_TTL_MS = 5 * 60 * 1000;
  async function _loadPartners() {
    var now = Date.now();
    if (_partnersCache && (now - _partnersCacheLoadedAt) < PARTNERS_CACHE_TTL_MS) {
      return _partnersCache;
    }
    if (_partnersCachePromise) return _partnersCachePromise;
    _partnersCachePromise = (async function () {
      try {
        // cache:'no-store' prevents the SW/HTTP caches from serving a
        // stale allowlist when the owner has just appended a new hash.
        var resp = await fetch('assets/data/partners.json', { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var json = await resp.json();
        var partners = (json && Array.isArray(json.hashedEmails))
          ? json.hashedEmails.map(function (h) { return String(h).toLowerCase(); })
          : [];
        _partnersCache = partners;
        _partnersCacheLoadedAt = Date.now();
        return _partnersCache;
      } catch (e) {
        // Don't poison the cache on failure — let the next call retry.
        return [];
      } finally {
        _partnersCachePromise = null;
      }
    }());
    return _partnersCachePromise;
  }

  // ── Navigation ────────────────────────────────────────────────────────
  function _initNav() {
    // Mobile menu toggle
    var btn = document.getElementById('mobileMenuBtn');
    var menu = document.getElementById('mobileMenu');
    if (btn) btn.addEventListener('click', function () { menu && menu.classList.toggle('hidden'); });

    // Close mobile menu on link click
    $.all('#mobileMenu a').forEach(function (a) {
      a.addEventListener('click', function () { menu && menu.classList.add('hidden'); });
    });

    // LLM config badge on nav
    _updateLLMBadge();
  }

  function _updateLLMBadge() {
    var badge = document.getElementById('aiSettingsBtn');
    if (!badge) return;
    if (PE.LLM && PE.LLM.isConfigured()) {
      var cfg = PE.LLM.getConfig();
      var modelLabel = (cfg.model || '').split('-').slice(0,2).join('-') || cfg.provider;
      var cap = PE.LLM.visionCapability(cfg);
      var visionTag = cfg.useVision && cap === 'vision' ? ' 👁' : '';
      badge.textContent = 'AI: ' + cfg.provider + ' ' + modelLabel + visionTag;
      badge.style.background = 'rgba(52,211,153,.1)';
      badge.style.borderColor = 'rgba(52,211,153,.3)';
      badge.style.color = '#34d399';
    } else {
      badge.textContent = 'AI: Not configured';
      badge.style.background = 'rgba(255,255,255,.04)';
      badge.style.borderColor = 'rgba(255,255,255,.1)';
      badge.style.color = '#64748b';
    }
  }

  // ── Accordion ─────────────────────────────────────────────────────────
  function _initAccordion() {
    $.all('.accordion-trigger').forEach(function (btn) {
      // a11y
      btn.setAttribute('aria-expanded', 'false');
      var content = btn.closest('.accordion-item').querySelector('.accordion-content');
      if (content) {
        var id = 'acc-' + Math.random().toString(36).slice(2);
        content.id = id;
        btn.setAttribute('aria-controls', id);
      }

      btn.addEventListener('click', function () {
        var item   = btn.closest('.accordion-item');
        var isOpen = item.classList.contains('open');
        $.all('.accordion-item').forEach(function (i) {
          i.classList.remove('open');
          var t = i.querySelector('.accordion-trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  // ── File drop zone ────────────────────────────────────────────────────
  function _initFileDrop() {
    var fileInput       = document.getElementById('planFile');
    var fileDrop        = document.getElementById('fileDrop');
    var fileDropContent = document.getElementById('fileDropContent');
    var fileSelectedEl  = document.getElementById('fileSelected');
    var fileNameDisplay = document.getElementById('fileNameDisplay');
    if (!fileDrop) return;

    fileDrop.addEventListener('click', function () { fileInput && fileInput.click(); });
    fileDrop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') fileInput && fileInput.click(); });

    if (fileInput) fileInput.addEventListener('change', function () {
      if (fileInput.files.length) {
        _setFileSelected(fileDropContent, fileSelectedEl, fileNameDisplay, fileInput.files[0].name);
      }
    });

    fileDrop.addEventListener('dragover', function (e) { e.preventDefault(); fileDrop.classList.add('drag-over'); });
    fileDrop.addEventListener('dragleave', function () { fileDrop.classList.remove('drag-over'); });
    fileDrop.addEventListener('drop', function (e) {
      e.preventDefault();
      fileDrop.classList.remove('drag-over');
      if (e.dataTransfer.files.length) {
        var dt = new DataTransfer();
        dt.items.add(e.dataTransfer.files[0]);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    });
  }

  function _setFileSelected(dropContent, selectedEl, nameEl, name) {
    if (dropContent) dropContent.classList.add('hidden');
    if (selectedEl)  selectedEl.classList.remove('hidden');
    if (nameEl)      nameEl.textContent = name;
  }

  // ── Upload form ───────────────────────────────────────────────────────
  function _initUploadForm() {
    var form = document.getElementById('uploadForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var errBox = document.getElementById('uploadError');
      var errMsg = document.getElementById('uploadErrorMsg');
      if (errBox) errBox.classList.add('hidden');

      var buildingType = document.getElementById('buildingType') ? document.getElementById('buildingType').value : '';
      var buildingCode = document.getElementById('buildingCode') ? document.getElementById('buildingCode').value : '';
      var city         = (document.getElementById('city') || {}).value || '';
      var state        = (document.getElementById('state') || {}).value || '';
      var country      = (document.getElementById('country') || {}).value || '';
      var fileInput    = document.getElementById('planFile');

      function showErr(msg) {
        if (errMsg) errMsg.textContent = msg;
        if (errBox) errBox.classList.remove('hidden');
      }

      if (!buildingType || !buildingCode || !city.trim() || !state.trim() || !country.trim()) {
        showErr('Please fill in all project details before analyzing.'); return;
      }
      if (!fileInput || !fileInput.files.length) {
        showErr('Please select a plan file (.pdf, .docx, .dxf, or .dwg).'); return;
      }

      // Partner-access gate: visitors get one free comprehensive analysis;
      // continued use is exclusive to subscribed partners.
      if (_hasReachedFreeLimit()) {
        openPartnerGate();
        return;
      }

      var file     = fileInput.files[0];
      var formData = { buildingType: buildingType, buildingCode: buildingCode, city: city.trim(), state: state.trim(), country: country.trim() };

      // Vision opt-in handshake. The pipeline already gates on consent, but
      // we present the explicit "page images leave your browser" dialog
      // here so the user can confirm BEFORE we open the modal and start
      // rasterizing. If they decline, vision is suppressed for this run.
      if (PE.LLM && PE.LLM.isConfigured()) {
        var llmCfg = PE.LLM.getConfig() || {};
        var pdfFile = /\.pdf$/i.test(file.name);
        if (pdfFile && llmCfg.useVision && PE.LLM.isVisionCapable(llmCfg)) {
          formData.useVision = true;
          formData.maxVisionPages = llmCfg.maxVisionPages || PE.LLM.DEFAULT_MAX_VISION_PAGES;
          if (!PE.LLM.hasVisionConsent()) {
            var ok = await _requestVisionConsent(llmCfg.provider, formData.maxVisionPages);
            if (!ok) formData.useVision = false; // user declined; pipeline will skip vision
          }
        }
      }

      // Open modal and show pipeline tab
      openModal();
      switchTab('pipeline');
      _resetPipelineUI();
      _currentFile = file;

      try {
        var result = await PE.Pipeline.run(file, formData, function (stepId, status, detail) {
          _updatePipelineStep(stepId, status, detail);
        });

        // Surface file integrity metadata (extracted by extractors.js) to
        // the verbose panel so the user can confirm the right file was
        // ingested. Fall back to a fresh hash if not available.
        var meta = (result.rawExtraction && result.rawExtraction.fileMeta) || null;
        if (!meta) {
          var fileBuf  = await file.arrayBuffer();
          var fileHash = await (PE.Export ? PE.Export.hashFile(fileBuf) : Promise.resolve(null));
          meta = { fileName: file.name, sizeBytes: file.size, mimeType: file.type || 'unknown',
                   lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
                   sha256: fileHash };
        }
        _renderFileMetaInVerbosePanel(meta);

        result.projectInfo = Object.assign({ fileName: file.name }, formData);
        result.fileHash    = meta && meta.sha256;
        result.fileMeta    = meta;
        _currentResult     = result;
        _chatHistory       = [];
        _chatContext       = { projectInfo: result.projectInfo, facts: result.facts, findings: result.findings };

        // Build preview
        _buildPreview(result);
        // Build analysis tab
        _buildAnalysis(result);
        // Save to history
        if (PE.History) PE.History.save({ projectInfo: result.projectInfo, score: result.score, findingsSummary: { flagged: result.findings.filter(function (f) { return f.status === 'FLAGGED'; }).length, review: result.findings.filter(function (f) { return f.status === 'REVIEW'; }).length, passed: result.findings.filter(function (f) { return f.status === 'PASS'; }).length } }).catch(function () {});

        // Count this completed comprehensive analysis toward the free-trial limit.
        _incAnalysisCount();

        // After pipeline finishes, switch to analysis
        setTimeout(function () { switchTab('analysis'); }, 600);

      } catch (err) {
        console.error(err);
        showErr('An error occurred: ' + err.message);
        closeModal();
      }
    });
  }

  // ── Pipeline UI ───────────────────────────────────────────────────────
  function _resetPipelineUI() {
    if (!PE.Pipeline) return;
    PE.Pipeline.STEPS.forEach(function (step) {
      var el = document.getElementById('step-' + step.id);
      if (!el) return;
      el.className = 'pipeline-step pending';
      var statusEl = el.querySelector('.step-status');
      if (statusEl) statusEl.textContent = '';
      var detailEl = el.querySelector('.step-detail');
      if (detailEl) detailEl.textContent = '';
      var iconEl = el.querySelector('.step-icon i');
      if (iconEl) { iconEl.className = 'fas ' + step.icon; }
    });
    // Clear verbose log file-meta and (optionally) buffer for a fresh run.
    var metaEl = document.getElementById('verboseLogFileMeta');
    if (metaEl) { metaEl.style.display = 'none'; metaEl.innerHTML = ''; }
    if (PE.Log) PE.Log.clear();
  }

  function _updatePipelineStep(stepId, status, detail) {
    var el = document.getElementById('step-' + stepId);
    if (!el) return;
    el.className = 'pipeline-step ' + status;
    var iconEl = el.querySelector('.step-icon i');
    if (iconEl) {
      if (status === 'running') iconEl.className = 'fas fa-circle-notch fa-spin';
      else if (status === 'done')  iconEl.className = 'fas fa-check';
      else if (status === 'error') iconEl.className = 'fas fa-xmark';
    }
    var detailEl = el.querySelector('.step-detail');
    if (detailEl) detailEl.textContent = detail || '';
  }

  // ── Preview ───────────────────────────────────────────────────────────
  function _buildPreview(result) {
    var container = document.getElementById('previewContainer');
    if (!container) return;
    var extraction = result.rawExtraction || {};
    var meta = result.fileMeta || extraction.fileMeta || null;
    var metaHtml = '';
    if (meta) {
      metaHtml =
        '<div style="background:rgba(56,189,248,.04);border:1px solid rgba(56,189,248,.15);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:.7rem;color:#94a3b8;font-family:\'ui-monospace\',monospace;line-height:1.55;">' +
        '<div style="display:flex;flex-wrap:wrap;gap:14px;">' +
        '<span><strong style="color:#7dd3fc;">Size:</strong> ' + (meta.sizeBytes != null ? meta.sizeBytes.toLocaleString() : 'n/a') + ' B</span>' +
        '<span><strong style="color:#7dd3fc;">MIME:</strong> ' + _esc(meta.mimeType || 'unknown') + '</span>' +
        '<span><strong style="color:#7dd3fc;">Modified:</strong> ' + _esc(meta.lastModified || 'n/a') + '</span>' +
        (extraction.parseDurationMs != null ? '<span><strong style="color:#7dd3fc;">Parsed in:</strong> ' + extraction.parseDurationMs + ' ms</span>' : '') +
        '</div>' +
        '<div style="margin-top:4px;word-break:break-all;"><strong style="color:#7dd3fc;">SHA-256:</strong> ' + _esc(meta.sha256 || 'n/a') + '</div>' +
        (extraction.warningMsg ? '<div style="margin-top:6px;color:#fbbf24;"><i class="fas fa-triangle-exclamation mr-1" aria-hidden="true"></i>' + _esc(extraction.warningMsg) + '</div>' : '') +
        '</div>';
    }

    if (extraction.source === 'dwg') {
      container.innerHTML = metaHtml + '<div style="text-align:center;padding:48px 24px;">' +
        '<i class="fas fa-drafting-compass" style="font-size:2.5rem;color:#38bdf8;display:block;margin-bottom:16px;"></i>' +
        '<p style="font-weight:600;color:#fff;margin-bottom:8px;">DWG file received: ' + _esc(result.projectInfo.fileName) + '</p>' +
        '<p style="font-size:.875rem;color:#64748b;">Native DWG rendering requires the full engine. Convert to DXF or PDF for automated analysis.</p></div>';
    } else if (extraction.source === 'pdf') {
      container.innerHTML = metaHtml + '<div style="text-align:center;padding:32px 24px;">' +
        '<i class="fas fa-file-pdf" style="font-size:2.5rem;color:#f87171;display:block;margin-bottom:12px;"></i>' +
        '<p style="font-weight:600;color:#fff;margin-bottom:8px;">' + _esc(result.projectInfo.fileName) + '</p>' +
        '<p style="font-size:.875rem;color:#64748b;margin-bottom:16px;">' + (extraction.pageCount || '?') + ' page(s) · Text extracted for analysis</p>' +
        '<div style="text-align:left;font-size:.75rem;color:#94a3b8;max-height:260px;overflow-y:auto;white-space:pre-wrap;background:rgba(255,255,255,.02);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,.06);">' + _esc((extraction.text || '').slice(0, 2000)) + (extraction.text && extraction.text.length > 2000 ? '…' : '') + '</div></div>';
    } else if (extraction.source === 'dxf') {
      container.innerHTML = metaHtml + '<div style="padding:16px;">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">' +
        '<i class="fas fa-vector-square" style="color:#38bdf8;font-size:1.5rem;"></i>' +
        '<div><p style="font-weight:600;color:#fff;margin:0;">' + _esc(result.projectInfo.fileName) + '</p>' +
        '<p style="font-size:.75rem;color:#64748b;margin:0;">' + (extraction.layers ? extraction.layers.length + ' layers · ' : '') + (extraction.lineCount || 0) + ' LINE entities · ' + (extraction.textEntities || 0) + ' text entities</p></div></div>' +
        (extraction.layers && extraction.layers.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">' + extraction.layers.slice(0, 20).map(function (l) { return '<span style="font-size:.65rem;padding:2px 8px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);border-radius:4px;color:#7dd3fc;">' + _esc(l) + '</span>'; }).join('') + (extraction.layers.length > 20 ? '<span style="font-size:.65rem;color:#64748b;">+' + (extraction.layers.length - 20) + ' more</span>' : '') + '</div>' : '') + '</div>';
    } else if (extraction.source === 'docx') {
      container.innerHTML = metaHtml + '<div style="color:#cbd5e1;font-size:.875rem;line-height:1.7;">' + _extractDocxHtml(result) + '</div>';
    } else if (extraction.source === 'image') {
      container.innerHTML = metaHtml + '<div style="padding:16px;">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">' +
        '<i class="fas fa-image" style="color:#38bdf8;font-size:1.5rem;"></i>' +
        '<div><p style="font-weight:600;color:#fff;margin:0;">' + _esc(result.projectInfo.fileName) + '</p>' +
        '<p style="font-size:.75rem;color:#64748b;margin:0;">OCR extracted ' + (extraction.text || '').length + ' chars</p></div></div>' +
        '<div style="text-align:left;font-size:.75rem;color:#94a3b8;max-height:240px;overflow-y:auto;white-space:pre-wrap;background:rgba(255,255,255,.02);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,.06);">' + _esc((extraction.text || '').slice(0, 2000)) + (extraction.text && extraction.text.length > 2000 ? '…' : '') + '</div></div>';
    } else {
      container.innerHTML = metaHtml + '<p style="text-align:center;padding:48px;color:#64748b;">No preview available for this file type' + (extraction.unsupportedReason ? ': ' + _esc(extraction.unsupportedReason) : '.') + '</p>';
    }
  }

  function _extractDocxHtml(result) {
    // Re-render DOCX HTML if mammoth result was stored, else show text snippet
    var text = (result.rawExtraction && result.rawExtraction.text) || '';
    return '<pre style="white-space:pre-wrap;font-family:inherit;">' + _esc(text.slice(0, 3000)) + (text.length > 3000 ? '…' : '') + '</pre>';
  }

  // ── Analysis tab ──────────────────────────────────────────────────────
  function _buildAnalysis(result) {
    var container = document.getElementById('analysisContent');
    if (!container) return;

    var score    = result.score || 0;
    var findings = result.findings || [];
    var flagged  = findings.filter(function (f) { return f.status === 'FLAGGED'; });
    var review   = findings.filter(function (f) { return f.status === 'REVIEW';  });
    var passed   = findings.filter(function (f) { return f.status === 'PASS';    });
    var info     = result.projectInfo || {};

    var scoreColor = score >= 85 ? '#34d399' : score >= 65 ? '#fbbf24' : '#f87171';

    // Score header
    var html = '<div style="background:rgba(56,189,248,.05);border:1px solid rgba(56,189,248,.18);border-radius:16px;padding:20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<div><div style="font-size:.7rem;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.1em;">Compliance Score</div>' +
      '<div style="font-size:2.8rem;font-weight:700;color:' + scoreColor + ';font-family:\'Space Grotesk\',sans-serif;">' + score + '%</div>' +
      '<div style="font-size:.75rem;color:#64748b;margin-top:4px;">' + passed.length + ' pass · ' + review.length + ' review · ' + flagged.length + ' flagged</div></div>' +
      '<div style="text-align:right;font-size:.75rem;color:#64748b;">' +
      '<div><span style="color:#fff;font-weight:600;">' + _esc(info.buildingType || '') + '</span></div>' +
      '<div>' + _esc(info.buildingCode || '') + '</div><div>' + _esc((info.city || '') + ', ' + (info.state || '')) + '</div></div></div>';

    // Summary
    if (result.summary) {
      html += '<div style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px;margin-bottom:16px;">' +
        '<div style="font-size:.7rem;color:#38bdf8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Summary</div>' +
        '<div style="font-size:.8rem;line-height:1.65;color:#94a3b8;white-space:pre-wrap;">' + _esc(result.summary).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;">$1</strong>').replace(/^##\s+(.+)$/gm, '<strong style="color:#e2e8f0;font-size:.9rem;">$1</strong>').replace(/^-\s+/gm, '• ') + '</div></div>';
    }

    // Rule coverage report — surfaces which evidence keys were used vs missing.
    // Helps the user understand *why* certain rules ended up REVIEW (data
    // unavailable) instead of PASS/FLAGGED.
    if (Array.isArray(result.coverage) && result.coverage.length) {
      var totalKeys   = result.coverage.length;
      var missingKeys = result.coverage.filter(function (c) { return c.missing; });
      var presentKeys = totalKeys - missingKeys.length;
      html += '<details style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 16px;margin-bottom:16px;">' +
        '<summary style="cursor:pointer;font-size:.7rem;color:#38bdf8;text-transform:uppercase;letter-spacing:.1em;display:flex;align-items:center;gap:10px;">' +
        '<span>Rule Coverage</span>' +
        '<span style="font-size:.7rem;color:#cbd5e1;text-transform:none;letter-spacing:0;font-weight:400;">' +
        presentKeys + ' / ' + totalKeys + ' evidence keys present · ' + missingKeys.length + ' missing' +
        '</span></summary>' +
        '<div style="margin-top:10px;font-size:.75rem;color:#94a3b8;">' +
        (missingKeys.length
          ? '<p style="margin:0 0 6px 0;">Rules that need additional input (' + missingKeys.length + '):</p>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
            missingKeys.map(function (c) {
              return '<span title="' + _esc(c.used_by.map(function (u) { return u.pack_id + '/' + u.rule_id; }).join(', ')) +
                '" style="font-size:.65rem;padding:2px 8px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:4px;color:#fbbf24;">' + _esc(c.key) + '</span>';
            }).join('') +
            '</div>'
          : '<p style="margin:0;color:#34d399;">All evidence keys for the selected rule packs are present.</p>') +
        '</div></details>';
    }

    // Filter bar
    html += '<div style="display:flex;gap:6px;margin-bottom:12px;" id="findingFilters">' +
      '<button class="filter-btn active" data-filter="all" onclick="PE.App.filterFindings(\'all\',this)" style="font-size:.7rem;padding:4px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.15);background:rgba(56,189,248,.1);color:#38bdf8;cursor:pointer;">All (' + findings.length + ')</button>' +
      '<button class="filter-btn" data-filter="FLAGGED" onclick="PE.App.filterFindings(\'FLAGGED\',this)" style="font-size:.7rem;padding:4px 12px;border-radius:999px;border:1px solid rgba(248,113,113,.3);background:transparent;color:#f87171;cursor:pointer;">Flagged (' + flagged.length + ')</button>' +
      '<button class="filter-btn" data-filter="REVIEW" onclick="PE.App.filterFindings(\'REVIEW\',this)" style="font-size:.7rem;padding:4px 12px;border-radius:999px;border:1px solid rgba(251,191,36,.3);background:transparent;color:#fbbf24;cursor:pointer;">Review (' + review.length + ')</button>' +
      '<button class="filter-btn" data-filter="PASS" onclick="PE.App.filterFindings(\'PASS\',this)" style="font-size:.7rem;padding:4px 12px;border-radius:999px;border:1px solid rgba(52,211,153,.3);background:transparent;color:#34d399;cursor:pointer;">Pass (' + passed.length + ')</button>' +
      '</div>';

    // Findings list
    html += '<div id="findingsList" aria-live="polite" aria-label="Compliance findings">' +
      findings.map(function (f) { return _findingRow(f); }).join('') + '</div>';

    // Export buttons
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;">' +
      '<button onclick="PE.App.exportReport()" class="btn-accent" style="font-size:.8rem;padding:10px 18px;" title="Open printable compliance report">' +
      '<i class="fas fa-print text-xs"></i> Print Report</button>' +
      '<button onclick="PE.App.exportLetter()" class="btn-ghost" style="font-size:.8rem;padding:10px 18px;" title="Download correction letter as markdown">' +
      '<i class="fas fa-file-arrow-down text-xs"></i> Correction Letter</button>' +
      '<button onclick="PE.App.exportJson()" class="btn-ghost" style="font-size:.8rem;padding:10px 18px;" title="Export findings as JSON">' +
      '<i class="fas fa-code text-xs"></i> Export JSON</button>' +
      '</div>';

    html += '<p style="font-size:.7rem;color:#475569;margin-top:10px;">* Automated preview. Subscribe for complete review with official correction letter and redline overlay.</p>';

    container.innerHTML = html;
  }

  function _findingRow(f) {
    var statusStyle = {
      PASS:    'color:#34d399;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);',
      REVIEW:  'color:#fbbf24;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);',
      FLAGGED: 'color:#f87171;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);'
    };
    var wrapStyle = f.status === 'FLAGGED' ? 'border-color:rgba(248,113,113,.15);background:rgba(248,113,113,.03);' :
                    f.status === 'REVIEW'  ? 'border-color:rgba(251,191,36,.15);background:rgba(251,191,36,.02);' :
                    'border-color:rgba(255,255,255,.07);background:rgba(255,255,255,.025);';

    return '<div class="finding-row" data-status="' + f.status + '" style="border-radius:12px;padding:12px 14px;margin-bottom:8px;border:1px solid;' + wrapStyle + '">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">' +
      '<div style="flex:1;">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">' +
      '<span style="font-size:.8rem;font-weight:600;color:#e2e8f0;">' + _esc(f.label) + '</span>' +
      '<span style="font-size:.65rem;color:#64748b;">' + _esc(f.code_section || '') + '</span>' +
      (f.pack_name ? '<span title="' + _esc(f.license || '') + '" style="font-size:.55rem;color:#94a3b8;background:rgba(148,163,184,.12);padding:1px 6px;border-radius:3px;">' + _esc(f.pack_name) + '</span>' : '') +
      (f.experimental ? '<span title="Experimental — not yet fully validated" style="font-size:.55rem;color:#fbbf24;background:rgba(251,191,36,.1);padding:1px 6px;border-radius:3px;">EXP</span>' : '') +
      '</div>' +
      '<p style="font-size:.75rem;color:#94a3b8;margin:0 0 4px 0;">' + _esc(f.note) + '</p>' +
      (f.status !== 'PASS' ? '<details style="margin-top:4px;"><summary style="font-size:.7rem;color:#64748b;cursor:pointer;">Remediation ›</summary><p style="font-size:.72rem;color:#7dd3fc;margin:4px 0 0 0;padding-left:8px;">' + _esc(f.remediation) + '</p>' + (f.source_url ? '<p style="font-size:.7rem;margin:4px 0 0 8px;"><a href="' + _esc(f.source_url) + '" target="_blank" rel="noopener noreferrer" style="color:#7dd3fc;">Open source ›</a></p>' : '') + '</details>' : '') +
      '</div>' +
      '<span style="font-size:.6rem;font-weight:700;padding:3px 8px;border-radius:5px;letter-spacing:.07em;white-space:nowrap;flex-shrink:0;' + (statusStyle[f.status] || '') + '">' + f.status + '</span>' +
      '</div></div>';
  }

  // ── Finding filter ────────────────────────────────────────────────────
  function filterFindings(filter, btn) {
    $.all('.filter-btn').forEach(function (b) {
      b.classList.remove('active');
      b.style.background = 'transparent';
    });
    if (btn) {
      btn.classList.add('active');
      btn.style.background = filter === 'all' ? 'rgba(56,189,248,.1)' : filter === 'FLAGGED' ? 'rgba(248,113,113,.1)' : filter === 'REVIEW' ? 'rgba(251,191,36,.1)' : 'rgba(52,211,153,.1)';
    }
    $.all('.finding-row').forEach(function (row) {
      row.style.display = (filter === 'all' || row.dataset.status === filter) ? '' : 'none';
    });
  }

  // ── Export ────────────────────────────────────────────────────────────
  function exportReport() {
    if (!_currentResult || !PE.Export) return;
    PE.Export.printReport(_currentResult);
  }

  function exportLetter() {
    if (!_currentResult || !PE.Export) return;
    PE.Export.downloadLetter(_currentResult);
  }

  function exportJson() {
    if (!_currentResult || !PE.Export) return;
    PE.Export.downloadJson(_currentResult);
  }

  // ── Modal ─────────────────────────────────────────────────────────────
  function _initModal() {
    var overlay = document.getElementById('modalOverlay');
    if (!overlay) return;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeAIModal(); } });
  }

  function openModal() {
    var el = document.getElementById('modalOverlay');
    if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden'; }
  }

  function closeModal() {
    var el = document.getElementById('modalOverlay');
    if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
  }

  function switchTab(name) {
    $.all('.tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    var idMap = { preview: 'tabPreview', pipeline: 'tabPipeline', analysis: 'tabAnalysis', chat: 'tabChat', history: 'tabHistory' };
    $.all('.tab-pane').forEach(function (p) { p.classList.toggle('active', p.id === idMap[name]); });
    if (name === 'history') _loadHistoryTab();
    if (name === 'chat')    _focusChatInput();
  }

  // ── AI Settings modal ─────────────────────────────────────────────────
  function _initAISettings() {
    var btn     = document.getElementById('aiSettingsBtn');
    var overlay = document.getElementById('aiModalOverlay');
    var form    = document.getElementById('aiSettingsForm');
    var clearBtn= document.getElementById('clearLLMBtn');
    if (!overlay) return;

    if (btn)    btn.addEventListener('click', function () { openAIModal(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeAIModal(); });

    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (PE.LLM) PE.LLM.clearConfig();
      _updateLLMBadge();
      _populateAIForm();
      _refreshAIDynamic();
      var s = document.getElementById('aiSaveStatus');
      if (s) { s.textContent = 'Configuration cleared.'; s.style.color = '#fbbf24'; }
    });

    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!PE.LLM) return;
      var provider = document.getElementById('llmProvider').value;
      var apiKey   = (document.getElementById('llmApiKey') || {}).value || '';
      var model    = (document.getElementById('llmModel') || {}).value || '';
      var baseUrl  = (document.getElementById('llmBaseUrl') || {}).value || '';
      var sessionOnly  = !!(document.getElementById('llmSessionOnly') || {}).checked;
      var allowRemote  = !!(document.getElementById('llmOllamaAllowRemote') || {}).checked;
      var useVision    = !!(document.getElementById('llmUseVision') || {}).checked;
      var maxPages     = parseInt((document.getElementById('llmMaxVisionPages') || {}).value || '0', 10) || PE.LLM.DEFAULT_MAX_VISION_PAGES;

      var defaults = PE.LLM.DEFAULTS[provider] || {};
      var v = PE.LLM.validateBaseUrl(provider, baseUrl || defaults.baseUrl, { ollamaAllowRemote: allowRemote });
      if (!v.ok) {
        var u = document.getElementById('llmUrlWarn');
        if (u) u.textContent = v.reason;
        return;
      }
      PE.LLM.setConfig({
        provider: provider,
        apiKey:   apiKey,
        model:    model || defaults.model,
        baseUrl:  v.url,
        sessionOnly:       sessionOnly,
        ollamaAllowRemote: allowRemote,
        useVision:         useVision,
        maxVisionPages:    Math.max(1, Math.min(maxPages, PE.LLM.HARD_MAX_VISION_PAGES))
      });
      _updateLLMBadge();
      _refreshAIDynamic();
      var status = document.getElementById('aiSaveStatus');
      if (status) {
        status.textContent = '✓ Saved (key stored only in your ' + (sessionOnly ? 'session' : 'browser') + ')';
        status.style.color = '#34d399';
      }
      setTimeout(closeAIModal, 1200);
    });

    // Provider change → prefill defaults & refresh dynamic UI
    var providerSel = document.getElementById('llmProvider');
    if (providerSel) providerSel.addEventListener('change', function () {
      if (!PE.LLM) return;
      var def = PE.LLM.DEFAULTS[providerSel.value] || {};
      var modelInput = document.getElementById('llmModel');
      var urlInput   = document.getElementById('llmBaseUrl');
      if (modelInput && def.model)   modelInput.placeholder = def.model;
      if (urlInput   && def.baseUrl) urlInput.value = def.baseUrl;
      _refreshAIDynamic();
    });

    // Live updates as the user edits.
    ['llmModel', 'llmApiKey', 'llmBaseUrl', 'llmOllamaAllowRemote'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input',  _refreshAIDynamic);
      if (el) el.addEventListener('change', _refreshAIDynamic);
    });

    // Show/hide the API key.
    var keyToggle = document.getElementById('llmKeyToggle');
    if (keyToggle) keyToggle.addEventListener('click', function () {
      var inp = document.getElementById('llmApiKey');
      if (!inp) return;
      var pressed = keyToggle.getAttribute('aria-pressed') === 'true';
      inp.type = pressed ? 'password' : 'text';
      keyToggle.setAttribute('aria-pressed', pressed ? 'false' : 'true');
      var ico = keyToggle.querySelector('i');
      if (ico) ico.className = pressed ? 'fas fa-eye text-xs' : 'fas fa-eye-slash text-xs';
    });

    // Test connection.
    var testBtn = document.getElementById('llmTestBtn');
    if (testBtn) testBtn.addEventListener('click', async function () {
      var status = document.getElementById('llmTestStatus');
      if (!status || !PE.LLM) return;
      status.textContent = 'Pinging…';
      status.style.color = '#94a3b8';
      try {
        // Ensure latest form state is saved before testing.
        var provider = document.getElementById('llmProvider').value;
        var apiKey   = (document.getElementById('llmApiKey') || {}).value || '';
        var model    = (document.getElementById('llmModel') || {}).value || '';
        var baseUrl  = (document.getElementById('llmBaseUrl') || {}).value || '';
        var defaults = PE.LLM.DEFAULTS[provider] || {};
        var v = PE.LLM.validateBaseUrl(provider, baseUrl || defaults.baseUrl, { ollamaAllowRemote: !!(document.getElementById('llmOllamaAllowRemote') || {}).checked });
        if (!v.ok) throw new Error(v.reason);
        var prev = PE.LLM.getConfig();
        PE.LLM.setConfig({ provider: provider, apiKey: apiKey, model: model || defaults.model, baseUrl: v.url, sessionOnly: !!(document.getElementById('llmSessionOnly') || {}).checked });
        var r = await PE.LLM.ping();
        status.textContent = '✓ Reachable (' + r.ms + 'ms)';
        status.style.color = '#34d399';
        // Restore the user's previous saved state if they hadn't pressed Save.
        if (prev) PE.LLM.setConfig(prev);
      } catch (e) {
        status.textContent = '✗ ' + (e.message || 'Failed');
        status.style.color = '#f87171';
      }
    });

    // Revoke vision consent.
    var revokeBtn = document.getElementById('llmRevokeConsentBtn');
    if (revokeBtn) revokeBtn.addEventListener('click', function () {
      if (PE.LLM) PE.LLM.setVisionConsent(false);
      _refreshAIDynamic();
      var s = document.getElementById('aiSaveStatus');
      if (s) { s.textContent = 'Vision consent revoked.'; s.style.color = '#fbbf24'; }
    });

    // Vision consent modal wiring.
    var vcOverlay = document.getElementById('visionConsentOverlay');
    if (vcOverlay) {
      vcOverlay.addEventListener('click', function (e) { if (e.target === vcOverlay) _closeVisionConsent(false); });
    }
    var declineBtn = document.getElementById('visionConsentDecline');
    if (declineBtn) declineBtn.addEventListener('click', function () { _closeVisionConsent(false); });
    var acceptBtn  = document.getElementById('visionConsentAccept');
    if (acceptBtn)  acceptBtn.addEventListener('click', function () {
      if (PE.LLM) PE.LLM.setVisionConsent(true);
      _closeVisionConsent(true);
    });

    // Pre-fill from saved config
    _populateAIForm();
    _refreshAIDynamic();
  }

  function _populateAIForm() {
    if (!PE.LLM) return;
    var cfg = PE.LLM.getConfig() || {};
    var p = document.getElementById('llmProvider');
    var k = document.getElementById('llmApiKey');
    var m = document.getElementById('llmModel');
    var u = document.getElementById('llmBaseUrl');
    var so = document.getElementById('llmSessionOnly');
    var ar = document.getElementById('llmOllamaAllowRemote');
    var uv = document.getElementById('llmUseVision');
    var mp = document.getElementById('llmMaxVisionPages');
    if (p)  p.value  = cfg.provider || 'openai';
    if (k)  k.value  = cfg.apiKey   || '';
    if (m)  m.value  = cfg.model    || '';
    if (u)  u.value  = cfg.baseUrl  || '';
    if (so) so.checked = !!cfg.sessionOnly;
    if (ar) ar.checked = !!cfg.ollamaAllowRemote;
    if (uv) uv.checked = !!cfg.useVision;
    if (mp) mp.value   = cfg.maxVisionPages || PE.LLM.DEFAULT_MAX_VISION_PAGES;
  }

  // Re-render capability badge, URL warning, key shape warning, endpoint
  // preview, and ollama-remote row whenever the form changes.
  function _refreshAIDynamic() {
    if (!PE.LLM) return;
    var provider = (document.getElementById('llmProvider') || {}).value || 'openai';
    var apiKey   = (document.getElementById('llmApiKey') || {}).value || '';
    var model    = (document.getElementById('llmModel') || {}).value || '';
    var baseUrl  = (document.getElementById('llmBaseUrl') || {}).value || '';
    var allowRemote = !!(document.getElementById('llmOllamaAllowRemote') || {}).checked;
    var defaults = PE.LLM.DEFAULTS[provider] || {};

    // Show "allow remote" only for ollama.
    var row = document.getElementById('ollamaRemoteRow');
    if (row) row.style.display = provider === 'ollama' ? '' : 'none';

    // Capability badge (vision / text / unknown).
    var capEl = document.getElementById('llmCapability');
    if (capEl) {
      var cap = PE.LLM.visionCapability({ provider: provider, model: model || defaults.model });
      if (cap === 'vision') {
        capEl.innerHTML = '<i class="fas fa-circle-check mr-1" aria-hidden="true"></i>Vision-capable';
        capEl.style.color = '#34d399';
      } else if (cap === 'unknown') {
        capEl.innerHTML = '<i class="fas fa-circle-question mr-1" aria-hidden="true"></i>Capability unknown for this deployment — vision may or may not work';
        capEl.style.color = '#fbbf24';
      } else {
        capEl.innerHTML = '<i class="fas fa-circle-exclamation mr-1" aria-hidden="true"></i>Text-only model — vision pass will be skipped';
        capEl.style.color = '#fbbf24';
      }
    }

    // Key shape warning.
    var w = document.getElementById('llmKeyWarn');
    if (w) {
      var ksw = PE.LLM.keyShapeWarning(provider, apiKey);
      w.textContent = ksw || '';
    }

    // URL validation.
    var uw = document.getElementById('llmUrlWarn');
    if (uw) {
      if (!baseUrl && (provider === 'openai' || provider === 'anthropic')) {
        uw.textContent = '';
      } else {
        var v = PE.LLM.validateBaseUrl(provider, baseUrl || defaults.baseUrl, { ollamaAllowRemote: allowRemote });
        uw.textContent = v.ok ? '' : v.reason;
      }
    }

    // Endpoint preview.
    var ep = document.getElementById('aiEndpointPreview');
    if (ep) {
      var eps = PE.LLM.describeEndpoints({ provider: provider, baseUrl: baseUrl || defaults.baseUrl, model: model || defaults.model });
      ep.textContent = eps.length ? 'Outbound: ' + eps.join(', ') : '';
    }
  }

  // Vision consent helpers.
  // Returns a Promise<boolean> resolving to true if the user accepted.
  function _requestVisionConsent(provider, maxPages) {
    return new Promise(function (resolve) {
      var overlay = document.getElementById('visionConsentOverlay');
      if (!overlay) { resolve(false); return; }
      var p = document.getElementById('vcProvider');
      var n = document.getElementById('vcPageCount');
      if (p) p.textContent = provider || 'your provider';
      if (n) n.textContent = String(maxPages || (PE.LLM ? PE.LLM.DEFAULT_MAX_VISION_PAGES : 6));
      _visionConsentResolver = resolve;
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }
  var _visionConsentResolver = null;
  function _closeVisionConsent(accepted) {
    var overlay = document.getElementById('visionConsentOverlay');
    if (overlay) { overlay.classList.remove('active'); document.body.style.overflow = ''; }
    if (_visionConsentResolver) { _visionConsentResolver(!!accepted); _visionConsentResolver = null; }
  }

  function openAIModal() {
    _populateAIForm();
    var el = document.getElementById('aiModalOverlay');
    if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden'; }
  }

  function closeAIModal() {
    var el = document.getElementById('aiModalOverlay');
    if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
  }

  // ── Chat panel ────────────────────────────────────────────────────────
  function _initChat() {
    var form = document.getElementById('chatForm');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var input = document.getElementById('chatInput');
      var q = (input ? input.value.trim() : '');
      if (!q) return;
      if (input) input.value = '';
      await _sendChat(q);
    });
  }

  function _focusChatInput() {
    setTimeout(function () {
      var input = document.getElementById('chatInput');
      if (input) input.focus();
    }, 100);
  }

  async function _sendChat(question) {
    var messages = document.getElementById('chatMessages');
    if (!messages) return;

    _appendChatMsg('user', question, messages);

    if (!PE.LLM || !PE.LLM.isConfigured()) {
      _appendChatMsg('assistant', '**AI not configured.** Click the AI Settings button in the navigation bar to add your API key (OpenAI, Anthropic, Azure, or local Ollama). Your key is stored only in your browser.', messages);
      return;
    }

    if (!_currentResult) {
      _appendChatMsg('assistant', 'Please run a plan analysis first (upload a file and click "Analyze Plan"), then ask me questions about the results.', messages);
      return;
    }

    var thinkingId = 'msg-' + Date.now();
    _appendChatMsg('assistant', '…', messages, thinkingId);
    _scrollChat(messages);

    if (_chatAbort) _chatAbort.abort();
    _chatAbort = new AbortController();

    try {
      var reply = await PE.LLM.chat(question, _chatContext, _chatHistory, _chatAbort.signal);
      // Replace thinking bubble
      var thinkEl = document.getElementById(thinkingId);
      if (thinkEl) thinkEl.querySelector('.chat-content').textContent = reply;
      _chatHistory.push({ role: 'user', content: question });
      _chatHistory.push({ role: 'assistant', content: reply });
      if (_chatHistory.length > 20) _chatHistory = _chatHistory.slice(-20);
    } catch (err) {
      var thinkEl2 = document.getElementById(thinkingId);
      if (thinkEl2) thinkEl2.querySelector('.chat-content').textContent = 'Error: ' + err.message;
    }
    _scrollChat(messages);
  }

  function _appendChatMsg(role, text, container, id) {
    var wrap = document.createElement('div');
    wrap.className = 'chat-msg ' + role;
    if (id) wrap.id = id;
    wrap.style.cssText = 'margin-bottom:12px;' + (role === 'user' ? 'text-align:right;' : '');
    var bubble = document.createElement('div');
    bubble.className = 'chat-content';
    bubble.style.cssText = 'display:inline-block;max-width:85%;padding:10px 14px;border-radius:12px;font-size:.8rem;line-height:1.55;' +
      (role === 'user' ? 'background:rgba(56,189,248,.15);border:1px solid rgba(56,189,248,.25);color:#e2e8f0;' : 'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#94a3b8;text-align:left;');
    bubble.textContent = text;
    wrap.appendChild(bubble);
    container.appendChild(wrap);
    _scrollChat(container);
  }

  function _scrollChat(container) {
    setTimeout(function () { if (container) container.scrollTop = container.scrollHeight; }, 50);
  }

  // ── History tab ───────────────────────────────────────────────────────
  function _initHistoryTab() {}

  function _loadHistoryTab() {
    var container = document.getElementById('historyList');
    if (!container || !PE.History) return;
    PE.History.list().then(function (items) {
      if (!items.length) {
        container.innerHTML = '<p style="text-align:center;color:#475569;padding:32px;">No review history yet. Run a plan analysis to start building your history.</p>';
        return;
      }
      container.innerHTML = items.map(function (item) {
        var d = new Date(item.timestamp).toLocaleString();
        var info = item.projectInfo || {};
        var s = item.score || 0;
        var scoreColor = s >= 85 ? '#34d399' : s >= 65 ? '#fbbf24' : '#f87171';
        var fs = item.findingsSummary || {};
        return '<div style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
          '<div style="flex:1;">' +
          '<div style="font-size:.85rem;font-weight:600;color:#e2e8f0;">' + _esc(info.fileName || 'Unknown file') + '</div>' +
          '<div style="font-size:.75rem;color:#64748b;">' + _esc(info.buildingType || '') + ' · ' + _esc((info.city || '') + ', ' + (info.state || '')) + ' · ' + d + '</div>' +
          '<div style="font-size:.7rem;color:#64748b;margin-top:2px;">' + (fs.flagged || 0) + ' flagged · ' + (fs.review || 0) + ' review · ' + (fs.passed || 0) + ' pass</div>' +
          '</div>' +
          '<div style="font-size:1.4rem;font-weight:700;color:' + scoreColor + ';flex-shrink:0;">' + s + '%</div>' +
          '</div>';
      }).join('');
    }).catch(function () {
      container.innerHTML = '<p style="text-align:center;color:#475569;padding:32px;">History unavailable (IndexedDB not supported).</p>';
    });
  }

  // ── Pricing calculator ────────────────────────────────────────────────
  function _initPricingCalc() {
    var calcBtn = document.querySelector('[onclick="calculatePrice()"]');
    if (calcBtn) { calcBtn.removeAttribute('onclick'); calcBtn.addEventListener('click', calculatePrice); }
    ['numPlans','propValue','projectSize'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function () {
        if (!document.getElementById('calcResult').classList.contains('hidden')) calculatePrice();
      });
    });
  }

  function calculatePrice() {
    var numPlans    = parseInt((document.getElementById('numPlans') || {}).value) || 1;
    var propValue   = parseFloat((document.getElementById('propValue') || {}).value) || 0;
    var projectSize = parseFloat((document.getElementById('projectSize') || {}).value) || 0;
    var baseCost    = 30;
    var surcharge   = (propValue / 100000) * 15;
    var extra       = projectSize > 2000 ? 15 : 0;
    var perPlan     = baseCost + surcharge + extra;
    var total       = perPlan * numPlans;
    var amountEl    = document.getElementById('calcAmount');
    var breakdownEl = document.getElementById('calcBreakdown');
    var resultEl    = document.getElementById('calcResult');
    if (amountEl)    amountEl.textContent = '$' + total.toFixed(2);
    if (breakdownEl) breakdownEl.textContent = '$' + perPlan.toFixed(2) + ' per plan × ' + numPlans + ' plan' + (numPlans !== 1 ? 's' : '') + (surcharge > 0 ? ' · +$' + surcharge.toFixed(2) + ' property surcharge' : '') + (extra > 0 ? ' · +$' + extra.toFixed(2) + ' large-project fee' : '');
    if (resultEl)    resultEl.classList.remove('hidden');
    ['tierStarter','tierPro','tierElite'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.classList.remove('ring-highlight');
    });
    var tierId = numPlans <= 3 ? 'tierStarter' : numPlans <= 6 ? 'tierPro' : 'tierElite';
    var tier = document.getElementById(tierId); if (tier) tier.classList.add('ring-highlight');
  }

  // ── Subscribe form ────────────────────────────────────────────────────
  function _initSubscribeForm() {
    var form = document.getElementById('subscribeForm');
    if (!form) return;

    // Tier radio sync
    $.all('input[name="subTier"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        $.all('input[name="subTier"]').forEach(function (r) {
          var box = r.nextElementSibling;
          if (!box) return;
          var sub = box.querySelector('div:last-child');
          if (r.checked) { box.style.borderColor='rgba(56,189,248,.45)'; box.style.background='rgba(56,189,248,.07)'; box.style.color='#38bdf8'; if (sub) sub.style.color='#7dd3fc'; }
          else           { box.style.borderColor='rgba(255,255,255,.1)';  box.style.background='rgba(255,255,255,.025)'; box.style.color='#64748b'; if (sub) sub.style.color='#64748b'; }
        });
      });
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var errBox = document.getElementById('subscribeError');
      var errMsg = document.getElementById('subscribeErrorMsg');
      if (errBox) errBox.classList.add('hidden');
      var name  = (document.getElementById('subscriberName') || {}).value || '';
      var email = (document.getElementById('subscriberEmail') || {}).value || '';
      var tier  = ((document.querySelector('input[name="subTier"]:checked') || {}).value) || 'Pro';
      if (!name.trim() || !email.trim()) {
        if (errMsg) errMsg.textContent = 'Please enter your name and email address.';
        if (errBox) errBox.classList.remove('hidden'); return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errMsg) errMsg.textContent = 'Please enter a valid email address.';
        if (errBox) errBox.classList.remove('hidden'); return;
      }
      await new Promise(function (r) { setTimeout(r, 800); });
      var resultEl = document.getElementById('subscribeResult');
      if (resultEl) resultEl.innerHTML = '<div style="background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.2);border-radius:16px;padding:20px;display:flex;align-items:flex-start;gap:16px;margin-top:8px;">' +
        '<div style="width:40px;height:40px;border-radius:12px;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.2);display:flex;align-items:center;justify-content:center;color:#34d399;flex-shrink:0;"><i class="fas fa-check"></i></div>' +
        '<div><p style="font-weight:700;color:#fff;margin-bottom:4px;">Inquiry Received!</p>' +
        '<p style="font-size:.875rem;color:#94a3b8;">Thank you, <strong style="color:#fff;">' + _esc(name) + '</strong>. Your <strong style="color:#38bdf8;">' + _esc(tier) + '</strong> inquiry has been received. We\'ll be in touch at <strong style="color:#fff;">' + _esc(email) + '</strong>.</p></div></div>';
      form.reset();
    });
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  function _initKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openCommandPalette(); return; }
      if (e.key === '?') { showShortcutsHelp(); return; }
      if (e.key === 'u' || e.key === 'U') { document.getElementById('upload') && document.getElementById('upload').scrollIntoView({ behavior: 'smooth' }); }
      if (e.key === 'r' || e.key === 'R') { if (_currentResult) { openModal(); switchTab('analysis'); } }
      if (e.key === 'e' || e.key === 'E') { exportReport(); }
      if (e.key === 'Escape') { closeModal(); closeAIModal(); closeCommandPalette(); closePartnerGate(); }
    });
  }

  function showShortcutsHelp() {
    var overlay = document.getElementById('shortcutsOverlay');
    if (overlay) overlay.classList.toggle('active');
  }

  // ── Command palette ───────────────────────────────────────────────────
  var _paletteOpen = false;

  function _initCommandPalette() {
    var overlay  = document.getElementById('paletteOverlay');
    var input    = document.getElementById('paletteInput');
    var list     = document.getElementById('paletteList');
    if (!overlay) return;

    var commands = [
      { label: 'Upload Plan',          icon: 'fa-upload',         action: function () { document.getElementById('upload').scrollIntoView({ behavior:'smooth' }); } },
      { label: 'View Analysis',        icon: 'fa-chart-bar',      action: function () { if (_currentResult) { openModal(); switchTab('analysis'); } } },
      { label: 'Print Report',         icon: 'fa-print',          action: exportReport },
      { label: 'Download Letter',      icon: 'fa-file-arrow-down',action: exportLetter },
      { label: 'Export JSON',          icon: 'fa-code',           action: exportJson },
      { label: 'AI Settings',          icon: 'fa-key',            action: openAIModal },
      { label: 'View History',         icon: 'fa-clock-rotate-left', action: function () { openModal(); switchTab('history'); } },
      { label: 'About',                icon: 'fa-circle-info',    action: function () { document.getElementById('about').scrollIntoView({ behavior:'smooth' }); } },
      { label: 'Submission Guidelines',icon: 'fa-book-open',      action: function () { document.getElementById('guidelines').scrollIntoView({ behavior:'smooth' }); } },
      { label: 'Pricing',              icon: 'fa-calculator',     action: function () { document.getElementById('pricing').scrollIntoView({ behavior:'smooth' }); } },
      { label: 'Subscribe',            icon: 'fa-paper-plane',    action: function () { document.getElementById('subscribe').scrollIntoView({ behavior:'smooth' }); } },
      { label: 'Become a Partner',     icon: 'fa-handshake',      action: openPartnerGate },
      { label: 'Donate (Cash.App)',    icon: 'fa-heart',          action: function () { window.open('https://Cash.App/$dascient/', '_blank', 'noopener,noreferrer'); } },
      { label: 'Contact',              icon: 'fa-envelope',       action: function () { document.getElementById('contact').scrollIntoView({ behavior:'smooth' }); } }
    ];

    function render(filtered) {
      list.innerHTML = filtered.map(function (cmd, i) {
        return '<div class="palette-item" tabindex="0" style="padding:10px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;border-radius:8px;' +
          (i === 0 ? 'background:rgba(56,189,248,.1);' : '') + '">' +
          '<i class="fas ' + cmd.icon + '" style="color:#38bdf8;width:14px;font-size:.85rem;flex-shrink:0;"></i>' +
          '<span style="font-size:.9rem;color:#e2e8f0;">' + _esc(cmd.label) + '</span>' +
          '</div>';
      }).join('');
      $.all('.palette-item', list).forEach(function (item, i) {
        item.addEventListener('click', function () { filtered[i].action(); closeCommandPalette(); });
        item.addEventListener('keydown', function (e) { if (e.key === 'Enter') { filtered[i].action(); closeCommandPalette(); } });
      });
    }

    if (input) input.addEventListener('input', function () {
      var q = input.value.toLowerCase();
      render(commands.filter(function (c) { return c.label.toLowerCase().includes(q); }));
    });

    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeCommandPalette(); });
    render(commands);
  }

  function openCommandPalette() {
    var overlay = document.getElementById('paletteOverlay');
    var input   = document.getElementById('paletteInput');
    if (!overlay) return;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    _paletteOpen = true;
    if (input) { input.value = ''; input.focus(); }
    var list = document.getElementById('paletteList');
    if (list) { var items = $.all('.palette-item', list); if (items.length) items[0].style.background = 'rgba(56,189,248,.1)'; }
  }

  function closeCommandPalette() {
    var overlay = document.getElementById('paletteOverlay');
    if (overlay) { overlay.classList.remove('active'); document.body.style.overflow = ''; }
    _paletteOpen = false;
  }

  // ── Partner gate modal ────────────────────────────────────────────────
  function _initPartnerGate() {
    var overlay = document.getElementById('partnerGateOverlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closePartnerGate(); });
    }
    var keyInput = document.getElementById('partnerGateKey');
    if (keyInput) {
      keyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); activatePartnerKey(); }
      });
    }
    var emailInput = document.getElementById('partnerGateEmail');
    if (emailInput) {
      emailInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); unlockByEmail(); }
      });
    }
    // Subscribe section: partner-key reveal toggle
    var toggle = document.getElementById('partnerKeyToggle');
    var row    = document.getElementById('partnerKeyRow');
    var input  = document.getElementById('partnerKeyInput');
    if (toggle && row) {
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        row.classList.toggle('hidden');
        if (!row.classList.contains('hidden') && input) input.focus();
      });
    }
    if (input) {
      input.addEventListener('change', function () {
        var v = (input.value || '').trim();
        if (!v) return;
        // Route through the verified gate flow — never store an unverified
        // key. We populate the gate's input and reuse activatePartnerKey()
        // so the value is checked against the hashed allowlist.
        var gateInput = document.getElementById('partnerGateKey');
        if (gateInput) gateInput.value = v;
        openPartnerGate();
        activatePartnerKey();
      });
    }
  }

  function openPartnerGate() {
    var overlay = document.getElementById('partnerGateOverlay');
    if (!overlay) return;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    var status = document.getElementById('partnerGateStatus');
    if (status) status.textContent = '';
    var emailStatus = document.getElementById('partnerGateEmailStatus');
    if (emailStatus) emailStatus.textContent = '';
    var input = document.getElementById('partnerGateKey');
    if (input) input.value = '';
    var emailInput = document.getElementById('partnerGateEmail');
    if (emailInput) emailInput.value = '';
  }

  function closePartnerGate() {
    var overlay = document.getElementById('partnerGateOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function activatePartnerKey() {
    var input  = document.getElementById('partnerGateKey');
    var status = document.getElementById('partnerGateStatus');
    var key    = ((input && input.value) || '').trim().toLowerCase();
    function setStatus(msg, color) {
      if (!status) return;
      status.textContent = msg;
      status.style.color = color || '#64748b';
    }
    if (!key) {
      setStatus('Enter the partner key provided by Plan-Examiner.', '#f87171');
      return;
    }
    // A partner key is the SHA-256 hash of the donor's normalized email
    // (i.e., one of the entries published in assets/data/partners.json).
    // Reject anything that isn't a 64-char hex string, and verify the
    // value is actually on the allowlist before unlocking.
    if (!/^[a-f0-9]{64}$/.test(key)) {
      setStatus('That doesn\u2019t look like a valid partner key. Use the verified email unlock above, or paste the SHA-256 hash on your allowlist row.', '#f87171');
      return;
    }
    setStatus('Verifying key\u2026', '#64748b');
    _loadPartners().then(function (list) {
      if (list.indexOf(key) !== -1) {
        _setPartner('key:' + key);
        setStatus('Partner access activated. Thank you!', '#34d399');
        setTimeout(closePartnerGate, 900);
      } else {
        setStatus('We don\u2019t see that key on the allowlist yet. Please use the verified email unlock above, or contact plan-examiner@dascient.com.', '#fbbf24');
      }
    }).catch(function () {
      setStatus('Unable to verify right now. Please try again or contact plan-examiner@dascient.com.', '#f87171');
    });
  }

  // Unlock partner access by checking the donor's email against the
  // public hashed allowlist (assets/data/partners.json). The plaintext
  // email is hashed locally and never transmitted.
  async function unlockByEmail() {
    var input  = document.getElementById('partnerGateEmail');
    var status = document.getElementById('partnerGateEmailStatus');
    var email  = ((input && input.value) || '').trim();
    function setStatus(msg, color) {
      if (!status) return;
      status.textContent = msg;
      status.style.color = color || '#64748b';
    }
    if (!email) { setStatus('Enter the email you used in the Cash.App note.', '#f87171'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('Please enter a valid email address.', '#f87171'); return;
    }
    setStatus('Checking allowlist…', '#64748b');
    try {
      var hash = await _hashEmail(email);
      if (!hash) { setStatus('This browser does not support secure hashing. Please contact plan-examiner@dascient.com.', '#f87171'); return; }
      var list = await _loadPartners();
      if (list.indexOf(hash) !== -1) {
        _setPartner('email:' + hash);
        setStatus('Welcome, partner! Full access unlocked.', '#34d399');
        setTimeout(closePartnerGate, 1200);
      } else {
        setStatus('We don\u2019t see that email on the allowlist yet. Each donation is reviewed and added manually by the site owner once the Cash.App payment is received \u2014 please allow a little time, then try again. If it has been a while, contact plan-examiner@dascient.com.', '#fbbf24');
      }
    } catch (e) {
      setStatus('Unable to verify right now. Please try again or contact plan-examiner@dascient.com.', '#f87171');
    }
  }

  // ── Verbose / diagnostic log panel ────────────────────────────────────
  function _initVerboseLogPanel() {
    if (!PE.Log) return;
    var panel    = document.getElementById('verboseLogPanel');
    var toggle   = document.getElementById('verboseLogToggle');
    var statusEl = document.getElementById('verboseLogStatus');
    var bodyEl   = document.getElementById('verboseLogBody');
    var copyBtn  = document.getElementById('verboseLogCopy');
    var dlBtn    = document.getElementById('verboseLogDownload');
    var clearBtn = document.getElementById('verboseLogClear');

    function refreshStatus() {
      var on = PE.Log.isEnabled();
      if (toggle)   toggle.checked = on;
      if (statusEl) {
        statusEl.textContent = on ? 'enabled' : 'disabled';
        statusEl.style.color = on ? '#34d399' : '#64748b';
      }
    }
    function renderEntry(e) {
      if (!bodyEl) return;
      var color = e.level === 'error' ? '#fca5a5'
                : e.level === 'warn'  ? '#fde68a'
                : e.level === 'info'  ? '#bae6fd'
                : e.level === 'debug' ? '#94a3b8'
                : '#64748b';
      var line = document.createElement('div');
      line.style.cssText = 'color:' + color + ';white-space:pre-wrap;word-break:break-word;border-bottom:1px solid rgba(255,255,255,.03);padding:2px 0;';
      var head = '+' + e.elapsedMs + 'ms ' + e.level.toUpperCase() + ' [' + e.stage + '] ' + e.msg;
      line.textContent = head + (e.data ? '  ' + _safeStringify(e.data) : '');
      bodyEl.appendChild(line);
      // Cap displayed lines to avoid runaway DOM growth.
      while (bodyEl.childNodes.length > 500) bodyEl.removeChild(bodyEl.firstChild);
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }
    function rerenderAll() {
      if (!bodyEl) return;
      bodyEl.innerHTML = '';
      PE.Log.entries().forEach(renderEntry);
    }

    if (toggle) toggle.addEventListener('change', function () {
      PE.Log.setEnabled(toggle.checked);
      refreshStatus();
      rerenderAll();
    });
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var txt = PE.Log.formatText();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(function () {
          copyBtn.innerHTML = '<i class="fas fa-check text-xs mr-1"></i>Copied!';
          setTimeout(function () { copyBtn.innerHTML = '<i class="fas fa-copy text-xs mr-1"></i>Copy'; }, 1500);
        });
      }
    });
    if (dlBtn) dlBtn.addEventListener('click', function () {
      var blob = new Blob([PE.Log.formatText()], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'plan-examiner-' + Date.now() + '.log';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 200);
    });
    if (clearBtn) clearBtn.addEventListener('click', function () {
      PE.Log.clear();
      if (bodyEl) bodyEl.innerHTML = '';
    });

    refreshStatus();
    rerenderAll();
    PE.Log.subscribe(renderEntry);

    // Auto-open the panel when verbose was activated via URL flag, so the
    // user sees the live stream without an extra click.
    if (panel && PE.Log.isEnabled()) panel.open = true;
  }

  function _renderFileMetaInVerbosePanel(meta) {
    var el = document.getElementById('verboseLogFileMeta');
    if (!el || !meta) return;
    el.style.display = 'block';
    el.innerHTML =
      '<div><strong style="color:#7dd3fc;">File:</strong> ' + _esc(meta.fileName) + '</div>' +
      '<div><strong style="color:#7dd3fc;">Size:</strong> ' + (meta.sizeBytes != null ? meta.sizeBytes.toLocaleString() + ' bytes' : 'n/a') + '</div>' +
      '<div><strong style="color:#7dd3fc;">MIME:</strong> ' + _esc(meta.mimeType || 'unknown') + '</div>' +
      '<div><strong style="color:#7dd3fc;">Modified:</strong> ' + _esc(meta.lastModified || 'n/a') + '</div>' +
      '<div style="word-break:break-all;"><strong style="color:#7dd3fc;">SHA-256:</strong> ' + _esc(meta.sha256 || 'n/a') + '</div>';
  }

  function _safeStringify(v) {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  // ── Service Worker ────────────────────────────────────────────────────
  function _registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────
  function _esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ── Copy enc key ──────────────────────────────────────────────────────
  function copyEncKey() {
    var key = (document.getElementById('encryptionKey') || {}).value || '';
    navigator.clipboard && navigator.clipboard.writeText(key).then(function () {
      var btn = document.getElementById('copyKeyBtn');
      if (btn) { btn.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!'; setTimeout(function () { btn.innerHTML = '<i class="fas fa-copy mr-1"></i>Copy'; }, 2000); }
    });
  }

  // ── Public API ────────────────────────────────────────────────────────
  return {
    init:             init,
    openModal:        openModal,
    closeModal:       closeModal,
    switchTab:        switchTab,
    openAIModal:      openAIModal,
    closeAIModal:     closeAIModal,
    calculatePrice:   calculatePrice,
    filterFindings:   filterFindings,
    exportReport:     exportReport,
    exportLetter:     exportLetter,
    exportJson:       exportJson,
    copyEncKey:       copyEncKey,
    openCommandPalette: openCommandPalette,
    closeCommandPalette: closeCommandPalette,
    showShortcutsHelp:  showShortcutsHelp,
    openPartnerGate:    openPartnerGate,
    closePartnerGate:   closePartnerGate,
    activatePartnerKey: activatePartnerKey,
    unlockByEmail:      unlockByEmail
  };

}());

window.PE = PE;

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { PE.App.init(); });
} else {
  PE.App.init();
}
