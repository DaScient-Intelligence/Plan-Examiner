/**
 * Plan-Examiner Document Extractors
 * Parses uploaded DOCX, PDF, DXF, and DWG files to extract
 * structured "facts" used by the rule engine.
 *
 * All parsing happens client-side — no data leaves the browser.
 *
 * Verbose logging: when PE.Log is enabled, every stage emits structured
 * entries (file metadata, per-branch timing, per-regex hits, sample text,
 * OCR progress, warnings). Use ?verbose=1 to turn it on globally.
 */

var PE = window.PE || {};

PE.Extractors = (function () {
  'use strict';

  // ── Logger shim (no-op when PE.Log is unavailable) ──────────────────
  function _L() { return (PE && PE.Log) ? PE.Log : null; }
  function _log(level, msg, data) { var L = _L(); if (L) L[level]('extract', msg, data); }

  // ── File hash helper (SHA-256 hex) ──────────────────────────────────
  async function _hash(buf) {
    try {
      if (!(window.crypto && window.crypto.subtle)) return null;
      var d = await window.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(d)).map(function (b) {
        return ('00' + b.toString(16)).slice(-2);
      }).join('');
    } catch (e) { return null; }
  }

  // ── Regex helpers ────────────────────────────────────────────────────────

  // Each entry: { key, factName, regex, parser, group? }
  // Centralizing the catalog (instead of hard-coding in parse()) lets us
  // emit a per-hit verbose log with the matched snippet for traceability.
  var RULES = [
    { key: 'area',           factName: 'grossArea',                regex: /(?:gross\s*(?:floor)?\s*area|total\s*area|floor\s*area)[:\s=]+([0-9,]+(?:\.[0-9]+)?)\s*(?:sq\.?\s*ft|sf|sqft)/i, parse: function (m) { return parseFloat(m[1].replace(/,/g, '')); } },
    { key: 'occupantLoad',   factName: 'occupantLoad',             regex: /(?:occupant\s*load|occupancy\s*load|calculated\s*load)[:\s=]+([0-9,]+)/i,                                       parse: function (m) { return parseInt(m[1].replace(/,/g, ''), 10); } },
    { key: 'stories',        factName: 'stories',                  regex: /(?:number\s*of\s*(?:stories|floors?)|stories|floors?)[:\s=]+([0-9]+)/i,                                          parse: function (m) { return parseInt(m[1], 10); } },
    { key: 'buildingHeight', factName: 'buildingHeightFt',         regex: /(?:building\s*height|height\s*above\s*grade)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:ft|feet|')/i,                     parse: function (m) { return parseFloat(m[1]); } },
    { key: 'corridorWidth',  factName: 'corridorWidthInches',      regex: /(?:corridor\s*width|hallway\s*width|aisle\s*width)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,                parse: function (m) { return parseFloat(m[1]); } },
    { key: 'doorWidth',      factName: 'doorWidthInches',          regex: /(?:door\s*(?:clear\s*)?width|clear\s*door\s*width)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,                parse: function (m) { return parseFloat(m[1]); } },
    { key: 'stairTread',     factName: 'stairTreadDepthIn',        regex: /(?:stair\s*tread|tread\s*depth)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,                                   parse: function (m) { return parseFloat(m[1]); } },
    { key: 'stairRiser',     factName: 'stairRiserHeightIn',       regex: /(?:stair\s*riser|riser\s*height)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,                                  parse: function (m) { return parseFloat(m[1]); } },
    { key: 'stairWidth',     factName: 'stairWidthInches',         regex: /(?:stair\s*width|stairway\s*width)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,                                parse: function (m) { return parseFloat(m[1]); } },
    { key: 'adaTurning',     factName: 'adaTurningRadiusIn',       regex: /(?:ada\s*turning|turning\s*(?:radius|diameter|space))[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,              parse: function (m) { return parseFloat(m[1]); } },
    { key: 'fireSep',        factName: 'fireSeparationDistanceFt', regex: /(?:fire\s*separation\s*distance|separation\s*distance)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:ft|feet|')/i,             parse: function (m) { return parseFloat(m[1]); } },
    { key: 'travelDist',     factName: 'travelDistanceFt',         regex: /(?:travel\s*distance|max\s*travel)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:ft|feet|')/i,                                parse: function (m) { return parseFloat(m[1]); } },
    { key: 'parking',        factName: 'totalParkingSpaces',       regex: /(?:total\s*parking|parking\s*spaces?)[:\s=]+([0-9]+)/i,                                                          parse: function (m) { return parseInt(m[1], 10); } },
    { key: 'accessParking',  factName: 'accessibleParkingSpaces',  regex: /(?:accessible\s*parking|handicap(?:ped)?\s*parking)[:\s=]+([0-9]+)/i,                                            parse: function (m) { return parseInt(m[1], 10); } },
    { key: 'occupancyGroup', factName: 'occupancyGroup',           regex: /(?:occupancy\s*(?:group|class(?:ification)?)|use\s*group)[:\s=]+([A-Z][\w-]*)/i,                                  parse: function (m) { return m[1]; } },
    { key: 'rampSlope',      factName: 'rampSlope',                regex: /(?:ramp\s*slope|running\s*slope)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:%|:1|\/1)/i,                                   parse: function (m) { var s = parseFloat(m[1]); return s > 1 ? s / 100 : s; } }
  ];

  var BOOL_FLAGS = [
    { factName: 'hasSprinklers',        truthy: /(?:fire\s*sprinkler|auto(?:matic)?\s*sprinkler|nfpa\s*13)/i,                falsy: /(?:no\s*(?:fire\s*)?sprinkler|un[-\s]?sprinkler)/i },
    { factName: 'hasFireAlarm',         truthy: /(?:fire\s*alarm|nfpa\s*72|smoke\s*detect)/i,                                  falsy: null },
    { factName: 'hasExitSigns',         truthy: /(?:exit\s*sign|egress\s*sign)/i,                                              falsy: null },
    { factName: 'hasEmergencyLighting', truthy: /(?:emergency\s*(?:egress\s*)?light|battery[- ]?backup\s*light)/i,             falsy: null },
    { factName: 'hasHandrails',         truthy: /(?:handrail|guard\s*rail|grabb?ing\s*bar)/i,                                  falsy: null }
  ];

  function _snippet(text, idx, len, span) {
    span = span || 60;
    var start = Math.max(0, idx - span);
    var end   = Math.min(text.length, idx + len + span);
    var s = text.slice(start, end).replace(/\s+/g, ' ');
    return (start > 0 ? '…' : '') + s + (end < text.length ? '…' : '');
  }

  /**
   * Parse a body of text into the `facts` object. When PE.Log is enabled,
   * every regex hit emits a debug entry with the matched snippet so the
   * reviewer can see *why* each fact was extracted.
   */
  function parse(text) {
    var f = {};
    if (!text) return _finalizeBoolFlags(f, '');

    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      var m = r.regex.exec(text);
      if (!m) continue;
      var value;
      try { value = r.parse(m); } catch (e) { continue; }
      if (value === undefined || (typeof value === 'number' && isNaN(value))) continue;
      f[r.factName] = value;
      _log('debug', 'fact extracted: ' + r.factName + ' = ' + value, {
        rule: r.key,
        factName: r.factName,
        value: value,
        match: m[0],
        snippet: _snippet(text, m.index, m[0].length)
      });
    }

    return _finalizeBoolFlags(f, text);
  }

  function _finalizeBoolFlags(f, text) {
    BOOL_FLAGS.forEach(function (b) {
      var t = b.truthy.test(text);
      var x = b.falsy ? b.falsy.test(text) : false;
      var v = t ? true : (x ? false : null);
      f[b.factName] = v;
      if (v !== null) {
        _log('trace', 'flag detected: ' + b.factName + ' = ' + v, { factName: b.factName, value: v });
      }
    });
    return f;
  }

  // ── DOCX extraction ────────────────────────────────────────────────────
  async function fromDocx(arrayBuffer) {
    if (typeof mammoth === 'undefined') throw new Error('mammoth.js not loaded');
    var g = _L() ? _L().group('extract') : null;
    var result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    var text = result.value || '';
    var out = { text: text, facts: parse(text), source: 'docx' };
    if (g) g.end('DOCX parsed', { chars: text.length });
    return out;
  }

  // ── PDF extraction (pdf.js) ────────────────────────────────────────────
  async function fromPdf(arrayBuffer) {
    if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
    var g = _L() ? _L().group('extract') : null;
    var pdf   = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var pages = await Promise.all(
      Array.from({ length: pdf.numPages }, function (_, i) {
        return pdf.getPage(i + 1).then(function (page) {
          return page.getTextContent().then(function (content) {
            return content.items.map(function (item) { return item.str; }).join(' ');
          });
        });
      })
    );
    var text = pages.join('\n');
    var out  = { text: text, facts: parse(text), source: 'pdf', pageCount: pdf.numPages };

    // Image-only PDF detection (rasterized scans yield ~0 chars). Surface
    // a warning so the user knows automated analysis can't extract facts.
    var avgPerPage = pdf.numPages > 0 ? (text.length / pdf.numPages) : 0;
    if (pdf.numPages > 0 && avgPerPage < 40) {
      out.warning = 'image-only-pdf';
      out.warningMsg = 'PDF appears to be image-only (avg ' + Math.round(avgPerPage) +
        ' chars/page across ' + pdf.numPages + ' pages). Text extraction yielded little content — ' +
        'fact extraction will be limited. Consider running OCR or supplying a text-based PDF.';
      _log('warn', out.warningMsg, { pageCount: pdf.numPages, totalChars: text.length, avgPerPage: Math.round(avgPerPage) });
    }
    if (g) g.end('PDF parsed', { pages: pdf.numPages, chars: text.length, avgPerPage: Math.round(avgPerPage) });
    return out;
  }

  // ── PDF rasterization (for AI vision) ─────────────────────────────────
  // Render each requested page to a JPEG data URL, capped by long-edge
  // pixels, JPEG quality, page count, and a total byte budget. Used by the
  // optional vision sub-step in the pipeline; the regex/text path above
  // remains the source of truth.
  async function rasterizePdfPages(arrayBuffer, opts) {
    if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
    opts = opts || {};
    var maxEdgePx   = opts.maxEdgePx   || 1600;
    var quality     = opts.quality     || 0.85;
    var maxPages    = Math.max(1, Math.min(opts.maxPages || 6, opts.hardMax || 50));
    var byteBudget  = opts.byteBudget  || (18 * 1024 * 1024);
    var onProgress  = typeof opts.onProgress === 'function' ? opts.onProgress : function () {};
    var signal      = opts.signal;

    var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var pageCount = Math.min(pdf.numPages, maxPages);
    var images = [];
    var totalBytes = 0;

    for (var i = 0; i < pageCount; i++) {
      if (signal && signal.aborted) throw new Error('Aborted');
      onProgress({ stage: 'raster', page: i + 1, of: pageCount });

      var page     = await pdf.getPage(i + 1);
      var viewport = page.getViewport({ scale: 1 });
      var longEdge = Math.max(viewport.width, viewport.height);
      var scale    = longEdge > 0 ? Math.min(maxEdgePx / longEdge, 4) : 1;
      var vp       = page.getViewport({ scale: scale });

      var canvas, ctx;
      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      } else {
        canvas = document.createElement('canvas');
        canvas.width  = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
      }
      ctx = canvas.getContext('2d');
      // White background — JPEG has no alpha; matches a printed page.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: vp }).promise;

      var dataUrl;
      if (typeof canvas.convertToBlob === 'function') {
        var blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: quality });
        dataUrl  = await _blobToDataUrl(blob);
      } else {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      // Approximate byte size from base64 length.
      var b64 = dataUrl.indexOf(',') >= 0 ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
      var bytes = Math.floor(b64.length * 3 / 4);
      var hash  = await _hash(_b64ToArrayBuffer(b64));
      _log('debug', 'rasterized page ' + (i + 1) + '/' + pageCount, {
        page: i + 1, width: canvas.width, height: canvas.height,
        bytes: bytes, mimeType: 'image/jpeg', sha256: hash
        // Note: image bytes are NEVER logged.
      });

      if (totalBytes + bytes > byteBudget) {
        _log('warn', 'vision byte budget reached; truncating at page ' + i, { totalBytes: totalBytes, budget: byteBudget });
        break;
      }
      totalBytes += bytes;
      images.push({ page: i + 1, dataUrl: dataUrl, bytes: bytes, width: canvas.width, height: canvas.height, sha256: hash });
    }

    return { images: images, totalBytes: totalBytes, totalPages: pdf.numPages, processedPages: images.length };
  }

  function _blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload  = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('FileReader error')); };
      reader.readAsDataURL(blob);
    });
  }

  function _b64ToArrayBuffer(b64) {
    try {
      var bin = (typeof atob === 'function') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      var len = bin.length, buf = new ArrayBuffer(len), view = new Uint8Array(buf);
      for (var i = 0; i < len; i++) view[i] = bin.charCodeAt(i);
      return buf;
    } catch (e) { return new ArrayBuffer(0); }
  }

  // ── Vision/regex fact merge (the "hardening") ────────────────────────
  //
  // visionFacts is a normalized map (per PE.LLM.normalizeVisionFacts):
  //   { factName: { value, confidence, evidence } }
  //
  // Returns:
  //   { facts: <merged>, provenance: <map>, conflicts: <array> }
  //
  // - regex hit + vision agrees           → keep regex, source 'regex+vision'
  // - regex hit + vision disagrees        → keep regex, mark conflict
  // - regex miss + vision present         → use vision, source 'vision'
  // - both miss                           → unchanged
  function mergeVisionFacts(regexFacts, visionFacts, opts) {
    opts = opts || {};
    var runId = opts.runId || ('run-' + Date.now());
    var model = opts.model || 'unknown';
    var page  = opts.page  || null;

    regexFacts = regexFacts || {};
    visionFacts = visionFacts || {};

    var merged    = Object.assign({}, regexFacts);
    var provenance = {};
    var conflicts = [];

    // Build provenance for every regex-derived fact already present.
    Object.keys(regexFacts).forEach(function (k) {
      if (regexFacts[k] === null || regexFacts[k] === undefined) return;
      provenance[k] = { source: 'regex', value: regexFacts[k], confidence: 1.0, runId: runId };
    });

    Object.keys(visionFacts).forEach(function (name) {
      var v = visionFacts[name];
      if (!v || v.value === undefined || v.value === null) return;
      var rVal = regexFacts[name];
      var rPresent = rVal !== undefined && rVal !== null;

      if (!rPresent) {
        merged[name] = v.value;
        provenance[name] = {
          source: 'vision', value: v.value, confidence: v.confidence,
          evidence: v.evidence, page: page, model: model, runId: runId
        };
        return;
      }

      // Both present — agree?
      var agree = _factsEqual(rVal, v.value, name);
      if (agree) {
        provenance[name] = {
          source: 'regex+vision', value: rVal,
          confidence: Math.min(1, 0.7 + 0.3 * (v.confidence || 0)),
          evidence: v.evidence, page: page, model: model, runId: runId
        };
        return;
      }
      // Disagreement — keep regex but record conflict for the rule engine.
      provenance[name] = {
        source: 'regex', value: rVal, confidence: 0.7,
        conflict: { visionValue: v.value, visionConfidence: v.confidence, evidence: v.evidence, page: page, model: model },
        runId: runId
      };
      conflicts.push({
        factName:  name,
        regexValue: rVal,
        visionValue: v.value,
        confidence: v.confidence,
        evidence:   v.evidence,
        page:       page
      });
    });

    return { facts: merged, provenance: provenance, conflicts: conflicts };
  }

  function _factsEqual(a, b, name) {
    if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
    if (typeof a === 'string'  && typeof b === 'string')  return a.trim().toLowerCase() === b.trim().toLowerCase();
    var na = typeof a === 'number' ? a : parseFloat(a);
    var nb = typeof b === 'number' ? b : parseFloat(b);
    if (!isFinite(na) || !isFinite(nb)) return String(a) === String(b);
    // Tolerate small reading discrepancies — 5% relative or 1 unit absolute.
    var diff = Math.abs(na - nb);
    var tol  = Math.max(1, Math.abs(na) * 0.05);
    return diff <= tol;
  }

  // ── DXF extraction ────────────────────────────────────────────────────
  //  Minimal DXF parser: extracts TEXT/MTEXT content and LINE lengths from
  //  the ENTITIES section to infer dimensional facts.
  function fromDxf(text) {
    var g = _L() ? _L().group('extract') : null;
    var parseError = null;
    var facts = {};
    var extractedText = [];
    var layerSet = [];
    var lines = [];

    try {
      // Extract TEXT entities
      var textRe = /\s0\s*\n\s*TEXT[\s\S]*?^\s*1\s*\n\s*(.+)/gm;
      var mtextRe = /\s0\s*\n\s*MTEXT[\s\S]*?^\s*1\s*\n\s*(.+)/gm;
      var m;
      while ((m = textRe.exec(text)) !== null)  extractedText.push(m[1].trim());
      while ((m = mtextRe.exec(text)) !== null) extractedText.push(m[1].replace(/\\P/g, ' ').replace(/[{}\\][^;]*;/g, '').trim());

      // Extract layer names to infer features
      var layers = [];
      var layerRe = /^\s*8\s*\n\s*([^\r\n]+)/gm;
      while ((m = layerRe.exec(text)) !== null) layers.push(m[1].trim().toUpperCase());
      layerSet = layers.filter(function (v, i, a) { return a.indexOf(v) === i; });

      // Extract LINE entity lengths
      var lineRe = /\s0\s*\n\s*LINE\s*\n[\s\S]*?^\s*10\s*\n\s*([\d.+-]+)[\s\S]*?^\s*20\s*\n\s*([\d.+-]+)[\s\S]*?^\s*11\s*\n\s*([\d.+-]+)[\s\S]*?^\s*21\s*\n\s*([\d.+-]+)/gm;
      while ((m = lineRe.exec(text)) !== null) {
        var x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
        var x2 = parseFloat(m[3]), y2 = parseFloat(m[4]);
        var len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        if (isFinite(len)) lines.push(len);
      }
    } catch (e) {
      // Degrade gracefully: keep whatever was parsed before the error and
      // continue with text-only inference. Surface the failure in logs.
      parseError = e && e.message ? e.message : String(e);
      _log('warn', 'DXF structural parse failed; falling back to text-only', { error: parseError });
    }

    var combined = extractedText.join(' ');
    var parsedFacts = parse(combined);
    Object.assign(facts, parsedFacts);

    // Layer-name heuristics
    var layerStr = layerSet.join(' ');
    if (/SPRINKLER|FIRE.*SUPP/.test(layerStr))             { facts.hasSprinklers = true;        _log('debug', 'DXF layer hint: hasSprinklers=true', { matched: 'SPRINKLER|FIRE.SUPP' }); }
    if (/ALARM|DETECT/.test(layerStr))                     { facts.hasFireAlarm  = true;        _log('debug', 'DXF layer hint: hasFireAlarm=true',  { matched: 'ALARM|DETECT' }); }
    if (/EXIT.*SIGN|EGRESS.*SIGN/.test(layerStr))          { facts.hasExitSigns  = true;        _log('debug', 'DXF layer hint: hasExitSigns=true',  { matched: 'EXIT.SIGN|EGRESS.SIGN' }); }
    if (/EMERG.*LIGHT|BATTERY.*LIGHT/.test(layerStr))      { facts.hasEmergencyLighting = true; _log('debug', 'DXF layer hint: hasEmergencyLighting=true', { matched: 'EMERG.LIGHT|BATTERY.LIGHT' }); }
    if (/HANDRAIL|GUARDRAIL/.test(layerStr))               { facts.hasHandrails  = true;        _log('debug', 'DXF layer hint: hasHandrails=true',  { matched: 'HANDRAIL|GUARDRAIL' }); }
    if (/RAMP/.test(layerStr))                              facts._hasRampLayer    = true;
    if (/STAIR/.test(layerStr))                             facts._hasStairLayer   = true;
    if (/PARK/.test(layerStr))                              facts._hasParkingLayer = true;

    // Heuristic: short horizontal/vertical lines near 32-48 range could be door openings (assume inches)
    if (lines.length) {
      var doorCandidates = lines.filter(function (l) { return l >= 28 && l <= 72; });
      if (doorCandidates.length && !facts.doorWidthInches) {
        facts.doorWidthInches = Math.round(doorCandidates.reduce(function (a, b) { return a + b; }, 0) / doorCandidates.length);
        _log('debug', 'DXF heuristic: doorWidthInches inferred from LINE entities', { count: doorCandidates.length, value: facts.doorWidthInches });
      }
      var corrCandidates = lines.filter(function (l) { return l >= 36 && l <= 144; });
      if (corrCandidates.length && !facts.corridorWidthInches) {
        facts.corridorWidthInches = Math.round(corrCandidates.reduce(function (a, b) { return a + b; }, 0) / corrCandidates.length);
        _log('debug', 'DXF heuristic: corridorWidthInches inferred from LINE entities', { count: corrCandidates.length, value: facts.corridorWidthInches });
      }
    }

    var result = {
      text:        combined,
      facts:       facts,
      source:      'dxf',
      layers:      layerSet,
      lineCount:   lines.length,
      textEntities: extractedText.length
    };
    if (parseError) {
      result.warning = 'dxf-parse-error';
      result.warningMsg = 'DXF parsing encountered an error and degraded to text-only inference: ' + parseError;
    }
    if (g) g.end('DXF parsed', { layers: layerSet.length, lines: lines.length, textEntities: extractedText.length, degraded: !!parseError });
    return result;
  }

  // ── Image / OCR (Tesseract.js, lazy-loaded) ──────────────────────────
  async function fromImage(file, onProgress) {
    var g = _L() ? _L().group('extract') : null;
    if (!window.Tesseract) {
      // Lazy-load Tesseract
      _log('info', 'Loading Tesseract.js OCR engine from CDN…');
      await new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    var workerOpts = {};
    if (typeof onProgress === 'function') {
      workerOpts.logger = function (m) {
        // Tesseract logger entries: { status, progress (0..1) }
        var pct = (m && typeof m.progress === 'number') ? Math.round(m.progress * 100) : null;
        try { onProgress({ status: m && m.status, progress: pct }); } catch (e) {}
        if (pct !== null) _log('trace', 'OCR ' + (m.status || 'progress') + ' ' + pct + '%', { status: m.status, progress: pct });
      };
    }
    var worker = await Tesseract.createWorker('eng', 1, workerOpts);
    var url    = URL.createObjectURL(file);
    var result = await worker.recognize(url);
    await worker.terminate();
    URL.revokeObjectURL(url);
    var text = (result && result.data && result.data.text) || '';
    if (g) g.end('OCR complete', { chars: text.length });
    return { text: text, facts: parse(text), source: 'image' };
  }

  // ── Merge form data into facts ──────────────────────────────────────
  function mergeFormData(facts, formData) {
    var merged = Object.assign({}, facts);
    if (formData.buildingType)  merged.buildingType  = formData.buildingType;
    if (formData.buildingCode)  merged.buildingCode  = formData.buildingCode;
    if (formData.city)          merged.city          = formData.city;
    if (formData.state)         merged.state         = formData.state;
    if (formData.country)       merged.country       = formData.country;
    if (formData.occupantLoad && !merged.occupantLoad)  merged.occupantLoad  = parseInt(formData.occupantLoad, 10);
    if (formData.grossArea && !merged.grossArea)        merged.grossArea     = parseFloat(formData.grossArea);
    return merged;
  }

  // Centralized list of supported file extensions (kept in one place so
  // the regex dispatch and the error message can never drift apart).
  var SUPPORTED_EXTS = ['.pdf', '.docx', '.dxf', '.dwg', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp'];
  var IMAGE_EXT_RE   = /\.(png|jpe?g|tiff?|bmp|webp)$/;

  // ── Main entry point ─────────────────────────────────────────────────
  /**
   * Extract facts from `file`.
   * @param {File}     file
   * @param {Object}   formData
   * @param {Function} [onProgress] - optional progress callback (used for OCR)
   */
  async function extract(file, formData, onProgress) {
    var name = file.name.toLowerCase();
    var ext  = (name.match(/\.[a-z0-9]+$/) || [''])[0];
    var t0   = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    var buf  = await file.arrayBuffer();
    var hash = await _hash(buf);

    var meta = {
      fileName:     file.name,
      sizeBytes:    file.size,
      mimeType:     file.type || 'unknown',
      lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      bytesRead:    buf.byteLength,
      sha256:       hash,
      extension:    ext
    };
    _log('info', 'Ingest start: ' + file.name + ' (' + file.size + ' bytes)', meta);

    var raw;
    var t1;
    try {
      if (name.endsWith('.docx'))                       raw = await fromDocx(buf);
      else if (name.endsWith('.pdf'))                   raw = await fromPdf(buf);
      else if (name.endsWith('.dxf'))                   raw = fromDxf(new TextDecoder().decode(buf));
      else if (name.endsWith('.dwg'))                   raw = { text: '', facts: {}, source: 'dwg', unsupported: true };
      else if (IMAGE_EXT_RE.test(name)) raw = await fromImage(file, onProgress);
      else {
        // Unknown extension — surface as an explicit error rather than
        // silently producing empty facts (which yields a misleading score).
        var msg = 'Unsupported file type "' + (ext || '(no extension)') + '". Supported: ' + SUPPORTED_EXTS.join(', ') + '.';
        _log('error', msg, meta);
        raw = { text: '', facts: {}, source: 'unknown', unsupported: true, unsupportedReason: msg };
      }
    } catch (err) {
      _log('error', 'Extraction failed: ' + (err && err.message ? err.message : String(err)), { fileName: file.name, error: err && err.stack });
      throw err;
    }

    t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    raw.fileMeta = meta;
    raw.parseDurationMs = Math.round(t1 - t0);
    raw.facts = mergeFormData(raw.facts, formData || {});

    var summary = {
      source:      raw.source,
      chars:       raw.text ? raw.text.length : 0,
      pages:       raw.pageCount,
      layers:      raw.layers ? raw.layers.length : undefined,
      lineCount:   raw.lineCount,
      textEntities:raw.textEntities,
      durationMs:  raw.parseDurationMs,
      factsCount:  Object.keys(raw.facts || {}).filter(function (k) { return raw.facts[k] !== null && raw.facts[k] !== undefined && !k.startsWith('_'); }).length,
      warning:     raw.warning || null
    };
    _log('info', 'Ingest done: ' + (raw.source || 'unknown') + ' branch in ' + raw.parseDurationMs + 'ms', summary);
    if (raw.text) {
      _log('debug', 'Sample of extracted text (first 500 chars):', { sample: raw.text.slice(0, 500) });
    }

    return raw;
  }

  return {
    extract: extract, fromDxf: fromDxf, parse: parse,
    rasterizePdfPages: rasterizePdfPages,
    mergeVisionFacts:  mergeVisionFacts,
    RULES: RULES, BOOL_FLAGS: BOOL_FLAGS
  };

}());

window.PE = PE;
